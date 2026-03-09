import * as React from "react";
const { useRef, useState, useEffect, useCallback } = React;

import type { ChatMessage } from "../../domain/models/chat-message";
import type { IAcpClient } from "../../adapters/acp/acp.adapter";
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
	/** ACP client for terminal operations */
	acpClient?: IAcpClient;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	/** Whether there is an active (pending) permission request */
	hasActivePermission?: boolean;
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
	onApprovePermission,
	hasActivePermission = false,
}: ChatMessagesProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [isPermissionVisible, setIsPermissionVisible] = useState(true);

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
	 * Check if the active permission request element is visible in the container.
	 */
	const checkPermissionVisibility = useCallback(() => {
		if (!hasActivePermission) {
			setIsPermissionVisible(true);
			return;
		}
		const container = containerRef.current;
		if (!container) return;

		const permEl = container.querySelector(
			".agent-client-message-permission-request-options",
		);
		if (!permEl) {
			setIsPermissionVisible(false);
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const permRect = permEl.getBoundingClientRect();
		const isVisible =
			permRect.top < containerRect.bottom &&
			permRect.bottom > containerRect.top;
		setIsPermissionVisible(isVisible);
	}, [hasActivePermission]);

	/**
	 * Scroll to the bottom of the container (instant, used for auto-scroll).
	 */
	const scrollToBottom = useCallback(() => {
		const container = containerRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}, []);

	/**
	 * Scroll smoothly to the bottom of the container (used for button click).
	 */
	const handleScrollToBottomClick = useCallback(() => {
		const container = containerRef.current;
		if (container) {
			container.scrollTo({
				top: container.scrollHeight,
				behavior: "smooth",
			});
		}
	}, []);

	/**
	 * Scroll to the active permission request element.
	 */
	const scrollToPermission = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		const permEl = container.querySelector(
			".agent-client-message-permission-request-options",
		);
		if (permEl) {
			permEl.scrollIntoView({ behavior: "smooth", block: "center" });
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

	// Re-check permission visibility when active permission state changes
	useEffect(() => {
		// Use setTimeout to ensure DOM has updated before checking visibility
		window.setTimeout(() => {
			checkPermissionVisibility();
		}, 0);
	}, [hasActivePermission, messages, checkPermissionVisibility]);

	// Set up scroll event listener
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handleScroll = () => {
			checkIfAtBottom();
			checkPermissionVisibility();
		};

		view.registerDomEvent(container, "scroll", handleScroll);

		// Initial check
		checkIfAtBottom();
		checkPermissionVisibility();
	}, [view, checkIfAtBottom, checkPermissionVisibility]);

	return (
		<div ref={containerRef} className="agent-client-chat-view-messages">
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
					{(hasActivePermission && !isPermissionVisible) ||
					!isAtBottom ? (
						<div className="agent-client-chat-scroll-buttons">
							{hasActivePermission && !isPermissionVisible && (
								<button
									className="agent-client-scroll-to-permission"
									onClick={scrollToPermission}
									ref={(el) => {
										if (el) setIcon(el, "shield-alert");
									}}
								/>
							)}
							{!isAtBottom && (
								<button
									className="agent-client-scroll-to-bottom"
									onClick={handleScrollToBottomClick}
									ref={(el) => {
										if (el) setIcon(el, "chevron-down");
									}}
								/>
							)}
						</div>
					) : null}
				</>
			)}
		</div>
	);
}
