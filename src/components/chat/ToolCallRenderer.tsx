import * as React from "react";
const { useState } = React;
import type { MessageContent } from "../../domain/models/chat-message";
import type { IChatAgentClient } from "../../domain/ports/chat-agent-client.port";
import type AgentClientPlugin from "../../plugin";
import { TerminalRenderer } from "./TerminalRenderer";
import { PermissionRequestSection } from "./PermissionRequestSection";
import { getVaultBasePath, toRelativePath } from "../../shared/path-utils";
import { ToolUiDiffCard } from "./tool-ui/ToolUiDiffCard";
// import { MarkdownTextRenderer } from "./MarkdownTextRenderer";

interface ToolCallRendererProps {
	content: Extract<MessageContent, { type: "tool_call" }>;
	plugin: AgentClientPlugin;
	acpClient?: IChatAgentClient;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
}

export function ToolCallRenderer({
	content,
	plugin,
	acpClient,
	onApprovePermission,
}: ToolCallRendererProps) {
	const {
		kind,
		title,
		status,
		toolCallId,
		permissionRequest,
		locations,
		rawInput,
		content: toolContent,
	} = content;

	// Local state for selected option (for immediate UI feedback)
	const [selectedOptionId, setSelectedOptionId] = useState<
		string | undefined
	>(permissionRequest?.selectedOptionId);

	// Update selectedOptionId when permissionRequest changes
	React.useEffect(() => {
		if (permissionRequest?.selectedOptionId !== selectedOptionId) {
			setSelectedOptionId(permissionRequest?.selectedOptionId);
		}
	}, [permissionRequest?.selectedOptionId]);

	// Get vault path for relative path display
	const vaultPath = getVaultBasePath(plugin.app.vault.adapter) || "";

	// Get showEmojis setting
	const showEmojis = plugin.settings.displaySettings.showEmojis;

	// Get icon based on kind
	const getKindIcon = (kind?: string) => {
		if (!showEmojis) return null;

		switch (kind) {
			case "read":
				return "📖";
			case "edit":
				return "✏️";
			case "delete":
				return "🗑️";
			case "move":
				return "📦";
			case "search":
				return "🔍";
			case "execute":
				return "💻";
			case "think":
				return "💭";
			case "fetch":
				return "🌐";
			case "switch_mode":
				return "🔄";
			default:
				return "🔧";
		}
	};

	return (
		<div className="agent-client-message-tool-call agent-client-tool-ui-tool-call">
			{/* Header */}
			<div className="agent-client-message-tool-call-header">
				<div className="agent-client-message-tool-call-title">
					{showEmojis && (
						<span className="agent-client-message-tool-call-icon">
							{getKindIcon(kind)}
						</span>
					)}
					{title}
				</div>
				{kind === "execute" &&
					rawInput &&
					typeof rawInput.command === "string" && (
						<div className="agent-client-message-tool-call-command">
							<code>
								{rawInput.command}
								{Array.isArray(rawInput.args) &&
									rawInput.args.length > 0 &&
									` ${(rawInput.args as string[]).join(" ")}`}
							</code>
						</div>
					)}
				{locations && locations.length > 0 && (
					<div className="agent-client-message-tool-call-locations">
						{locations.map((loc, idx) => (
							<span
								key={idx}
								className="agent-client-message-tool-call-location"
							>
								{toRelativePath(loc.path, vaultPath)}
								{loc.line != null && `:${loc.line}`}
							</span>
						))}
					</div>
				)}
				<div className="agent-client-message-tool-call-status">
					Status: {status}
				</div>
			</div>

			{/* Kind-specific details */}
			{/* kind && (
				<div className="agent-client-message-tool-call-details">
					<ToolCallDetails
						kind={kind}
						locations={locations}
						rawInput={rawInput}
						plugin={plugin}
					/>
				</div>
			)*/}

			{/* Tool call content (diffs, terminal output, etc.) */}
			{toolContent &&
				toolContent.map((item, index) => {
					if (item.type === "terminal") {
						return (
							<TerminalRenderer
								key={index}
								terminalId={item.terminalId}
								acpClient={acpClient || null}
								plugin={plugin}
							/>
						);
					}
					if (item.type === "diff") {
						return (
							<ToolUiDiffCard
								key={index}
								diff={item}
								plugin={plugin}
								autoCollapse={
									plugin.settings.displaySettings
										.autoCollapseDiffs
								}
								collapseThreshold={
									plugin.settings.displaySettings
										.diffCollapseThreshold
								}
							/>
						);
					}
					/*
					if (item.type === "content") {
						// Handle content blocks (text, image, etc.)
						if ("text" in item.content) {
							return (
								<div key={index} className="agent-client-tool-call-content">
									<MarkdownTextRenderer
										text={item.content.text}
										app={plugin.app}
									/>
								</div>
							);
						}
						}*/
					return null;
				})}

			{/* Permission request section */}
			{permissionRequest && (
				<PermissionRequestSection
					permissionRequest={{
						...permissionRequest,
						selectedOptionId: selectedOptionId,
					}}
					toolCallId={toolCallId}
					plugin={plugin}
					onApprovePermission={onApprovePermission}
					onOptionSelected={setSelectedOptionId}
				/>
			)}
		</div>
	);
}
