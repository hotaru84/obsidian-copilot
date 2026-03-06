import { useState, useCallback, useMemo } from "react";
import type {
	ChatMessage,
	MessageContent,
	ToolCallStatus,
} from "../domain/models/chat-message";
import type { SessionUpdate } from "../domain/models/session-update";
import type { IAgentClient } from "../domain/ports/agent-client.port";
import type { IVaultAccess } from "../domain/ports/vault-access.port";
import type { NoteMetadata } from "../domain/ports/vault-access.port";
import type { AuthenticationMethod } from "../domain/models/chat-session";
import type { ErrorInfo } from "../domain/models/agent-error";
import type { ImagePromptContent } from "../domain/models/prompt-content";
import type { IMentionService } from "../shared/mention-utils";
import { preparePrompt, sendPreparedPrompt } from "../shared/message-service";
import { Platform } from "obsidian";

// ============================================================================
// Types
// ============================================================================

/** Tool call content type extracted for type safety */
type ToolCallMessageContent = Extract<MessageContent, { type: "tool_call" }>;

/**
 * Options for sending a message.
 */
export interface SendMessageOptions {
	/** Currently active note for auto-mention */
	activeNote: NoteMetadata | null;
	/** Vault base path for mention resolution */
	vaultBasePath: string;
	/** Whether auto-mention is temporarily disabled */
	isAutoMentionDisabled?: boolean;
	/** Attached images */
	images?: ImagePromptContent[];
}

/**
 * Return type for useChat hook.
 */
export interface UseChatReturn {
	/** All messages in the current chat session */
	messages: ChatMessage[];
	/** Whether a message is currently being sent */
	isSending: boolean;
	/** Last user message (can be restored after cancel) */
	lastUserMessage: string | null;
	/** Error information from message operations */
	errorInfo: ErrorInfo | null;

	/**
	 * Send a message to the agent.
	 * @param content - Message content
	 * @param options - Message options (activeNote, vaultBasePath, etc.)
	 */
	sendMessage: (
		content: string,
		options: SendMessageOptions,
	) => Promise<void>;

	/**
	 * Clear all messages (e.g., when starting a new session).
	 */
	clearMessages: () => void;

	/**
	 * Set initial messages from loaded session history.
	 * Converts conversation history to ChatMessage format.
	 * @param history - Conversation history from loadSession
	 */
	setInitialMessages: (
		history: Array<{
			role: string;
			content: Array<{ type: string; text: string }>;
			timestamp?: string;
		}>,
	) => void;

	/**
	 * Set messages directly from local storage.
	 * Unlike setInitialMessages which converts from ACP history format,
	 * this accepts ChatMessage[] as-is (for resume/fork operations).
	 * @param localMessages - Chat messages from local storage
	 */
	setMessagesFromLocal: (localMessages: ChatMessage[]) => void;

	/**
	 * Clear the current error.
	 */
	clearError: () => void;

	/**
	 * Callback to add a new message.
	 * Used by AcpAdapter when receiving agent messages.
	 */
	addMessage: (message: ChatMessage) => void;

	/**
	 * Callback to update the last message content.
	 * Used by AcpAdapter for streaming text updates.
	 */
	updateLastMessage: (content: MessageContent) => void;

	/**
	 * Callback to update a specific message by tool call ID.
	 * Used by AcpAdapter for tool call status updates.
	 */
	updateMessage: (toolCallId: string, content: MessageContent) => void;

	/**
	 * Callback to upsert a tool call message.
	 * If a tool call with the given ID exists, it will be updated.
	 * Otherwise, a new message will be created.
	 * Used by AcpAdapter for tool_call and tool_call_update events.
	 */
	upsertToolCall: (toolCallId: string, content: MessageContent) => void;

	/**
	 * Handle a session update from the agent.
	 * This is the unified handler for all session update events.
	 * Should be registered with agentClient.onSessionUpdate().
	 */
	handleSessionUpdate: (update: SessionUpdate) => void;
}

/**
 * Session context required for sending messages.
 */
export interface SessionContext {
	sessionId: string | null;
	authMethods: AuthenticationMethod[];
	/** Prompt capabilities from agent initialization */
	promptCapabilities?: {
		image?: boolean;
		audio?: boolean;
		embeddedContext?: boolean;
	};
}

/**
 * Settings context required for message preparation.
 */
export interface SettingsContext {
	windowsWslMode: boolean;
	maxNoteLength: number;
	maxSelectionLength: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a permission request is completed (approved or cancelled).
 * Completed requests should not be overwritten by new permission requests.
 */
function isPermissionRequestCompleted(permissionRequest?: {
	requestId: string;
	selectedOptionId?: string;
	isCancelled?: boolean;
}): boolean {
	if (!permissionRequest) return false;
	return (
		permissionRequest.selectedOptionId !== undefined ||
		permissionRequest.isCancelled === true
	);
}

/**
 * Merge new tool call content into existing tool call.
 * Preserves existing values when new values are undefined.
 *
 * Special handling for permission requests:
 * - Completed requests (with selectedOptionId or isCancelled) are protected
 * - A new permission request with a different requestId will not overwrite a completed one
 * - Updates with the same requestId are allowed (for state transitions)
 * - This prevents stacked permission requests from interfering with each other
 */
function mergeToolCallContent(
	existing: ToolCallMessageContent,
	update: ToolCallMessageContent,
): ToolCallMessageContent {
	// Merge content arrays
	let mergedContent = existing.content || [];
	if (update.content !== undefined) {
		const newContent = update.content || [];

		// If new content contains diff, replace all old diffs
		const hasDiff = newContent.some((item) => item.type === "diff");
		if (hasDiff) {
			mergedContent = mergedContent.filter(
				(item) => item.type !== "diff",
			);
		}

		mergedContent = [...mergedContent, ...newContent];
	}

	// Smart merge for permission requests.
	//
	// Decision pivot: update.isActive
	//
	//   isActive: true  → ALWAYS apply.
	//     Two callers set isActive:true:
	//       (a) requestPermission() when the queue was empty — show first request immediately.
	//       (b) activateNextPermission() — promotes the next queued request. This now uses
	//           requestId as a synthetic toolCallId, so it always creates a NEW message and
	//           will never reach this merge path for a completed permission.
	//     A fresh requestPermission() from the agent (same toolCallId, new requestId) MUST
	//     overwrite the completed state so the new permission becomes visible to the user.
	//
	//   isActive: false / undefined → protect existing state when warranted.
	//     If the existing request is active (buttons visible) or completed (response shown)
	//     AND the update carries a different requestId (i.e. a queued-but-not-yet-active
	//     permission from a 2nd/3rd requestPermission call), keep the existing request.
	//     The adapter's pendingPermissionQueue already holds the new request and will
	//     surface it via activateNextPermission() once the current one resolves.
	let finalPermissionRequest = existing.permissionRequest;
	if (update.permissionRequest !== undefined) {
		const existingPerm = existing.permissionRequest;
		const updatePerm = update.permissionRequest;

		if (updatePerm.isActive) {
			// isActive:true — always apply (first request, activateNextPermission, or
			// a fresh second requestPermission call on the same toolCallId)
			finalPermissionRequest = updatePerm;
		} else if (
			existingPerm &&
			existingPerm.requestId !== updatePerm.requestId &&
			(isPermissionRequestCompleted(existingPerm) ||
				existingPerm.isActive)
		) {
			// isActive:false with a different requestId arriving while existing is
			// active or completed — this is a queued secondary request; keep existing.
			finalPermissionRequest = existingPerm;
		} else {
			// Same requestId state-transition OR existing has no active/completed state.
			finalPermissionRequest = updatePerm;
		}
	}

	// Status must only move forward: pending → in_progress → completed/failed.
	// Never allow a regression (e.g., in_progress → pending caused by a null-status
	// tool_call_update that the adapter defaulted to "pending").
	const STATUS_ORDER: Record<ToolCallStatus, number> = {
		pending: 0,
		in_progress: 1,
		completed: 2,
		failed: 2,
	};
	const candidateStatus =
		update.status !== undefined ? update.status : existing.status;
	const mergedStatus =
		(STATUS_ORDER[candidateStatus] ?? 0) >=
		(STATUS_ORDER[existing.status] ?? 0)
			? candidateStatus
			: existing.status;

	return {
		...existing,
		toolCallId: update.toolCallId,
		title: update.title !== undefined ? update.title : existing.title,
		kind: update.kind !== undefined ? update.kind : existing.kind,
		status: mergedStatus,
		content: mergedContent,
		locations:
			update.locations !== undefined
				? update.locations
				: existing.locations,
		rawInput:
			update.rawInput !== undefined &&
			Object.keys(update.rawInput).length > 0
				? update.rawInput
				: existing.rawInput,
		permissionRequest: finalPermissionRequest,
	};
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing chat messages and message sending.
 *
 * This hook owns:
 * - Message history (messages array)
 * - Sending state (isSending flag)
 * - Message operations (send, add, update)
 *
 * It provides callbacks (addMessage, updateLastMessage, updateMessage) that
 * should be passed to AcpAdapter.setMessageCallbacks() for receiving
 * agent responses.
 *
 * @param agentClient - Agent client for sending messages
 * @param vaultAccess - Vault access for reading notes
 * @param mentionService - Mention service for parsing mentions
 * @param sessionContext - Session information (sessionId, authMethods)
 * @param settingsContext - Settings information (windowsWslMode)
 */
export function useChat(
	agentClient: IAgentClient,
	vaultAccess: IVaultAccess,
	mentionService: IMentionService,
	sessionContext: SessionContext,
	settingsContext: SettingsContext,
): UseChatReturn {
	// Message state
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isSending, setIsSending] = useState(false);
	const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
	const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

	/**
	 * Add a new message to the chat.
	 */
	const addMessage = useCallback((message: ChatMessage): void => {
		setMessages((prev) => [...prev, message]);
	}, []);

	/**
	 * Update the last message in the chat.
	 * Creates a new assistant message if needed.
	 */
	const updateLastMessage = useCallback((content: MessageContent): void => {
		setMessages((prev) => {
			// If no messages or last message is not assistant, create new assistant message
			if (
				prev.length === 0 ||
				prev[prev.length - 1].role !== "assistant"
			) {
				const newMessage: ChatMessage = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: [content],
					timestamp: new Date(),
				};
				return [...prev, newMessage];
			}

			// Update existing last message
			const lastMessage = prev[prev.length - 1];
			const updatedMessage = { ...lastMessage };

			if (content.type === "text" || content.type === "agent_thought") {
				// Append to existing content of same type or create new content
				const existingContentIndex = updatedMessage.content.findIndex(
					(c) => c.type === content.type,
				);
				if (existingContentIndex >= 0) {
					const existingContent =
						updatedMessage.content[existingContentIndex];
					// Type guard: we know it's text or agent_thought from findIndex condition
					if (
						existingContent.type === "text" ||
						existingContent.type === "agent_thought"
					) {
						updatedMessage.content[existingContentIndex] = {
							type: content.type,
							text: existingContent.text + content.text,
						};
					}
				} else {
					updatedMessage.content.push(content);
				}
			} else {
				// Replace or add non-text content
				const existingIndex = updatedMessage.content.findIndex(
					(c) => c.type === content.type,
				);

				if (existingIndex >= 0) {
					updatedMessage.content[existingIndex] = content;
				} else {
					updatedMessage.content.push(content);
				}
			}

			return [...prev.slice(0, -1), updatedMessage];
		});
	}, []);

	/**
	 * Update or create the last user message with new content.
	 * Used for session/load to reconstruct user messages from chunks.
	 *
	 * Similar to updateLastMessage but targets "user" role instead of "assistant".
	 */
	const updateUserMessage = useCallback((content: MessageContent): void => {
		setMessages((prev) => {
			// If no messages or last message is not user, create new user message
			if (prev.length === 0 || prev[prev.length - 1].role !== "user") {
				const newMessage: ChatMessage = {
					id: crypto.randomUUID(),
					role: "user",
					content: [content],
					timestamp: new Date(),
				};
				return [...prev, newMessage];
			}

			// Update existing last message
			const lastMessage = prev[prev.length - 1];
			const updatedMessage = { ...lastMessage };

			if (content.type === "text") {
				// Append to existing text content or create new
				const existingContentIndex = updatedMessage.content.findIndex(
					(c) => c.type === "text",
				);
				if (existingContentIndex >= 0) {
					const existingContent =
						updatedMessage.content[existingContentIndex];
					if (existingContent.type === "text") {
						updatedMessage.content[existingContentIndex] = {
							type: "text",
							text: existingContent.text + content.text,
						};
					}
				} else {
					updatedMessage.content.push(content);
				}
			} else {
				// Replace or add non-text content
				const existingIndex = updatedMessage.content.findIndex(
					(c) => c.type === content.type,
				);
				if (existingIndex >= 0) {
					updatedMessage.content[existingIndex] = content;
				} else {
					updatedMessage.content.push(content);
				}
			}

			return [...prev.slice(0, -1), updatedMessage];
		});
	}, []);

	/**
	 * Update a specific message by tool call ID.
	 *
	 * Note: This searches ALL messages and updates every tool call with matching toolCallId.
	 * When the same toolCallId is reused across multiple permission requests, mergeToolCallContent
	 * will protect completed requests (with selectedOptionId or isCancelled) from being overwritten
	 * by different requestIds.
	 *
	 * This allows multiple permission requests to stack safely without interfering with each other.
	 */
	const updateMessage = useCallback(
		(toolCallId: string, content: MessageContent): void => {
			if (content.type !== "tool_call") return;

			setMessages((prev) =>
				prev.map((message) => ({
					...message,
					content: message.content.map((c) => {
						if (
							c.type === "tool_call" &&
							c.toolCallId === toolCallId
						) {
							return mergeToolCallContent(c, content);
						}
						return c;
					}),
				})),
			);
		},
		[],
	);

	/**
	 * Upsert a tool call message.
	 * If a tool call with the given ID exists, it will be updated (merged).
	 * Otherwise, a new assistant message will be created.
	 * All logic is inside setMessages callback to avoid race conditions.
	 *
	 * When a permission request is added or updated, the message containing
	 * that tool call is moved to the end of the message array to ensure it
	 * appears as the latest message in the chat.
	 *
	 * Protection for stacked permission requests:
	 * - mergeToolCallContent protects completed permission requests from being overwritten
	 * - Multiple permission requests with the same toolCallId can coexist independently
	 * - Each permission request is identified by its unique requestId
	 * - Only active (isActive=true) permission requests trigger message reordering
	 *
	 * Fresh permission after completed permission (same toolCallId, new requestId):
	 * - When the agent reuses the same toolCallId across sequential tool calls,
	 *   a fresh permission request (isActive=true, new requestId) must NOT be merged
	 *   into a message that already has a completed permission. Instead, a new message
	 *   is created so both the completed state and the new request remain visible.
	 */
	const upsertToolCall = useCallback(
		(toolCallId: string, content: MessageContent): void => {
			if (content.type !== "tool_call") return;

			// Detect whether the incoming update is a fresh permission request
			// (isActive=true with a requestId different from any already-completed permission).
			// In that case we must NOT merge into an existing message that holds a completed
			// permission; instead we fall through to "not found" and create a new message.
			const incomingPerm = content.permissionRequest;
			const isFreshActivePermission =
				incomingPerm?.isActive === true &&
				incomingPerm?.requestId !== undefined;

			setMessages((prev) => {
				// Try to find existing tool call
				let found = false;
				let messageIndexToMove = -1;
				const updated = prev.map((message, index) => ({
					...message,
					content: message.content.map((c) => {
						if (
							c.type === "tool_call" &&
							c.toolCallId === toolCallId
						) {
							// If this update carries a fresh active permission (new requestId)
							// and the existing tool call already has a completed permission
							// with a different requestId, skip this match so a new message
							// is created instead. This prevents the completed permission from
							// being overwritten and keeps both entries visible in the chat.
							if (
								isFreshActivePermission &&
								c.permissionRequest &&
								isPermissionRequestCompleted(
									c.permissionRequest,
								) &&
								c.permissionRequest.requestId !==
									incomingPerm!.requestId
							) {
								return c; // leave this message unchanged
							}

							found = true;
							const merged = mergeToolCallContent(c, content);
							// If this update adds an active permission request,
							// mark this message to be moved to the end
							if (merged.permissionRequest?.isActive) {
								messageIndexToMove = index;
							}
							return merged;
						}
						return c;
					}),
				}));

				if (found) {
					// If we need to move the message with active permission to the end
					if (messageIndexToMove >= 0) {
						const messageToMove = updated[messageIndexToMove];
						return [
							...updated.slice(0, messageIndexToMove),
							...updated.slice(messageIndexToMove + 1),
							messageToMove,
						];
					}
					return updated;
				}

				// Not found - create new message
				return [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant" as const,
						content: [content],
						timestamp: new Date(),
					},
				];
			});
		},
		[],
	);

	/**
	 * Handle a session update from the agent.
	 * This is the unified handler for all session update events.
	 *
	 * Note: available_commands_update and current_mode_update are not handled here
	 * as they are session-level updates, not message-level updates.
	 * They should be handled by useAgentSession.
	 */
	const handleSessionUpdate = useCallback(
		(update: SessionUpdate): void => {
			switch (update.type) {
				case "agent_message_chunk":
					updateLastMessage({
						type: "text",
						text: update.text,
					});
					break;

				case "agent_thought_chunk":
					updateLastMessage({
						type: "agent_thought",
						text: update.text,
					});
					break;

				case "user_message_chunk":
					updateUserMessage({
						type: "text",
						text: update.text,
					});
					break;

				case "tool_call":
					upsertToolCall(update.toolCallId, {
						type: "tool_call",
						toolCallId: update.toolCallId,
						title: update.title,
						status: update.status || "pending",
						kind: update.kind,
						content: update.content,
						locations: update.locations,
						rawInput: update.rawInput,
						permissionRequest: update.permissionRequest,
					});
					break;

				case "tool_call_update":
					// status may be undefined (no change intended); fall back to "pending"
					// only as a last resort — mergeToolCallContent's forward-only guard
					// ensures existing statuses never regress.
					upsertToolCall(update.toolCallId, {
						type: "tool_call",
						toolCallId: update.toolCallId,
						title: update.title,
						status: update.status ?? "pending",
						kind: update.kind,
						content: update.content,
						locations: update.locations,
						rawInput: update.rawInput,
						permissionRequest: update.permissionRequest,
					});
					break;

				case "plan":
					updateLastMessage({
						type: "plan",
						entries: update.entries,
					});
					break;

				// Session-level updates are handled elsewhere (useAgentSession)
				case "available_commands_update":
				case "current_mode_update":
					// These are intentionally not handled here
					break;
			}
		},
		[updateLastMessage, upsertToolCall],
	);

	/**
	 * Clear all messages.
	 */
	const clearMessages = useCallback((): void => {
		setMessages([]);
		setLastUserMessage(null);
		setIsSending(false);
		setErrorInfo(null);
	}, []);

	/**
	 * Set initial messages from loaded session history.
	 * Converts conversation history to ChatMessage format.
	 */
	const setInitialMessages = useCallback(
		(
			history: Array<{
				role: string;
				content: Array<{ type: string; text: string }>;
				timestamp?: string;
			}>,
		): void => {
			// Convert conversation history to ChatMessage format
			const chatMessages: ChatMessage[] = history.map((msg) => ({
				id: crypto.randomUUID(),
				role: msg.role as "user" | "assistant",
				content: msg.content.map((c) => ({
					type: c.type as "text",
					text: c.text,
				})),
				timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
			}));

			setMessages(chatMessages);
			setIsSending(false);
			setErrorInfo(null);
		},
		[],
	);

	/**
	 * Set messages directly from local storage.
	 * Unlike setInitialMessages which converts from ACP history format,
	 * this accepts ChatMessage[] as-is (for resume/fork operations).
	 */
	const setMessagesFromLocal = useCallback(
		(localMessages: ChatMessage[]): void => {
			setMessages(localMessages);
			setIsSending(false);
			setErrorInfo(null);
		},
		[],
	);

	/**
	 * Clear the current error.
	 */
	const clearError = useCallback((): void => {
		setErrorInfo(null);
	}, []);

	/**
	 * Check if paths should be converted to WSL format.
	 */
	const shouldConvertToWsl = useMemo(() => {
		return Platform.isWin && settingsContext.windowsWslMode;
	}, [settingsContext.windowsWslMode]);

	/**
	 * Send a message to the agent.
	 */
	const sendMessage = useCallback(
		async (content: string, options: SendMessageOptions): Promise<void> => {
			// Guard: Need session ID to send
			if (!sessionContext.sessionId) {
				setErrorInfo({
					title: "Cannot Send Message",
					message: "No active session. Please wait for connection.",
				});
				return;
			}

			// Phase 1: Prepare prompt using message-service
			const prepared = await preparePrompt(
				{
					message: content,
					images: options.images,
					activeNote: options.activeNote,
					vaultBasePath: options.vaultBasePath,
					isAutoMentionDisabled: options.isAutoMentionDisabled,
					convertToWsl: shouldConvertToWsl,
					supportsEmbeddedContext:
						sessionContext.promptCapabilities?.embeddedContext ??
						false,
					maxNoteLength: settingsContext.maxNoteLength,
					maxSelectionLength: settingsContext.maxSelectionLength,
				},
				vaultAccess,
				mentionService,
			);

			// Phase 2: Build user message for UI
			const userMessageContent: MessageContent[] = [];

			// Text part (with or without auto-mention context)
			if (prepared.autoMentionContext) {
				userMessageContent.push({
					type: "text_with_context",
					text: content,
					autoMentionContext: prepared.autoMentionContext,
				});
			} else {
				userMessageContent.push({
					type: "text",
					text: content,
				});
			}

			// Image parts
			if (options.images && options.images.length > 0) {
				for (const img of options.images) {
					userMessageContent.push({
						type: "image",
						data: img.data,
						mimeType: img.mimeType,
					});
				}
			}

			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: userMessageContent,
				timestamp: new Date(),
			};
			addMessage(userMessage);

			// Phase 3: Set sending state and store original message
			setIsSending(true);
			setLastUserMessage(content);

			// Phase 4: Send prepared prompt to agent using message-service
			try {
				const result = await sendPreparedPrompt(
					{
						sessionId: sessionContext.sessionId,
						agentContent: prepared.agentContent,
						displayContent: prepared.displayContent,
						authMethods: sessionContext.authMethods,
					},
					agentClient,
				);

				if (result.success) {
					// Success - clear stored message
					setIsSending(false);
					setLastUserMessage(null);
				} else {
					// Error from message-service
					setIsSending(false);
					setErrorInfo(
						result.error
							? {
									title: result.error.title,
									message: result.error.message,
									suggestion: result.error.suggestion,
								}
							: {
									title: "Send Message Failed",
									message: "Failed to send message",
								},
					);
				}
			} catch (error) {
				// Unexpected error
				setIsSending(false);
				setErrorInfo({
					title: "Send Message Failed",
					message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
				});
			}
		},
		[
			agentClient,
			vaultAccess,
			mentionService,
			sessionContext.sessionId,
			sessionContext.authMethods,
			sessionContext.promptCapabilities,
			shouldConvertToWsl,
			addMessage,
		],
	);

	return {
		messages,
		isSending,
		lastUserMessage,
		errorInfo,
		sendMessage,
		clearMessages,
		setInitialMessages,
		setMessagesFromLocal,
		clearError,
		addMessage,
		updateLastMessage,
		updateMessage,
		upsertToolCall,
		handleSessionUpdate,
	};
}
