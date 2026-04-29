import * as React from "react";
import { useRef, useState } from "react";
import { Menu, setIcon } from "obsidian";
import { HeaderButton } from "./HeaderButton";

// Agent info for display
interface AgentInfo {
	id: string;
	displayName: string;
}

/**
 * Props for InlineHeader component
 */
export interface InlineHeaderProps {
	/** Display name of the active agent */
	agentLabel: string;
	/** Available agents for switching */
	availableAgents: AgentInfo[];
	/** Current agent ID */
	currentAgentId: string;
	/** Whether there are messages to export */
	hasMessages: boolean;
	/** Callback to switch agent */
	onAgentChange: (agentId: string) => void;
	/** Callback to create a new session */
	onNewSession: () => void;
	/** Callback to open session history */
	onOpenHistory: () => void;
	/** Callback to compact session context */
	onCompactHistory?: () => void;
	/** Callback to truncate session history */
	onTruncateHistory?: () => void;
	/** Callback to export the chat */
	onExportChat: () => void;
	/** Callback to restart agent */
	onRestartAgent: () => void;
	/** Whether session history button should be shown */
	showHistoryButton?: boolean;
	/** Whether session history button is enabled */
	isHistoryEnabled?: boolean;
	/** View variant (TODO(code-block): "codeblock" for future code block chat view) */
	variant: "floating" | "codeblock";
	/** Callback to open new window (floating only) */
	onOpenNewWindow?: () => void;
	/** Callback to close window (floating only) */
	onClose?: () => void;
}

/**
 * Inline header component for Floating and CodeBlock chat views.
 *
 * Features:
 * - Agent selector
 * - Update notification (if available)
 * - Action buttons with Lucide icons (new chat, history, export, restart)
 * - Close button (floating variant only)
 */
export function InlineHeader({
	agentLabel,
	availableAgents,
	currentAgentId,
	hasMessages,
	onAgentChange,
	onNewSession,
	onOpenHistory,
	onCompactHistory,
	onTruncateHistory,
	onExportChat,
	onRestartAgent,
	showHistoryButton = true,
	isHistoryEnabled = true,
	variant,
	onOpenNewWindow,
	onClose,
}: InlineHeaderProps) {
	// Refs for agent selector button
	const agentButtonRef = useRef<HTMLDivElement>(null);
	const [, setIsDropdownOpen] = useState(false);

	// Handle agent selector click
	const handleAgentSelectorClick = () => {
		if (!agentButtonRef.current) return;

		const menu = new Menu();

		for (const agent of availableAgents) {
			const isActive = agent.id === currentAgentId;
			menu.addItem((item) => {
				item.setTitle(agent.displayName)
					.setIcon(isActive ? "check" : "")
					.onClick(() => {
						onAgentChange(agent.id);
						setIsDropdownOpen(false);
					});
			});
		}

		const rect = agentButtonRef.current.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom + 5 });
		setIsDropdownOpen(true);
	};

	return (
		<div
			className={`agent-client-inline-header agent-client-inline-header-${variant}`}
		>
			<div className="agent-client-inline-header-main">
				{availableAgents.length > 1 ? (
					<div
						ref={agentButtonRef}
						className="agent-client-agent-selector"
						onClick={handleAgentSelectorClick}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleAgentSelectorClick();
							}
						}}
					>
						<span className="agent-client-agent-selector-text">
							{agentLabel}
						</span>
						<span
							className="agent-client-agent-selector-icon"
							ref={(el) => {
								if (el) setIcon(el, "chevron-down");
							}}
						/>
					</div>
				) : (
					<span className="agent-client-agent-label">
						{agentLabel}
					</span>
				)}
			</div>
			<div className="agent-client-inline-header-actions">
				<HeaderButton
					iconName="plus"
					tooltip="New session"
					onClick={onNewSession}
				/>
				{showHistoryButton && (
					<HeaderButton
						iconName="history"
						tooltip="Session history"
						onClick={onOpenHistory}
						disabled={!isHistoryEnabled}
					/>
				)}
				{onCompactHistory && (
					<HeaderButton
						iconName="minimize-2"
						tooltip="Compact session context"
						onClick={onCompactHistory}
						disabled={!isHistoryEnabled}
					/>
				)}
				{onTruncateHistory && (
					<HeaderButton
						iconName="scissors"
						tooltip="Truncate history..."
						onClick={onTruncateHistory}
						disabled={!isHistoryEnabled}
					/>
				)}
				<HeaderButton
					iconName="save"
					tooltip="Export chat to Markdown"
					onClick={onExportChat}
					disabled={!hasMessages}
				/>
				{/* <HeaderButton
					iconName="rotate-cw"
					tooltip="Restart agent"
					onClick={onRestartAgent}
				/> */}
				{variant === "floating" && onOpenNewWindow && (
					<HeaderButton
						iconName="copy-plus"
						tooltip="Open new floating chat"
						onClick={onOpenNewWindow}
					/>
				)}
				{variant === "floating" && onClose && (
					<HeaderButton
						iconName="x"
						tooltip="Close"
						onClick={onClose}
					/>
				)}
			</div>
		</div>
	);
}
