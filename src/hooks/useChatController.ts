import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Notice } from "obsidian";

import type AgentClientPlugin from "../plugin";
import type { AttachedImage } from "../components/chat/ImagePreviewStrip";
import { SessionHistoryModal } from "../components/chat/SessionHistoryModal";
import { ConfirmDeleteModal } from "../components/chat/ConfirmDeleteModal";
import { ElicitationModal } from "../components/chat/ElicitationModal";

// Service imports
import { NoteMentionService } from "../adapters/obsidian/mention-service";
import { getLogger, Logger } from "../shared/logger";
import { ChatExporter } from "../shared/chat-exporter";
import { extractConversationTitle } from "../shared/conversation-title";
import {
	notifyWindowsChatEvent,
	type ChatNotificationMode,
} from "../shared/windows-notification";
import { getVaultBasePath } from "../shared/path-utils";

// Adapter imports
import { ObsidianVaultAdapter } from "../adapters/obsidian/vault.adapter";
import type { IChatAgentClient } from "../domain/ports/chat-agent-client.port";

// Hooks imports
import { useSettings } from "./useSettings";
import { useMentions } from "./useMentions";
import { useSlashCommands } from "./useSlashCommands";
import { useAutoMention } from "./useAutoMention";
import { useAgentSession } from "./useAgentSession";
import { useChat } from "./useChat";
import { usePermission } from "./usePermission";
import { useAutoExport } from "./useAutoExport";
import { useSessionHistory } from "./useSessionHistory";

// Domain model imports
import type {
	PromptTemplateInfo,
	SlashCommand,
	SessionModeState,
	SessionModelState,
	SessionRemoteAgentState,
} from "../domain/models/chat-session";
import type { ImagePromptContent } from "../domain/models/prompt-content";
import type {
	ChatMessage,
	ElicitationResponse,
	MessageContent,
} from "../domain/models/chat-message";

// Agent info for display (from plugin.getAvailableAgents())
interface AgentInfo {
	id: string;
	displayName: string;
}

function hasAssistantResponseInLatestTurn(
	messages: ReturnType<typeof useChat>["messages"],
): boolean {
	let sawLatestUserMessage = false;

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "user") {
			sawLatestUserMessage = true;
			break;
		}
	}

	if (!sawLatestUserMessage) {
		return false;
	}

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "user") {
			return false;
		}
		if (message.role === "assistant") {
			return message.content.length > 0;
		}
	}

	return false;
}

function findActiveElicitation(
	messages: ChatMessage[],
): Extract<MessageContent, { type: "elicitation" }> | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		for (
			let contentIndex = message.content.length - 1;
			contentIndex >= 0;
			contentIndex -= 1
		) {
			const content = message.content[contentIndex];
			if (
				content.type === "elicitation" &&
				content.status === "pending"
			) {
				return content;
			}
		}
	}

	return null;
}

export interface UseChatControllerOptions {
	plugin: AgentClientPlugin;
	viewId: string;
	workingDirectory?: string;
	initialAgentId?: string;
	// TODO(code-block): Configuration for future code block chat view
	config?: {
		agent?: string;
		model?: string;
	};
}

export interface UseChatControllerReturn {
	// Memoized services/adapters
	logger: Logger;
	vaultPath: string;
	acpAdapter: IChatAgentClient;
	vaultAccessAdapter: ObsidianVaultAdapter;
	noteMentionService: NoteMentionService;

	// Settings & State
	settings: ReturnType<typeof useSettings>;
	session: ReturnType<typeof useAgentSession>["session"];
	isSessionReady: boolean;
	messages: ReturnType<typeof useChat>["messages"];
	isSending: boolean;
	isLoadingSessionHistory: boolean;

	// Hook returns
	permission: ReturnType<typeof usePermission>;
	mentions: ReturnType<typeof useMentions>;
	autoMention: ReturnType<typeof useAutoMention>;
	slashCommands: ReturnType<typeof useSlashCommands>;
	sessionHistory: ReturnType<typeof useSessionHistory>;
	autoExport: ReturnType<typeof useAutoExport>;

	// Computed values
	activeAgentLabel: string;
	availableAgents: AgentInfo[];
	errorInfo:
		| ReturnType<typeof useChat>["errorInfo"]
		| ReturnType<typeof useAgentSession>["errorInfo"];

	// Core callbacks
	handleSendMessage: (
		content: string,
		images?: ImagePromptContent[],
	) => Promise<void>;
	handleStopGeneration: () => Promise<void>;
	handleNewChat: (requestedAgentId?: string) => Promise<void>;
	handleExportChat: () => Promise<void>;
	handleSwitchAgent: (agentId: string) => Promise<void>;
	handleRestartAgent: () => Promise<void>;
	handleClearError: () => void;
	handleRestoreSession: (sessionId: string, cwd: string) => Promise<void>;
	handleForkSession: (sessionId: string, cwd: string) => Promise<void>;
	handleDeleteSession: (sessionId: string) => void;
	handleOpenHistory: () => void;
	handleSetMode: (modeId: string) => Promise<void>;
	handleSetModel: (modelId: string) => Promise<void>;
	handleSetRemoteAgent: (agentId: string | null) => Promise<void>;
	handleCompactHistory: () => Promise<void>;
	handleTruncateHistory: () => Promise<void>;
	activeElicitation: Extract<MessageContent, { type: "elicitation" }> | null;
	handleSubmitElicitation: (response: ElicitationResponse) => Promise<void>;

	// Input state (for broadcast commands - sidebar only)
	inputValue: string;
	setInputValue: (value: string) => void;
	attachedImages: AttachedImage[];
	setAttachedImages: (images: AttachedImage[]) => void;
	restoredMessage: string | null;
	handleRestoredMessageConsumed: () => void;

	// History modal management
	historyModalRef: React.RefObject<SessionHistoryModal | null>;
}

export function useChatController(
	options: UseChatControllerOptions,
): UseChatControllerReturn {
	const { plugin, viewId, initialAgentId, config } = options;

	// ============================================================
	// Memoized Services & Adapters
	// ============================================================
	const logger = getLogger();

	const vaultPath = useMemo(() => {
		if (options.workingDirectory) {
			return options.workingDirectory;
		}
		const basePath = getVaultBasePath(plugin.app.vault.adapter);
		if (basePath) {
			return basePath;
		}
		// Fallback for non-FileSystemAdapter (e.g., mobile)
		return process.cwd();
	}, [plugin, options.workingDirectory]);

	const noteMentionService = useMemo(
		() => new NoteMentionService(plugin),
		[plugin],
	);

	// Cleanup NoteMentionService when component unmounts
	useEffect(() => {
		return () => {
			noteMentionService.destroy();
		};
	}, [noteMentionService]);

	const acpAdapter = useMemo(
		() => plugin.getOrCreateAdapter(viewId),
		[plugin, viewId],
	);

	const vaultAccessAdapter = useMemo(() => {
		return new ObsidianVaultAdapter(plugin, noteMentionService);
	}, [plugin, noteMentionService]);

	// ============================================================
	// Custom Hooks
	// ============================================================
	const settings = useSettings(plugin);

	const agentSession = useAgentSession(
		acpAdapter,
		plugin.settingsStore,
		vaultPath,
		initialAgentId,
	);

	const {
		session,
		errorInfo: sessionErrorInfo,
		isReady: isSessionReady,
	} = agentSession;

	const chat = useChat(
		acpAdapter,
		vaultAccessAdapter,
		noteMentionService,
		{
			sessionId: session.sessionId,
			authMethods: session.authMethods,
			promptCapabilities: session.promptCapabilities,
		},
		{
			maxNoteLength: settings.displaySettings.maxNoteLength,
			maxSelectionLength: settings.displaySettings.maxSelectionLength,
		},
	);

	const { messages, isSending } = chat;

	const permission = usePermission(acpAdapter, messages);
	const [promptTemplates, setPromptTemplates] = useState<
		PromptTemplateInfo[]
	>([]);

	const promptCommands = useMemo(() => {
		return promptTemplates.map((prompt) => ({
			name: prompt.promptId,
			description: prompt.description || prompt.name,
			hint: prompt.name,
			source: "agent" as const,
		}));
	}, [promptTemplates]);

	const mergedSlashCommands = useMemo(() => {
		const byName = new Map<string, SlashCommand>();
		for (const command of session.availableCommands || []) {
			byName.set(command.name, command);
		}
		for (const command of promptCommands) {
			if (!byName.has(command.name)) {
				byName.set(command.name, command);
			}
		}
		return Array.from(byName.values());
	}, [promptCommands, session.availableCommands]);

	const mentions = useMentions(vaultAccessAdapter, plugin);
	const autoMention = useAutoMention(vaultAccessAdapter);
	const slashCommands = useSlashCommands(
		mergedSlashCommands,
		autoMention.toggle,
	);

	useEffect(() => {
		let isDisposed = false;

		if (!session.sessionId || !isSessionReady) {
			setPromptTemplates([]);
			return;
		}

		void acpAdapter
			.listPrompts()
			.then((prompts) => {
				if (!isDisposed) {
					setPromptTemplates(prompts);
				}
			})
			.catch((error) => {
				logger.warn(
					"[useChatController] Failed to load runtime prompt templates",
					error,
				);
				if (!isDisposed) {
					setPromptTemplates([]);
				}
			});

		return () => {
			isDisposed = true;
		};
	}, [acpAdapter, isSessionReady, logger, session.sessionId]);

	const autoExport = useAutoExport(plugin);

	// Session history hook with callback for session load
	const handleSessionLoad = useCallback(
		(
			sessionId: string,
			modes?: SessionModeState,
			models?: SessionModelState,
			remoteAgents?: SessionRemoteAgentState,
		) => {
			logger.log(
				`[useChatController] Session loaded/resumed/forked: ${sessionId}`,
				{
					modes,
					models,
					remoteAgents,
				},
			);
			agentSession.updateSessionFromLoad(
				sessionId,
				modes,
				models,
				remoteAgents,
			);
		},
		[logger, agentSession],
	);

	const [isLoadingSessionHistory, setIsLoadingSessionHistory] =
		useState(false);

	const handleLoadStart = useCallback(() => {
		logger.log(
			"[useChatController] session/load started, ignoring history replay",
		);
		setIsLoadingSessionHistory(true);
		chat.clearMessages();
	}, [logger, chat]);

	const handleLoadEnd = useCallback(() => {
		logger.log(
			"[useChatController] session/load ended, resuming normal processing",
		);
		setIsLoadingSessionHistory(false);
	}, [logger]);

	const sessionHistory = useSessionHistory({
		agentClient: acpAdapter,
		session,
		settingsAccess: plugin.settingsStore,
		cwd: vaultPath,
		onSessionLoad: handleSessionLoad,
		agentRestoreSession: agentSession.restoreSession,
		onMessagesRestore: chat.setMessagesFromLocal,
		onLoadStart: handleLoadStart,
		onLoadEnd: handleLoadEnd,
	});

	// Combined error info (session errors take precedence)
	const errorInfo =
		sessionErrorInfo || chat.errorInfo || permission.errorInfo;

	// ============================================================
	// Local State
	// ============================================================
	const [restoredMessage, setRestoredMessage] = useState<string | null>(null);

	// Input state (for broadcast commands - sidebar only)
	const [inputValue, setInputValue] = useState("");
	const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

	// ============================================================
	// Refs
	// ============================================================
	const historyModalRef = useRef<SessionHistoryModal | null>(null);
	const elicitationModalRef = useRef<ElicitationModal | null>(null);

	// ============================================================
	// Computed Values
	// ============================================================
	const activeAgentLabel = useMemo(() => {
		return session.agentDisplayName;
	}, [session.agentDisplayName]);

	const availableAgents = useMemo(() => {
		return plugin.getAvailableAgents();
	}, [plugin]);

	const activeElicitation = useMemo(
		() => findActiveElicitation(messages),
		[messages],
	);

	// ============================================================
	// Callbacks
	// ============================================================
	const handleSendMessage = useCallback(
		async (content: string, images?: ImagePromptContent[]) => {
			const isFirstMessage = messages.length === 0;
			// Match slash commands like /explain or /explain arg1 arg2
			const promptMatch = content.match(/^\/(\S+)(?:\s+([\s\S]*))?$/);
			const matchedPrompt = promptMatch
				? promptTemplates.find(
						(prompt) => prompt.promptId === promptMatch[1],
					)
				: undefined;

			if (matchedPrompt && (!images || images.length === 0)) {
				// Execute as a prompt template
				// Arguments are everything after the slash command
				const args = promptMatch?.[2]?.trim();
				await chat.executePromptTemplate(
					matchedPrompt.promptId,
					content,
					args,
				);

				if (isFirstMessage && session.sessionId) {
					await sessionHistory.saveSessionLocally(
						session.sessionId,
						content,
					);
				}
				return;
			}

			await chat.sendMessage(content, {
				activeNote: settings.autoMentionActiveNote
					? autoMention.activeNote
					: null,
				vaultBasePath: vaultPath,
				isAutoMentionDisabled: autoMention.isDisabled,
				images,
			});

			// Save session metadata locally on first message
			if (isFirstMessage && session.sessionId) {
				await sessionHistory.saveSessionLocally(
					session.sessionId,
					content,
				);
				logger.log(
					`[useChatController] Session saved locally: ${session.sessionId}`,
				);
			}
		},
		[
			chat,
			autoMention,
			promptTemplates,
			plugin,
			messages.length,
			session.sessionId,
			sessionHistory,
			logger,
			settings.autoMentionActiveNote,
		],
	);

	const handleStopGeneration = useCallback(async () => {
		logger.log("Cancelling current operation...");
		const lastMessage = chat.lastUserMessage;
		await agentSession.cancelOperation();
		if (lastMessage) {
			setRestoredMessage(lastMessage);
		}
	}, [logger, agentSession, chat.lastUserMessage]);

	const handleNewChat = useCallback(
		async (requestedAgentId?: string) => {
			const isAgentSwitch =
				requestedAgentId && requestedAgentId !== session.agentId;

			// Skip if already empty AND not switching agents
			if (messages.length === 0 && !isAgentSwitch) {
				new Notice("[Agent Client] already a new session");
				return;
			}

			// Cancel ongoing generation before starting new chat
			if (chat.isSending) {
				await agentSession.cancelOperation();
			}

			logger.log(
				`[Debug] Creating new session${isAgentSwitch ? ` with agent: ${requestedAgentId}` : ""}...`,
			);

			// Auto-export current chat before starting new one (if has messages)
			if (messages.length > 0) {
				await autoExport.autoExportIfEnabled(
					"newChat",
					messages,
					session,
				);
			}

			autoMention.toggle(false);
			chat.clearMessages();

			const newAgentId = isAgentSwitch
				? requestedAgentId
				: session.agentId;
			await agentSession.restartSession(newAgentId);

			// Invalidate session history cache when creating new session
			sessionHistory.invalidateCache();
		},
		[
			messages,
			session,
			logger,
			autoExport,
			autoMention,
			chat,
			agentSession,
			sessionHistory,
		],
	);

	const handleExportChat = useCallback(async () => {
		if (messages.length === 0) {
			new Notice("[Agent Client] no messages to export");
			return;
		}

		try {
			const exporter = new ChatExporter(plugin);
			const openFile = plugin.settings.exportSettings.openFileAfterExport;
			const filePath = await exporter.exportToMarkdown(
				messages,
				session.agentDisplayName,
				session.agentId,
				session.sessionId || "unknown",
				session.createdAt,
				openFile,
			);
			new Notice(`[Agent Client] Chat exported to ${filePath}`);
		} catch (error) {
			new Notice("[Agent Client] failed to export chat");
			logger.error("Export error:", error);
		}
	}, [messages, session, plugin, logger]);

	const handleSwitchAgent = useCallback(
		async (agentId: string) => {
			if (agentId !== session.agentId) {
				await handleNewChat(agentId);
			}
		},
		[session.agentId, handleNewChat],
	);

	const handleRestartAgent = useCallback(async () => {
		logger.log("[useChatController] Restarting agent process...");

		// Auto-export current chat before restart (if has messages)
		if (messages.length > 0) {
			await autoExport.autoExportIfEnabled("newChat", messages, session);
		}

		// Clear messages for fresh start
		chat.clearMessages();

		try {
			await agentSession.forceRestartAgent();
			new Notice("[Agent Client] agent restarted");
		} catch (error) {
			new Notice("[Agent Client] failed to restart agent");
			logger.error("Restart error:", error);
		}
	}, [logger, messages, session, autoExport, chat, agentSession]);

	const handleClearError = useCallback(() => {
		chat.clearError();
	}, [chat]);

	const handleRestoredMessageConsumed = useCallback(() => {
		setRestoredMessage(null);
	}, []);

	// ============================================================
	// Session History Modal Callbacks
	// ============================================================
	const handleRestoreSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(
					`[useChatController] Restoring session: ${sessionId}`,
				);
				chat.clearMessages();
				await sessionHistory.restoreSession(sessionId, cwd);
				new Notice("[Agent Client] session restored");
			} catch (error) {
				new Notice("[Agent Client] failed to restore session");
				logger.error("Session restore error:", error);
			}
		},
		[logger, chat, sessionHistory],
	);

	const handleForkSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(`[useChatController] Forking session: ${sessionId}`);
				chat.clearMessages();
				await sessionHistory.forkSession(sessionId, cwd);
				new Notice("[Agent Client] session forked");
			} catch (error) {
				new Notice("[Agent Client] failed to fork session");
				logger.error("Session fork error:", error);
			}
		},
		[logger, chat, sessionHistory],
	);

	const handleDeleteSession = useCallback(
		(sessionId: string) => {
			const targetSession = sessionHistory.sessions.find(
				(s) => s.sessionId === sessionId,
			);
			const sessionTitle = targetSession?.title ?? "Untitled Session";

			const confirmModal = new ConfirmDeleteModal(
				plugin.app,
				sessionTitle,
				async () => {
					try {
						logger.log(
							`[useChatController] Deleting session: ${sessionId}`,
						);
						await sessionHistory.deleteSession(sessionId);
						new Notice("[Agent Client] session deleted");
					} catch (error) {
						new Notice("[Agent Client] failed to delete session");
						logger.error("Session delete error:", error);
					}
				},
			);
			confirmModal.open();
		},
		[plugin.app, sessionHistory, logger],
	);

	const handleLoadMore = useCallback(() => {
		void sessionHistory.loadMoreSessions();
	}, [sessionHistory]);

	const handleFetchSessions = useCallback(
		(cwd?: string) => {
			void sessionHistory.fetchSessions(cwd);
		},
		[sessionHistory],
	);

	const handleOpenHistory = useCallback(() => {
		// Create modal if it doesn't exist
		if (!historyModalRef.current) {
			historyModalRef.current = new SessionHistoryModal(plugin.app, {
				sessions: sessionHistory.sessions,
				loading: sessionHistory.loading,
				error: sessionHistory.error,
				hasMore: sessionHistory.hasMore,
				currentCwd: vaultPath,
				canList: sessionHistory.canList,
				canRestore: sessionHistory.canRestore,
				canFork: sessionHistory.canFork,
				isUsingLocalSessions: sessionHistory.isUsingLocalSessions,
				localSessionIds: sessionHistory.localSessionIds,
				isAgentReady: isSessionReady,
				debugMode: settings.debugMode,
				onRestoreSession: handleRestoreSession,
				onForkSession: handleForkSession,
				onDeleteSession: handleDeleteSession,
				onLoadMore: handleLoadMore,
				onFetchSessions: handleFetchSessions,
			});
		}
		historyModalRef.current.open();
		void sessionHistory.fetchSessions(vaultPath);
	}, [
		plugin.app,
		sessionHistory,
		vaultPath,
		isSessionReady,
		settings.debugMode,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
	]);

	const handleSetMode = useCallback(
		async (modeId: string) => {
			await agentSession.setMode(modeId);
		},
		[agentSession],
	);

	const handleSetModel = useCallback(
		async (modelId: string) => {
			await agentSession.setModel(modelId);
		},
		[agentSession],
	);

	const handleSetRemoteAgent = useCallback(
		async (agentId: string | null) => {
			if (agentId) {
				logger.log(
					`[useChatController] handleSetRemoteAgent called with agentId='${agentId}'`,
				);
			} else {
				logger.log(
					`[useChatController] handleSetRemoteAgent called with agentId=null (clearing)`,
				);
			}
			await agentSession.setRemoteAgent(agentId);
		},
		[agentSession, logger],
	);

	const handleCompactHistory = useCallback(async () => {
		if (!session.sessionId) {
			new Notice("[Agent Client] no active session");
			return;
		}

		// eslint-disable-next-line no-alert
		const confirm = window.confirm(
			"Are you sure you want to compact session context? This will summarize or remove older messages to save tokens.",
		);
		if (!confirm) return;

		try {
			const result = await acpAdapter.compactHistory(session.sessionId);
			const removed = result.messagesRemoved ?? 0;
			new Notice(
				`[Agent Client] context compacted${removed > 0 ? ` (${removed} messages removed)` : ""}`,
			);
		} catch (error) {
			new Notice("[Agent Client] failed to compact history");
			logger.error("History compact error:", error);
		}
	}, [acpAdapter, logger, session.sessionId]);

	const handleTruncateHistory = useCallback(async () => {
		if (!session.sessionId || messages.length === 0) {
			new Notice("[Agent Client] no active session or messages");
			return;
		}

		// eslint-disable-next-line no-alert
		const indexStr = window.prompt(
			`Enter message index to truncate AFTER (0 to ${messages.length - 1}):`,
			(messages.length - 1).toString(),
		);
		if (indexStr === null) return;

		const index = parseInt(indexStr, 10);
		if (isNaN(index) || index < 0 || index >= messages.length) {
			new Notice("[Agent Client] invalid message index");
			return;
		}

		const targetMessage = messages[index];
		const eventId = targetMessage.eventId;

		if (!eventId) {
			new Notice(
				"[Agent Client] cannot truncate: message has no protocol event ID",
			);
			return;
		}

		// eslint-disable-next-line no-alert
		const confirm = window.confirm(
			`Are you sure you want to truncate history after message ${index}? All subsequent messages will be permanently removed from the session.`,
		);
		if (!confirm) return;

		try {
			await acpAdapter.truncateHistory(session.sessionId, eventId);
			chat.truncateMessages(eventId);
			new Notice("[Agent Client] history truncated");
		} catch (error) {
			new Notice("[Agent Client] failed to truncate history");
			logger.error("History truncate error:", error);
		}
	}, [acpAdapter, chat, logger, messages, session.sessionId]);

	const handleSubmitElicitation = useCallback(
		async (response: ElicitationResponse) => {
			if (!session.sessionId || !activeElicitation) {
				return;
			}

			try {
				await acpAdapter.handlePendingElicitation(
					session.sessionId,
					activeElicitation.requestId,
					response,
				);
				chat.handleSessionUpdate({
					type: "elicitation_complete",
					sessionId: session.sessionId,
					requestId: activeElicitation.requestId,
					response,
					success: true,
				});
			} catch (error) {
				logger.error("Elicitation submit error:", error);
				chat.handleSessionUpdate({
					type: "elicitation_complete",
					sessionId: session.sessionId,
					requestId: activeElicitation.requestId,
					response,
					success: false,
					error:
						error instanceof Error ? error.message : String(error),
				});
				new Notice("[Agent Client] failed to submit requested input");
			}
		},
		[acpAdapter, activeElicitation, chat, logger, session.sessionId],
	);

	// Update modal props when session history state changes
	useEffect(() => {
		if (historyModalRef.current) {
			historyModalRef.current.updateProps({
				sessions: sessionHistory.sessions,
				loading: sessionHistory.loading,
				error: sessionHistory.error,
				hasMore: sessionHistory.hasMore,
				currentCwd: vaultPath,
				canList: sessionHistory.canList,
				canRestore: sessionHistory.canRestore,
				canFork: sessionHistory.canFork,
				isUsingLocalSessions: sessionHistory.isUsingLocalSessions,
				localSessionIds: sessionHistory.localSessionIds,
				isAgentReady: isSessionReady,
				debugMode: settings.debugMode,
				onRestoreSession: handleRestoreSession,
				onForkSession: handleForkSession,
				onDeleteSession: handleDeleteSession,
				onLoadMore: handleLoadMore,
				onFetchSessions: handleFetchSessions,
			});
		}
	}, [
		sessionHistory.sessions,
		sessionHistory.loading,
		sessionHistory.error,
		sessionHistory.hasMore,
		sessionHistory.canList,
		sessionHistory.canRestore,
		sessionHistory.canFork,
		sessionHistory.isUsingLocalSessions,
		vaultPath,
		isSessionReady,
		settings.debugMode,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
	]);

	useEffect(() => {
		if (!activeElicitation) {
			elicitationModalRef.current?.close();
			elicitationModalRef.current = null;
			return;
		}

		const props = {
			message: activeElicitation.message,
			requestedSchema: activeElicitation.requestedSchema,
			onSubmit: handleSubmitElicitation,
		};

		if (!elicitationModalRef.current) {
			elicitationModalRef.current = new ElicitationModal(
				plugin.app,
				props,
			);
			elicitationModalRef.current.open();
			return;
		}

		elicitationModalRef.current.updateProps(props);
	}, [activeElicitation, handleSubmitElicitation, plugin.app]);

	// ============================================================
	// Effects - Session Lifecycle
	// ============================================================
	const lastAutoInitializedAgentKeyRef = useRef<string | null>(null);

	// Initialize session on mount
	useEffect(() => {
		const requestedAgentId = config?.agent || initialAgentId || "copilot";
		if (lastAutoInitializedAgentKeyRef.current === requestedAgentId) {
			return;
		}
		lastAutoInitializedAgentKeyRef.current = requestedAgentId;

		logger.log("[Debug] Starting connection setup via useAgentSession...");
		void agentSession.createSession(requestedAgentId);
	}, [agentSession.createSession, config?.agent, initialAgentId, logger]);

	// TODO(code-block): Apply configured model when session is ready
	useEffect(() => {
		if (config?.model && isSessionReady && session.models) {
			const modelExists = session.models.availableModels.some(
				(m) => m.modelId === config.model,
			);
			if (modelExists && session.models.currentModelId !== config.model) {
				logger.log(
					"[useChatController] Applying configured model:",
					config.model,
				);
				void agentSession.setModel(config.model);
			}
		}
	}, [
		config?.model,
		isSessionReady,
		session.models,
		agentSession.setModel,
		logger,
	]);

	// Refs for cleanup (to access latest values in cleanup function)
	const messagesRef = useRef(messages);
	const sessionRef = useRef(session);
	const autoExportRef = useRef(autoExport);
	const closeSessionRef = useRef(agentSession.closeSession);
	messagesRef.current = messages;
	sessionRef.current = session;
	autoExportRef.current = autoExport;
	closeSessionRef.current = agentSession.closeSession;

	// Cleanup on unmount only - auto-export and close session
	useEffect(() => {
		return () => {
			elicitationModalRef.current?.close();
			logger.log(
				"[useChatController] Cleanup: auto-export and close session",
			);
			void (async () => {
				await autoExportRef.current.autoExportIfEnabled(
					"closeChat",
					messagesRef.current,
					sessionRef.current,
				);
				await closeSessionRef.current();
			})();
		};
	}, [logger]);

	// ============================================================
	// Effects - ACP Adapter Callbacks
	// ============================================================
	// Register unified session update callback
	useEffect(() => {
		acpAdapter.onSessionUpdate((update) => {
			// Filter by sessionId - ignore updates from old sessions
			if (session.sessionId && update.sessionId !== session.sessionId) {
				logger.log(
					`[useChatController] Ignoring update for old session: ${update.sessionId} (current: ${session.sessionId})`,
				);
				return;
			}

			// During session/load, ignore history replay messages but process session-level updates
			if (isLoadingSessionHistory) {
				// Only process session-level updates during load
				if (update.type === "available_commands_update") {
					agentSession.updateAvailableCommands(update.commands);
				} else if (update.type === "current_mode_update") {
					agentSession.updateCurrentMode(update.currentModeId);
				} else if (update.type === "current_remote_agent_update") {
					agentSession.updateCurrentRemoteAgent(
						update.currentRemoteAgentId,
					);
				}
				// Ignore all message-related updates (history replay)
				return;
			}

			// Route message-related updates to useChat
			chat.handleSessionUpdate(update);

			// Route session-level updates to useAgentSession
			if (update.type === "available_commands_update") {
				agentSession.updateAvailableCommands(update.commands);
			} else if (update.type === "current_mode_update") {
				agentSession.updateCurrentMode(update.currentModeId);
			} else if (update.type === "current_remote_agent_update") {
				agentSession.updateCurrentRemoteAgent(
					update.currentRemoteAgentId,
				);
			}
		});
	}, [
		acpAdapter,
		session.sessionId,
		logger,
		isLoadingSessionHistory,
		chat.handleSessionUpdate,
		agentSession.updateAvailableCommands,
		agentSession.updateCurrentMode,
		agentSession.updateCurrentRemoteAgent,
	]);

	// Register updateMessage callback for permission UI updates
	useEffect(() => {
		acpAdapter.setUpdateMessageCallback(chat.updateMessage);
	}, [acpAdapter, chat.updateMessage]);

	// ============================================================
	// Effects - Save Session Messages on Turn End
	// ============================================================
	const prevIsSendingRef = useRef<boolean>(false);
	const notifiedPermissionRequestIdsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		notifiedPermissionRequestIdsRef.current.clear();
	}, [session.sessionId]);

	useEffect(() => {
		const wasSending = prevIsSendingRef.current;
		prevIsSendingRef.current = isSending;

		// Save when turn ends (isSending: true → false) and has messages
		if (
			wasSending &&
			!isSending &&
			session.sessionId &&
			messages.length > 0
		) {
			sessionHistory.saveSessionMessages(session.sessionId, messages);
			logger.log(
				`[useChatController] Session messages saved: ${session.sessionId}`,
			);

			if (hasAssistantResponseInLatestTurn(messages)) {
				notifyWindowsChatEvent({
					mode: settings.windowsNotificationMode as ChatNotificationMode,
					eventType: "response-complete",
					conversationTitle: extractConversationTitle(messages),
					logger,
				});
			}
		}
	}, [
		isSending,
		session.sessionId,
		messages,
		sessionHistory,
		settings.windowsNotificationMode,
		logger,
	]);

	useEffect(() => {
		const activePermission = permission.activePermission;
		if (!activePermission) {
			return;
		}

		if (
			notifiedPermissionRequestIdsRef.current.has(
				activePermission.requestId,
			)
		) {
			return;
		}

		notifiedPermissionRequestIdsRef.current.add(activePermission.requestId);

		notifyWindowsChatEvent({
			mode: settings.windowsNotificationMode as ChatNotificationMode,
			eventType: "permission-request",
			conversationTitle: extractConversationTitle(messages),
			logger,
		});
	}, [
		permission.activePermission,
		settings.windowsNotificationMode,
		messages,
		logger,
	]);

	// ============================================================
	// Effects - Auto-mention Active Note Tracking
	// ============================================================
	useEffect(() => {
		let isMounted = true;

		const refreshActiveNote = async () => {
			if (!isMounted) return;
			await autoMention.updateActiveNote();
		};

		const unsubscribe = vaultAccessAdapter.subscribeSelectionChanges(() => {
			void refreshActiveNote();
		});

		void refreshActiveNote();

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [autoMention.updateActiveNote, vaultAccessAdapter]);

	// ============================================================
	// Return
	// ============================================================
	return {
		// Services & Adapters
		logger,
		vaultPath,
		acpAdapter,
		vaultAccessAdapter,
		noteMentionService,

		// Settings & State
		settings,
		session,
		isSessionReady,
		messages,
		isSending,
		isLoadingSessionHistory,

		// Hook returns
		permission,
		mentions,
		autoMention,
		slashCommands,
		sessionHistory,
		autoExport,

		// Computed values
		activeAgentLabel,
		availableAgents,
		errorInfo,

		// Core callbacks
		handleSendMessage,
		handleStopGeneration,
		handleNewChat,
		handleExportChat,
		handleSwitchAgent,
		handleRestartAgent,
		handleClearError,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleOpenHistory,
		handleSetMode,
		handleSetModel,
		handleSetRemoteAgent,
		handleCompactHistory,
		handleTruncateHistory,
		activeElicitation,
		handleSubmitElicitation,

		// Input state
		inputValue,
		setInputValue,
		attachedImages,
		setAttachedImages,
		restoredMessage,
		handleRestoredMessageConsumed,

		// History modal management
		historyModalRef,
	};
}
