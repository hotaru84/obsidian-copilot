import { useState, useCallback, useEffect } from "react";
import type {
	ChatSession,
	SessionState,
	SessionModeState,
	SessionModelState,
	SessionRemoteAgentState,
	SlashCommand,
	AuthenticationMethod,
} from "../domain/models/chat-session";
import type { IAgentClient } from "../domain/ports/agent-client.port";
import type { ISettingsAccess } from "../domain/ports/settings-access.port";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent information for display.
 * (Inlined from SwitchAgentUseCase)
 */
export interface AgentInfo {
	/** Unique agent ID */
	id: string;
	/** Display name for UI */
	displayName: string;
}

/**
 * Error information specific to session operations.
 */
export interface SessionErrorInfo {
	title: string;
	message: string;
	suggestion?: string;
}

/**
 * Return type for useAgentSession hook.
 */
export interface UseAgentSessionReturn {
	/** Current session state */
	session: ChatSession;
	/** Whether the session is ready for user input */
	isReady: boolean;
	/** Error information if session operation failed */
	errorInfo: SessionErrorInfo | null;

	/**
	 * Create a new session with the specified or default agent.
	 * Resets session state and initializes connection.
	 * @param overrideAgentId - Optional agent ID to use instead of default
	 */
	createSession: (overrideAgentId?: string) => Promise<void>;

	/**
	 * Load a previous session by ID.
	 * Restores conversation context via session/load.
	 *
	 * Note: Conversation history is received via session/update notifications
	 * (user_message_chunk, agent_message_chunk, etc.), not returned from this function.
	 *
	 * @param sessionId - ID of the session to load
	 */
	loadSession: (sessionId: string) => Promise<void>;

	/**
	 * Restart the current session.
	 * Alias for createSession (closes current and creates new).
	 * @param newAgentId - Optional agent ID to switch to
	 */
	restartSession: (newAgentId?: string) => Promise<void>;

	/**
	 * Close the current session and disconnect from agent.
	 * Cancels any running operation and kills the agent process.
	 */
	closeSession: () => Promise<void>;

	/**
	 * Force restart the agent process.
	 * Unlike restartSession, this ALWAYS kills and respawns the process.
	 * Use when: environment variables changed, agent became unresponsive, etc.
	 */
	forceRestartAgent: () => Promise<void>;

	/**
	 * Cancel the current agent operation.
	 * Stops ongoing message generation without disconnecting.
	 */
	cancelOperation: () => Promise<void>;

	/**
	 * Get list of available agents.
	 * @returns Array of agent info with id and displayName
	 */
	getAvailableAgents: () => AgentInfo[];

	/**
	 * Update session state after loading/resuming/forking a session.
	 * Called by useSessionHistory after a successful session operation.
	 * @param sessionId - New session ID
	 * @param modes - Session modes (optional)
	 * @param models - Session models (optional)
	 */
	updateSessionFromLoad: (
		sessionId: string,
		modes?: SessionModeState,
		models?: SessionModelState,
	) => void;

	/**
	 * Callback to update available slash commands.
	 * Called by AcpAdapter when agent sends available_commands_update.
	 */
	updateAvailableCommands: (commands: SlashCommand[]) => void;

	/**
	 * Callback to update current mode.
	 * Called by AcpAdapter when agent sends current_mode_update.
	 */
	updateCurrentMode: (modeId: string) => void;

	/**
	 * Set the session mode.
	 * Sends a request to the agent to change the mode.
	 * @param modeId - ID of the mode to set
	 */
	setMode: (modeId: string) => Promise<void>;

	/**
	 * Set the session model (experimental).
	 * Sends a request to the agent to change the model.
	 * @param modelId - ID of the model to set
	 */
	setModel: (modelId: string) => Promise<void>;

	/**
	 * Set the remote agent for the session.
	 * Sends a request to the agent to use a specific remote agent.
	 * @param agentId - ID of the remote agent to use, or null to clear
	 */
	setRemoteAgent: (agentId: string | null) => Promise<void>;
}

// ============================================================================
// Helper Functions (Inlined from SwitchAgentUseCase)
// ============================================================================

/**
 * Get the default agent ID from settings (for new views).
 * GitHub Copilot is the only available agent.
 */
function getDefaultAgentId(): string {
	return "copilot";
}

/**
 * Get list of all available agents from settings.
 * GitHub Copilot is the only available agent.
 */
function getAvailableAgentsFromSettings(): AgentInfo[] {
	return [
		{
			id: "copilot",
			displayName: "GitHub Copilot",
		},
	];
}

/**
 * Get the currently active agent information from settings.
 */
function getCurrentAgent(agentId?: string): AgentInfo {
	const activeId = agentId || getDefaultAgentId();
	const agents = getAvailableAgentsFromSettings();
	return (
		agents.find((agent) => agent.id === activeId) || {
			id: activeId,
			displayName: activeId,
		}
	);
}

// ============================================================================
// Helper Functions (Inlined from ManageSessionUseCase)
// ============================================================================

function buildRemoteAgentConfig(workingDirectory: string) {
	return {
		id: "copilot",
		displayName: "GitHub Copilot",
		command: "remote-runtime",
		args: [],
		workingDirectory,
	};
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Create initial session state.
 */
function createInitialSession(
	agentId: string,
	agentDisplayName: string,
	workingDirectory: string,
): ChatSession {
	return {
		sessionId: null,
		state: "disconnected" as SessionState,
		agentId,
		agentDisplayName,
		authMethods: [],
		availableCommands: undefined,
		modes: undefined,
		models: undefined,
		remoteAgents: undefined,
		createdAt: new Date(),
		lastActivityAt: new Date(),
		workingDirectory,
	};
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing agent session lifecycle.
 *
 * Handles session creation, restart, cancellation, and agent switching.
 * This hook owns the session state independently.
 *
 * @param agentClient - Agent client for communication
 * @param settingsAccess - Settings access for agent configuration
 * @param workingDirectory - Working directory for the session
 * @param initialAgentId - Optional initial agent ID (from view persistence)
 */
export function useAgentSession(
	agentClient: IAgentClient,
	settingsAccess: ISettingsAccess,
	workingDirectory: string,
	initialAgentId?: string,
): UseAgentSessionReturn {
	// Get initial agent info from settings
	const effectiveInitialAgentId = initialAgentId || getDefaultAgentId();
	const initialAgent = getCurrentAgent(effectiveInitialAgentId);

	// Session state
	const [session, setSession] = useState<ChatSession>(() =>
		createInitialSession(
			effectiveInitialAgentId,
			initialAgent.displayName,
			workingDirectory,
		),
	);

	// Error state
	const [errorInfo, setErrorInfo] = useState<SessionErrorInfo | null>(null);

	// Derived state
	const isReady = session.state === "ready";

	/**
	 * Create a new session with the active agent.
	 * (Inlined from ManageSessionUseCase.createSession)
	 */
	const createSession = useCallback(
		async (overrideAgentId?: string) => {
			// Get current settings and agent info
			const settings = settingsAccess.getSnapshot();
			const agentId = overrideAgentId || getDefaultAgentId();
			const currentAgent = getCurrentAgent(agentId);

			// Reset to initializing state immediately
			setSession((prev) => ({
				...prev,
				sessionId: null,
				state: "initializing",
				agentId: agentId,
				agentDisplayName: currentAgent.displayName,
				authMethods: [],
				availableCommands: undefined,
				modes: undefined,
				models: undefined,
				remoteAgents: undefined,
				// Keep capabilities/info from previous session if same agent
				// They will be updated if re-initialization is needed
				promptCapabilities: prev.promptCapabilities,
				agentCapabilities: prev.agentCapabilities,
				agentInfo: prev.agentInfo,
				createdAt: new Date(),
				lastActivityAt: new Date(),
			}));
			setErrorInfo(null);

			try {
				const agentConfig = buildRemoteAgentConfig(workingDirectory);

				// Check if initialization is needed
				// Only initialize if agent is not initialized OR agent ID has changed
				const needsInitialize =
					!agentClient.isInitialized() ||
					agentClient.getCurrentAgentId() !== agentId;

				let authMethods: AuthenticationMethod[] = [];
				let promptCapabilities:
					| {
							image?: boolean;
							audio?: boolean;
							embeddedContext?: boolean;
					  }
					| undefined;
				let agentCapabilities:
					| {
							loadSession?: boolean;
							mcpCapabilities?: {
								http?: boolean;
								sse?: boolean;
							};
							promptCapabilities?: {
								image?: boolean;
								audio?: boolean;
								embeddedContext?: boolean;
							};
					  }
					| undefined;
				let agentInfo:
					| {
							name: string;
							title?: string;
							version?: string;
					  }
					| undefined;

				if (needsInitialize) {
					// Initialize connection to agent (spawn process + protocol handshake)
					const initResult =
						await agentClient.initialize(agentConfig);
					authMethods = initResult.authMethods;
					promptCapabilities = initResult.promptCapabilities;
					agentCapabilities = initResult.agentCapabilities;
					agentInfo = initResult.agentInfo;
				}

				// Create new session (lightweight operation)
				const sessionResult =
					await agentClient.newSession(workingDirectory);

				// Success - update to ready state
				setSession((prev) => ({
					...prev,
					sessionId: sessionResult.sessionId,
					state: "ready",
					authMethods: authMethods,
					modes: sessionResult.modes,
					models: sessionResult.models,
					remoteAgents: sessionResult.remoteAgents,
					// Only update capabilities/info if we re-initialized
					// Otherwise, keep the previous value (from the same agent)
					promptCapabilities: needsInitialize
						? promptCapabilities
						: prev.promptCapabilities,
					agentCapabilities: needsInitialize
						? agentCapabilities
						: prev.agentCapabilities,
					agentInfo: needsInitialize ? agentInfo : prev.agentInfo,
					lastActivityAt: new Date(),
				}));

				// Restore last used model if available
				if (sessionResult.models && sessionResult.sessionId) {
					const savedModelId = settings.lastUsedModels[agentId];
					if (
						savedModelId &&
						savedModelId !== sessionResult.models.currentModelId &&
						sessionResult.models.availableModels.some(
							(m) => m.modelId === savedModelId,
						)
					) {
						try {
							await agentClient.setSessionModel(
								sessionResult.sessionId,
								savedModelId,
							);
							setSession((prev) => {
								if (!prev.models) return prev;
								return {
									...prev,
									models: {
										...prev.models,
										currentModelId: savedModelId,
									},
								};
							});
						} catch {
							// Agent default model is fine as fallback
						}
					}
				}
			} catch (error) {
				// Error - update to error state
				setSession((prev) => ({ ...prev, state: "error" }));

				// Generate helpful error message based on error type
				let errorTitle = "Session Creation Failed";
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				let errorSuggestion =
					"Please check the agent configuration and try again.";

				// Check for specific error types
				if (error instanceof Error) {
					if (error.name === "CopilotAuthenticationError") {
						errorTitle = "GitHub Copilot Authentication Required";
						errorSuggestion =
							"Open a terminal and run: copilot auth login";
					} else if (error.name === "CopilotNotFoundError") {
						errorTitle = "GitHub Copilot CLI Not Found";
						errorSuggestion =
							"Please install GitHub Copilot CLI or check the command path in settings.";
					}
				}

				setErrorInfo({
					title: errorTitle,
					message: errorMessage,
					suggestion: errorSuggestion,
				});
			}
		},
		[agentClient, settingsAccess, workingDirectory],
	);

	/**
	 * Load a previous session by ID.
	 * Restores conversation history and creates a new session for future prompts.
	 *
	 * Note: Conversation history is received via session/update notifications
	 * (user_message_chunk, agent_message_chunk, etc.), not returned from this function.
	 *
	 * @param sessionId - ID of the session to load
	 */
	const loadSession = useCallback(
		async (sessionId: string) => {
			const defaultAgentId = getDefaultAgentId();
			const currentAgent = getCurrentAgent();

			// Reset to initializing state immediately
			setSession((prev) => ({
				...prev,
				sessionId: null,
				state: "initializing",
				agentId: defaultAgentId,
				agentDisplayName: currentAgent.displayName,
				authMethods: [],
				availableCommands: undefined,
				modes: undefined,
				models: undefined,
				promptCapabilities: prev.promptCapabilities,
				createdAt: new Date(),
				lastActivityAt: new Date(),
			}));
			setErrorInfo(null);

			try {
				const agentConfig = buildRemoteAgentConfig(workingDirectory);

				// Check if initialization is needed
				const needsInitialize =
					!agentClient.isInitialized() ||
					agentClient.getCurrentAgentId() !== defaultAgentId;

				let authMethods: AuthenticationMethod[] = [];
				let promptCapabilities:
					| {
							image?: boolean;
							audio?: boolean;
							embeddedContext?: boolean;
					  }
					| undefined;
				let agentCapabilities:
					| {
							loadSession?: boolean;
							sessionCapabilities?: {
								resume?: Record<string, unknown>;
								fork?: Record<string, unknown>;
								list?: Record<string, unknown>;
							};
							mcpCapabilities?: {
								http?: boolean;
								sse?: boolean;
							};
							promptCapabilities?: {
								image?: boolean;
								audio?: boolean;
								embeddedContext?: boolean;
							};
					  }
					| undefined;

				if (needsInitialize) {
					// Initialize connection to agent
					const initResult =
						await agentClient.initialize(agentConfig);
					authMethods = initResult.authMethods;
					promptCapabilities = initResult.promptCapabilities;
					agentCapabilities = initResult.agentCapabilities;
				}

				// Load the session
				// Conversation history is received via session/update notifications
				const loadResult = await agentClient.loadSession(
					sessionId,
					workingDirectory,
				);

				// Success - update to ready state with session ID
				setSession((prev) => ({
					...prev,
					sessionId: loadResult.sessionId,
					state: "ready",
					authMethods: authMethods,
					modes: loadResult.modes,
					models: loadResult.models,
					promptCapabilities: needsInitialize
						? promptCapabilities
						: prev.promptCapabilities,
					agentCapabilities: needsInitialize
						? agentCapabilities
						: prev.agentCapabilities,
					lastActivityAt: new Date(),
				}));
			} catch (error) {
				// Error - update to error state
				setSession((prev) => ({ ...prev, state: "error" }));
				setErrorInfo({
					title: "Session Loading Failed",
					message: `Failed to load session: ${error instanceof Error ? error.message : String(error)}`,
					suggestion: "Please try again or create a new session.",
				});
			}
		},
		[agentClient, settingsAccess, workingDirectory],
	);

	/**
	 * Restart the current session.
	 * @param newAgentId - Optional agent ID to switch to
	 */
	const restartSession = useCallback(
		async (newAgentId?: string) => {
			await createSession(newAgentId);
		},
		[createSession],
	);

	/**
	 * Close the current session and disconnect from agent.
	 * Cancels any running operation and kills the agent process.
	 */
	const closeSession = useCallback(async () => {
		// Cancel current session if active
		if (session.sessionId) {
			try {
				await agentClient.cancel(session.sessionId);
			} catch (error) {
				// Ignore errors - session might already be closed
				console.warn("Failed to cancel session:", error);
			}
		}

		// Disconnect from agent (kill process)
		try {
			await agentClient.disconnect();
		} catch (error) {
			console.warn("Failed to disconnect:", error);
		}

		// Update to disconnected state
		setSession((prev) => ({
			...prev,
			sessionId: null,
			state: "disconnected",
		}));
	}, [agentClient, session.sessionId]);

	/**
	 * Force restart the agent process.
	 * Disconnects (kills process) then creates a new session (spawns new process).
	 *
	 * Note: All state reset (modes, models, availableCommands, etc.) is handled
	 * by createSession() internally, so this function is intentionally simple.
	 */
	const forceRestartAgent = useCallback(async () => {
		const currentAgentId = session.agentId;

		// 1. Disconnect - kills process, sets isInitialized to false
		await agentClient.disconnect();

		// 2. Create new session - handles ALL state reset internally:
		//    - sessionId, state, authMethods
		//    - modes, models (reset to undefined, then set from newSession result)
		//    - availableCommands (reset to undefined)
		//    - createdAt, lastActivityAt
		//    - promptCapabilities, agentCapabilities, agentInfo (updated if re-initialized)
		await createSession(currentAgentId);
	}, [agentClient, session.agentId, createSession]);

	/**
	 * Cancel the current operation.
	 */
	const cancelOperation = useCallback(async () => {
		if (!session.sessionId) {
			return;
		}

		try {
			// Cancel via agent client
			await agentClient.cancel(session.sessionId);

			// Update to ready state
			setSession((prev) => ({
				...prev,
				state: "ready",
			}));
		} catch (error) {
			// If cancel fails, log but still update UI
			console.warn("Failed to cancel operation:", error);

			// Still update to ready state
			setSession((prev) => ({
				...prev,
				state: "ready",
			}));
		}
	}, [agentClient, session.sessionId]);

	/**
	 * Get list of available agents.
	 */
	const getAvailableAgents = useCallback(() => {
		return getAvailableAgentsFromSettings();
	}, []);

	/**
	 * Update available slash commands.
	 * Called by AcpAdapter when receiving available_commands_update.
	 */
	const updateAvailableCommands = useCallback((commands: SlashCommand[]) => {
		setSession((prev) => ({
			...prev,
			availableCommands: commands,
		}));
	}, []);

	/**
	 * Update current mode.
	 * Called by AcpAdapter when receiving current_mode_update.
	 */
	const updateCurrentMode = useCallback((modeId: string) => {
		setSession((prev) => {
			// Only update if modes exist
			if (!prev.modes) {
				return prev;
			}
			return {
				...prev,
				modes: {
					...prev.modes,
					currentModeId: modeId,
				},
			};
		});
	}, []);

	/**
	 * Set the session mode.
	 * Sends a request to the agent to change the mode.
	 */
	const setMode = useCallback(
		async (modeId: string) => {
			if (!session.sessionId) {
				console.warn("Cannot set mode: no active session");
				return;
			}

			// Store previous mode for rollback on error
			const previousModeId = session.modes?.currentModeId;

			// Optimistic update - update UI immediately
			setSession((prev) => {
				if (!prev.modes) return prev;
				return {
					...prev,
					modes: {
						...prev.modes,
						currentModeId: modeId,
					},
				};
			});

			try {
				await agentClient.setSessionMode(session.sessionId, modeId);
				// Per ACP protocol, current_mode_update is only sent when the agent
				// changes its own mode, not in response to client's setSessionMode.
				// UI is already updated optimistically above.
			} catch (error) {
				console.error("Failed to set mode:", error);
				// Rollback to previous mode on error
				if (previousModeId) {
					setSession((prev) => {
						if (!prev.modes) return prev;
						return {
							...prev,
							modes: {
								...prev.modes,
								currentModeId: previousModeId,
							},
						};
					});
				}
			}
		},
		[agentClient, session.sessionId, session.modes?.currentModeId],
	);

	/**
	 * Set the session model (experimental).
	 * Sends a request to the agent to change the model.
	 */
	const setModel = useCallback(
		async (modelId: string) => {
			if (!session.sessionId) {
				console.warn("Cannot set model: no active session");
				return;
			}

			// Store previous model for rollback on error
			const previousModelId = session.models?.currentModelId;

			// Optimistic update - update UI immediately
			setSession((prev) => {
				if (!prev.models) return prev;
				return {
					...prev,
					models: {
						...prev.models,
						currentModelId: modelId,
					},
				};
			});

			try {
				await agentClient.setSessionModel(session.sessionId, modelId);
				// Note: Unlike modes, there is no dedicated notification for model changes.
				// UI is already updated optimistically above.

				// Persist last used model for this agent
				if (session.agentId) {
					const currentSettings = settingsAccess.getSnapshot();
					void settingsAccess.updateSettings({
						lastUsedModels: {
							...currentSettings.lastUsedModels,
							[session.agentId]: modelId,
						},
					});
				}
			} catch (error) {
				console.error("Failed to set model:", error);
				// Rollback to previous model on error
				if (previousModelId) {
					setSession((prev) => {
						if (!prev.models) return prev;
						return {
							...prev,
							models: {
								...prev.models,
								currentModelId: previousModelId,
							},
						};
					});
				}
			}
		},
		[
			agentClient,
			session.sessionId,
			session.models?.currentModelId,
			settingsAccess,
			session.agentId,
		],
	);

	// Register error callback for process-level errors
	useEffect(() => {
		agentClient.onError((error) => {
			setSession((prev) => ({ ...prev, state: "error" }));
			setErrorInfo({
				title: error.title || "Agent Error",
				message: error.message || "An error occurred",
				suggestion: error.suggestion,
			});
		});
	}, [agentClient]);

	/**
	 * Set the remote agent for the session.
	 * Sends a request to assign a specific remote agent to the session.
	 */
	const setRemoteAgent = useCallback(
		async (agentId: string | null) => {
			if (!session.sessionId) {
				console.warn("Cannot set remote agent: no active session");
				return;
			}

			// Capture previous agent ID for rollback before optimistic update
			let previousAgentId: string | null = null;

			// Optimistic update - update UI immediately
			setSession((prev) => {
				if (!prev.remoteAgents) return prev;
				previousAgentId = prev.remoteAgents.currentAgentId;
				return {
					...prev,
					remoteAgents: {
						...prev.remoteAgents,
						currentAgentId: agentId,
					},
				};
			});

			try {
				await agentClient.setSessionAgent(session.sessionId, agentId);
			} catch (error) {
				console.error("Failed to set remote agent:", error);
				// Rollback to previous agent on error
				setSession((prev) => {
					if (!prev.remoteAgents) return prev;
					return {
						...prev,
						remoteAgents: {
							...prev.remoteAgents,
							currentAgentId: previousAgentId,
						},
					};
				});
			}
		},
		[agentClient, session.sessionId],
	);

	/**
	 * Update session state after loading/resuming/forking a session.
	 * Called by useSessionHistory after a successful session operation.
	 */
	const updateSessionFromLoad = useCallback(
		(
			sessionId: string,
			modes?: SessionModeState,
			models?: SessionModelState,
		) => {
			setSession((prev) => ({
				...prev,
				sessionId,
				state: "ready",
				modes: modes ?? prev.modes,
				models: models ?? prev.models,
				lastActivityAt: new Date(),
			}));
		},
		[],
	);

	return {
		session,
		isReady,
		errorInfo,
		createSession,
		loadSession,
		restartSession,
		closeSession,
		forceRestartAgent,
		cancelOperation,
		getAvailableAgents,
		updateSessionFromLoad,
		updateAvailableCommands,
		updateCurrentMode,
		setMode,
		setModel,
		setRemoteAgent,
	};
}
