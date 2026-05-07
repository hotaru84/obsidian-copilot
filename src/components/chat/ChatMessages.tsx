import * as React from "react";
const { useRef, useState, useEffect, useCallback } = React;

import type {
	ChatMessage,
	ElicitationResponse,
} from "../../domain/models/chat-message";
import type { SessionUsageMetrics } from "../../domain/models/chat-session";
import type { IChatAgentClient } from "../../domain/ports/chat-agent-client.port";
import type AgentClientPlugin from "../../plugin";
import type { IChatViewHost } from "./types";
import { setIcon } from "obsidian";
import { MessageRenderer } from "./MessageRenderer";

/**
 * Props for ChatMessages component
 */
export interface ChatMessagesProps {
	/** All messages in the current chat session */
	messages: ChatMessage[];
	/** Whether a message is currently being sent */
	isSending: boolean;
	/** Whether the session is ready for user input */
	isSessionReady: boolean;
	/** Whether a session is being restored (load/resume/fork) */
	isRestoringSession: boolean;
	/** Display name of the active agent */
	agentLabel: string;
	/** Plugin instance */
	plugin: AgentClientPlugin;
	/** View instance for event registration */
	view: IChatViewHost;
	/** Agent client for terminal operations */
	acpClient?: IChatAgentClient;
	/** Current session ID (required for usage metrics) */
	sessionId?: string | null;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	/** Callback to submit elicitation responses */
	onSubmitElicitation?: (response: ElicitationResponse) => Promise<void>;
}

/**
 * Messages container component for the chat view.
 *
 * Handles:
 * - Message list rendering
 * - Auto-scroll behavior
 * - Empty state display
 * - Loading indicator
 */
export function ChatMessages({
	messages,
	isSending,
	isSessionReady,
	isRestoringSession,
	agentLabel,
	plugin,
	view,
	acpClient,
	sessionId,
	onApprovePermission,
	onSubmitElicitation,
}: ChatMessagesProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const prevAssistantPhasesRef = useRef<Map<string, string>>(new Map());
	const [responseDurationsByMessageId, setResponseDurationsByMessageId] =
		useState<Record<string, number>>({});
	const [responseMetricsByMessageId, setResponseMetricsByMessageId] =
		useState<Record<string, SessionUsageMetrics | null>>({});

	/**
	 * Check if the scroll position is near the bottom.
	 */
	const checkIfAtBottom = useCallback(() => {
		const container = containerRef.current;
		if (!container) return true;

		const threshold = 20;
		const isNearBottom =
			container.scrollTop + container.clientHeight >=
			container.scrollHeight - threshold;
		setIsAtBottom(isNearBottom);
		return isNearBottom;
	}, []);

	/**
	 * Scroll to the bottom of the container.
	 */
	const scrollToBottom = useCallback(() => {
		const container = containerRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}, []);

	// Auto-scroll when messages change
	useEffect(() => {
		if (isAtBottom && messages.length > 0) {
			// Use setTimeout to ensure DOM has updated
			window.setTimeout(() => {
				scrollToBottom();
			}, 0);
		}
	}, [messages, isAtBottom, scrollToBottom]);

	// Set up scroll event listener
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handleScroll = () => {
			checkIfAtBottom();
		};

		view.registerDomEvent(container, "scroll", handleScroll);

		// Initial check
		checkIfAtBottom();
	}, [view, checkIfAtBottom]);

	// Capture response duration and usage metrics when an assistant message transitions
	// from streaming to completed.
	useEffect(() => {
		const completedTransitions: ChatMessage[] = [];
		const nextPhases = new Map<string, string>();

		for (const message of messages) {
			if (message.role !== "assistant") {
				continue;
			}

			const phase = message.streamingPhase ?? "completed";
			nextPhases.set(message.id, phase);

			const previousPhase = prevAssistantPhasesRef.current.get(
				message.id,
			);
			if (previousPhase === "streaming" && phase === "completed") {
				completedTransitions.push(message);
			}
		}

		prevAssistantPhasesRef.current = nextPhases;

		if (completedTransitions.length === 0) {
			return;
		}

		setResponseDurationsByMessageId((prev) => {
			const next = { ...prev };
			for (const message of completedTransitions) {
				const durationMs = Math.max(
					0,
					Date.now() - message.timestamp.getTime(),
				);
				next[message.id] = durationMs;
			}
			return next;
		});

		if (!acpClient || !sessionId) {
			return;
		}

		void acpClient
			.getUsageMetrics(sessionId)
			.then((metrics) => {
				setResponseMetricsByMessageId((prev) => {
					const next = { ...prev };
					for (const message of completedTransitions) {
						next[message.id] = metrics;
					}
					return next;
				});
			})
			.catch(() => {
				setResponseMetricsByMessageId((prev) => {
					const next = { ...prev };
					for (const message of completedTransitions) {
						next[message.id] = null;
					}
					return next;
				});
			});
	}, [acpClient, messages, sessionId]);

	return (
		<div
			ref={containerRef}
			className="agent-client-chat-view-messages agent-client-tool-ui-chat-messages"
		>
			{messages.length === 0 ? (
				<div className="agent-client-chat-empty-state">
					{isRestoringSession
						? "Restoring session..."
						: !isSessionReady
							? `Connecting to ${agentLabel}...`
							: `Start a conversation with ${agentLabel}...`}
				</div>
			) : (
				<>
					{messages.map((message) => (
						<MessageRenderer
							key={message.id}
							message={message}
							plugin={plugin}
							acpClient={acpClient}
							responseDurationMs={
								responseDurationsByMessageId[message.id]
							}
							responseUsageMetrics={
								responseMetricsByMessageId[message.id]
							}
							onSubmitElicitation={onSubmitElicitation}
							onApprovePermission={onApprovePermission}
						/>
					))}
					<div
						className={`agent-client-loading-indicator ${!isSending ? "agent-client-hidden" : ""}`}
					>
						<div className="agent-client-loading-dots">
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
							<div className="agent-client-loading-dot"></div>
						</div>
					</div>
					{!isAtBottom && (
						<button
							className="agent-client-scroll-to-bottom"
							onClick={() => {
								const container = containerRef.current;
								if (container) {
									container.scrollTo({
										top: container.scrollHeight,
										behavior: "smooth",
									});
								}
							}}
							ref={(el) => {
								if (el) setIcon(el, "chevron-down");
							}}
						/>
					)}
				</>
			)}
		</div>
	);
}
