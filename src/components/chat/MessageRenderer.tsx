import * as React from "react";
import { createPortal } from "react-dom";
import { Notice, TFile, normalizePath } from "obsidian";
import type {
	ChatMessage,
	ElicitationResponse,
	MessageContent,
} from "../../domain/models/chat-message";
import type { SessionUsageMetrics } from "../../domain/models/chat-session";
import type { IChatAgentClient } from "../../domain/ports/chat-agent-client.port";
import type AgentClientPlugin from "../../plugin";
import { MessageContentRenderer } from "./MessageContentRenderer";

interface MessageRendererProps {
	message: ChatMessage;
	plugin: AgentClientPlugin;
	acpClient?: IChatAgentClient;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	/** Callback to submit elicitation responses */
	onSubmitElicitation?: (response: ElicitationResponse) => Promise<void>;
	/** Wall-clock duration for this completed assistant response */
	responseDurationMs?: number;
	/** Usage metrics snapshot captured when this response completed */
	responseUsageMetrics?: SessionUsageMetrics | null;
}

function toAssistantResponseMarkdown(message: ChatMessage): string {
	const lines: string[] = [];

	for (const item of message.content) {
		switch (item.type) {
			case "text":
			case "text_with_context":
				lines.push(item.text.trim());
				break;
			case "plan":
				lines.push("## Plan");
				for (const entry of item.entries) {
					lines.push(`- [${entry.status}] ${entry.content}`);
				}
				break;
			case "tool_call":
				lines.push(`## Tool: ${item.title || "Tool call"}`);
				lines.push(`Status: ${item.status}`);
				if (
					item.rawInput &&
					typeof item.rawInput.command === "string"
				) {
					lines.push(`Command: ${item.rawInput.command}`);
				}
				break;
			case "image":
				lines.push("![Attached image](embedded)");
				break;
			default:
				break;
		}
	}

	const body = lines
		.filter((line) => line.length > 0)
		.join("\n\n")
		.trim();
	return body.length > 0 ? body : "(empty response)";
}

async function ensureFolderExists(
	plugin: AgentClientPlugin,
	folderPath: string,
): Promise<void> {
	const normalized = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
	if (!normalized) {
		return;
	}

	const segments = normalized.split("/");
	let current = "";

	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!plugin.app.vault.getAbstractFileByPath(current)) {
			await plugin.app.vault.createFolder(current);
		}
	}
}

/**
 * Group consecutive image contents together for horizontal scrolling display.
 * Non-image contents are wrapped individually.
 */
function groupContent(
	contents: MessageContent[],
): Array<
	| { type: "images"; items: MessageContent[] }
	| { type: "single"; item: MessageContent }
> {
	const groups: Array<
		| { type: "images"; items: MessageContent[] }
		| { type: "single"; item: MessageContent }
	> = [];

	let currentImageGroup: MessageContent[] = [];

	for (const content of contents) {
		if (content.type === "image") {
			currentImageGroup.push(content);
		} else {
			// Flush any pending image group
			if (currentImageGroup.length > 0) {
				groups.push({ type: "images", items: currentImageGroup });
				currentImageGroup = [];
			}
			groups.push({ type: "single", item: content });
		}
	}

	// Flush remaining images
	if (currentImageGroup.length > 0) {
		groups.push({ type: "images", items: currentImageGroup });
	}

	return groups;
}

export function MessageRenderer({
	message,
	plugin,
	acpClient,
	onApprovePermission,
	onSubmitElicitation,
}: MessageRendererProps) {
	const groups = groupContent(message.content);
	const [isStatsOpen, setIsStatsOpen] = React.useState(false);
	const statsPopoverRef = React.useRef<HTMLDivElement>(null);
	const [responseTooltip, setResponseTooltip] = React.useState<{
		label: string;
		left: number;
		top: number;
		placement: "top" | "bottom";
	} | null>(null);
	const responseTooltipHideTimerRef = React.useRef<number | null>(null);
	const responseTooltipTargetRef = React.useRef<HTMLElement | null>(null);

	const clearResponseTooltipHideTimer = React.useCallback(() => {
		if (responseTooltipHideTimerRef.current !== null) {
			window.clearTimeout(responseTooltipHideTimerRef.current);
			responseTooltipHideTimerRef.current = null;
		}
	}, []);

	const hideResponseTooltip = React.useCallback(() => {
		clearResponseTooltipHideTimer();
		setResponseTooltip(null);
		responseTooltipTargetRef.current = null;
	}, [clearResponseTooltipHideTimer]);

	const showResponseTooltip = React.useCallback(
		(label: string, target: HTMLElement) => {
			clearResponseTooltipHideTimer();
			responseTooltipTargetRef.current = target;

			const rect = target.getBoundingClientRect();
			const estimateWidth = Math.min(
				280,
				Math.max(176, label.length * 7 + 28),
			);
			const tooltipHeight = 34;
			const gap = 10;
			const margin = 12;
			const fitsAbove = rect.top >= tooltipHeight + gap + margin;
			const placement: "top" | "bottom" = fitsAbove ? "top" : "bottom";
			const top = fitsAbove
				? Math.max(margin, rect.top - tooltipHeight - gap)
				: rect.bottom + gap;
			const left = Math.min(
				window.innerWidth - margin - estimateWidth / 2,
				Math.max(
					margin + estimateWidth / 2,
					rect.left + rect.width / 2,
				),
			);

			setResponseTooltip({ label, left, top, placement });
		},
		[clearResponseTooltipHideTimer],
	);

	const scheduleHideResponseTooltip = React.useCallback(() => {
		clearResponseTooltipHideTimer();
		responseTooltipHideTimerRef.current = window.setTimeout(() => {
			setResponseTooltip((current) => {
				if (
					current &&
					responseTooltipTargetRef.current &&
					responseTooltipTargetRef.current.matches(
						":hover, :focus-visible",
					)
				) {
					return current;
				}
				return null;
			});
			responseTooltipHideTimerRef.current = null;
		}, 80);
	}, [clearResponseTooltipHideTimer]);

	React.useEffect(() => {
		if (!isStatsOpen) return;

		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (!statsPopoverRef.current?.contains(target)) {
				setIsStatsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [isStatsOpen]);

	React.useEffect(() => {
		if (!responseTooltip) return;

		const handleScrollOrResize = () => {
			hideResponseTooltip();
		};

		window.addEventListener("scroll", handleScrollOrResize, true);
		window.addEventListener("resize", handleScrollOrResize);
		return () => {
			window.removeEventListener("scroll", handleScrollOrResize, true);
			window.removeEventListener("resize", handleScrollOrResize);
		};
	}, [responseTooltip, hideResponseTooltip]);

	const roleClass =
		message.role === "user"
			? "agent-client-message-user"
			: "agent-client-message-assistant";
	const shouldShowResponseActions =
		message.role === "assistant" && message.streamingPhase === "completed";

	const handleCopyResponse = React.useCallback(() => {
		const markdown = toAssistantResponseMarkdown(message);
		void navigator.clipboard
			.writeText(markdown)
			.then(() => {
				new Notice("Copied response");
			})
			.catch(() => {
				new Notice("Failed to copy response");
			});
	}, [message]);

	const handleSaveAsMarkdown = React.useCallback(() => {
		const markdownBody = toAssistantResponseMarkdown(message);
		const folder =
			plugin.settings.exportSettings.defaultFolder || "Agent Client";
		const now = new Date();
		const yyyy = now.getFullYear();
		const mm = String(now.getMonth() + 1).padStart(2, "0");
		const dd = String(now.getDate()).padStart(2, "0");
		const hh = String(now.getHours()).padStart(2, "0");
		const min = String(now.getMinutes()).padStart(2, "0");
		const ss = String(now.getSeconds()).padStart(2, "0");
		const suffix = message.id.slice(0, 8);
		const baseName = `response_${yyyy}${mm}${dd}_${hh}${min}${ss}_${suffix}`;

		const createNote = async () => {
			await ensureFolderExists(plugin, folder);

			let candidate = normalizePath(`${folder}/${baseName}.md`);
			let attempt = 2;
			while (plugin.app.vault.getAbstractFileByPath(candidate)) {
				candidate = normalizePath(
					`${folder}/${baseName}_${attempt}.md`,
				);
				attempt += 1;
			}

			const frontmatter = [
				"---",
				`created: ${new Date().toISOString()}`,
				"source: obsidian-copilot-response",
				"---",
				"",
			].join("\n");

			const file = await plugin.app.vault.create(
				candidate,
				`${frontmatter}${markdownBody}\n`,
			);
			if (file instanceof TFile) {
				const leaf = plugin.app.workspace.getLeaf(false);
				await leaf.openFile(file);
			}

			new Notice("Saved response as Markdown note");
		};

		void createNote().catch(() => {
			new Notice("Failed to save Markdown note");
		});
	}, [message, plugin]);

	return (
		<div
			className={`agent-client-message-renderer ${roleClass} agent-client-tool-ui-message`}
		>
			{groups.map((group, idx) => {
				if (group.type === "images") {
					// Render images in horizontal scroll container
					return (
						<div
							key={idx}
							className="agent-client-message-images-strip"
						>
							{group.items.map((content, imgIdx) => (
								<MessageContentRenderer
									key={imgIdx}
									content={content}
									plugin={plugin}
									messageId={message.id}
									messageRole={message.role}
									messageStreamingPhase={
										message.streamingPhase
									}
									acpClient={acpClient}
									onSubmitElicitation={onSubmitElicitation}
									onApprovePermission={onApprovePermission}
								/>
							))}
						</div>
					);
				} else {
					// Render single non-image content
					return (
						<div key={idx}>
							<MessageContentRenderer
								content={group.item}
								plugin={plugin}
								messageId={message.id}
								messageRole={message.role}
								messageStreamingPhase={message.streamingPhase}
								acpClient={acpClient}
								onSubmitElicitation={onSubmitElicitation}
								onApprovePermission={onApprovePermission}
							/>
						</div>
					);
				}
			})}
			{shouldShowResponseActions && (
				<div className="agent-client-message-response-actions">
					<span
						id="agent-client-response-copy-label"
						className="agent-client-sr-only"
					>
						Copy response to clipboard
					</span>
					<button
						type="button"
						className="agent-client-message-response-action-button agent-client-response-copy-button"
						aria-labelledby="agent-client-response-copy-label"
						onMouseEnter={(e) =>
							showResponseTooltip(
								"Copy response to clipboard",
								e.currentTarget,
							)
						}
						onMouseLeave={scheduleHideResponseTooltip}
						onFocus={(e) =>
							showResponseTooltip(
								"Copy response to clipboard",
								e.currentTarget,
							)
						}
						onBlur={scheduleHideResponseTooltip}
						onClick={handleCopyResponse}
					></button>
					<span
						id="agent-client-response-save-label"
						className="agent-client-sr-only"
					>
						Save response as markdown note
					</span>
					<button
						type="button"
						className="agent-client-message-response-action-button agent-client-response-save-button"
						aria-labelledby="agent-client-response-save-label"
						onMouseEnter={(e) =>
							showResponseTooltip(
								"Save response as markdown note",
								e.currentTarget,
							)
						}
						onMouseLeave={scheduleHideResponseTooltip}
						onFocus={(e) =>
							showResponseTooltip(
								"Save response as markdown note",
								e.currentTarget,
							)
						}
						onBlur={scheduleHideResponseTooltip}
						onClick={handleSaveAsMarkdown}
					></button>
				</div>
			)}
			{responseTooltip &&
				createPortal(
					<div
						className={`agent-client-message-response-tooltip agent-client-message-response-tooltip-${responseTooltip.placement}`}
						style={{
							left: `${responseTooltip.left}px`,
							top: `${responseTooltip.top}px`,
						}}
						role="tooltip"
					>
						{responseTooltip.label}
					</div>,
					document.body,
				)}
		</div>
	);
}
