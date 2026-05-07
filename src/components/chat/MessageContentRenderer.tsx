import * as React from "react";
import type {
	ElicitationResponse,
	MessageContent,
} from "../../domain/models/chat-message";
import type { IChatAgentClient } from "../../domain/ports/chat-agent-client.port";
import type AgentClientPlugin from "../../plugin";
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";
import { CollapsibleThought } from "./CollapsibleThought";
import { TerminalRenderer } from "./TerminalRenderer";
import { TextWithMentions } from "./TextWithMentions";
import { ToolCallRenderer } from "./ToolCallRenderer";
import { ToolUiElicitationCard } from "./tool-ui/ToolUiElicitationCard";

interface MessageContentRendererProps {
	content: MessageContent;
	plugin: AgentClientPlugin;
	messageId?: string;
	messageRole?: "user" | "assistant";
	messageStreamingPhase?: "streaming" | "completed";
	acpClient?: IChatAgentClient;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	/** Callback to submit elicitation responses */
	onSubmitElicitation?: (response: ElicitationResponse) => Promise<void>;
}

export function MessageContentRenderer({
	content,
	plugin,
	messageId,
	messageRole,
	messageStreamingPhase,
	acpClient,
	onApprovePermission,
	onSubmitElicitation,
}: MessageContentRendererProps) {
	const useToolUiRefresh =
		((plugin.settings.displaySettings as Record<string, unknown>)
			.useToolUiRefresh as boolean) === true;
	const showEmojis = plugin.settings.displaySettings.showEmojis;

	switch (content.type) {
		case "text":
			// User messages: render with mention support
			// Assistant messages: render as markdown
			if (messageRole === "user") {
				return <TextWithMentions text={content.text} plugin={plugin} />;
			}
			return <MarkdownTextRenderer text={content.text} plugin={plugin} />;

		case "text_with_context":
			// User messages with auto-mention context
			return (
				<TextWithMentions
					text={content.text}
					autoMentionContext={content.autoMentionContext}
					plugin={plugin}
				/>
			);

		case "agent_thought":
			if (messageStreamingPhase !== "streaming") {
				return null;
			}
			return <CollapsibleThought text={content.text} plugin={plugin} />;

		case "tool_call":
			return (
				<ToolCallRenderer
					content={content}
					plugin={plugin}
					acpClient={acpClient}
					onApprovePermission={onApprovePermission}
				/>
			);

		case "plan": {
			return (
				<div className="agent-client-message-plan agent-client-tool-ui-plan">
					<div className="agent-client-message-plan-title">
						{showEmojis && "📋 "}Plan
					</div>
					{content.entries.map((entry, idx) => (
						<div
							key={idx}
							className={`agent-client-message-plan-entry agent-client-plan-status-${entry.status}`}
						>
							{showEmojis && (
								<span
									className={`agent-client-message-plan-entry-icon agent-client-status-${entry.status}`}
								>
									{entry.status === "completed"
										? "✓"
										: entry.status === "in_progress"
											? "⏳"
											: "⭕"}
								</span>
							)}{" "}
							{entry.content}
						</div>
					))}
				</div>
			);
		}

		case "terminal":
			return (
				<TerminalRenderer
					terminalId={content.terminalId}
					acpClient={acpClient || null}
					plugin={plugin}
				/>
			);

		case "elicitation": {
			if (useToolUiRefresh) {
				return (
					<ToolUiElicitationCard
						requestId={content.requestId}
						message={content.message}
						requestedSchema={content.requestedSchema}
						status={content.status}
						response={content.response}
						error={content.error}
						showEmojis={showEmojis}
						onSubmit={onSubmitElicitation}
					/>
				);
			}

			const propertyEntries = Object.entries(
				content.requestedSchema.properties,
			);
			return (
				<div className="agent-client-message-elicitation agent-client-tool-ui-elicitation">
					<div className="agent-client-message-elicitation-title">
						Additional input required
					</div>
					<div className="agent-client-message-elicitation-message">
						{content.message}
					</div>
					{propertyEntries.length > 0 && (
						<div className="agent-client-message-elicitation-fields">
							{propertyEntries.map(([fieldName, field]) => (
								<div
									key={fieldName}
									className="agent-client-message-elicitation-field"
								>
									<strong>{field.title || fieldName}</strong>
									<span>{` (${field.type})`}</span>
									{field.description && (
										<div>{field.description}</div>
									)}
								</div>
							))}
						</div>
					)}
					<div className="agent-client-message-elicitation-status">
						Status: {content.status}
					</div>
					{content.error && (
						<div className="agent-client-message-elicitation-error">
							{content.error}
						</div>
					)}
				</div>
			);
		}

		case "image":
			return (
				<div className="agent-client-message-image">
					<img
						src={`data:${content.mimeType};base64,${content.data}`}
						alt="Attached image"
						className="agent-client-message-image-thumbnail"
					/>
				</div>
			);

		default:
			return <span>Unsupported content type</span>;
	}
}
