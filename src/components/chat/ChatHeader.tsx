import * as React from "react";
import { HeaderButton } from "./HeaderButton";

/**
 * Props for ChatHeader component
 */
export interface ChatHeaderProps {
	/** Display name of the active agent */
	agentLabel: string;
	/** Whether session history is supported (show History button) */
	hasHistoryCapability?: boolean;
	/** Callback to show the new chat menu at the click position */
	onShowNewChatMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Callback to export the chat */
	onExportChat: () => void;
	/** Callback to show the header menu at the click position */
	onShowMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Callback to open session history */
	onOpenHistory?: () => void;
}

/**
 * Header component for the chat view.
 *
 * Displays:
 * - Agent name
 * - Update notification (if available)
 * - Action buttons (new chat, history, export, settings)
 */
export function ChatHeader({
	agentLabel,
	hasHistoryCapability = false,
	onShowNewChatMenu,
	onExportChat,
	onShowMenu,
	onOpenHistory,
}: ChatHeaderProps) {
	return (
		<div className="agent-client-chat-view-header">
			<div className="agent-client-chat-view-header-main">
				<h3 className="agent-client-chat-view-header-title">
					{agentLabel}
				</h3>
			</div>
			<div className="agent-client-chat-view-header-actions">
				<HeaderButton
					iconName="plus"
					tooltip="New chat"
					onClick={onShowNewChatMenu}
				/>
				{onOpenHistory && (
					<HeaderButton
						iconName="history"
						tooltip="Session history"
						onClick={onOpenHistory}
					/>
				)}
				<HeaderButton
					iconName="save"
					tooltip="Export chat to Markdown"
					onClick={onExportChat}
				/>
				<HeaderButton
					iconName="more-vertical"
					tooltip="More"
					onClick={onShowMenu}
				/>
			</div>
		</div>
	);
}
