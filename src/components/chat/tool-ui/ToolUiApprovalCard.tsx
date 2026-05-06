import * as React from "react";
import type { PermissionOption } from "../../../domain/models/chat-message";

interface ToolUiApprovalCardProps {
	requestId: string;
	toolCallId: string;
	options: PermissionOption[];
	selectedOptionId?: string;
	isCancelled?: boolean;
	isActive?: boolean;
	showEmojis: boolean;
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	onOptionSelected?: (optionId: string) => void;
}

export function ToolUiApprovalCard({
	requestId,
	toolCallId,
	options,
	selectedOptionId,
	isCancelled = false,
	isActive = true,
	showEmojis,
	onApprovePermission,
	onOptionSelected,
}: ToolUiApprovalCardProps) {
	const selectedOption = options.find(
		(opt) => opt.optionId === selectedOptionId,
	);
	const isSelected = selectedOptionId !== undefined;
	const isInteractive = isActive && !isSelected && !isCancelled;

	return (
		<div
			className="agent-client-tool-ui-approval-card"
			data-request-id={requestId}
			data-tool-call-id={toolCallId}
			role="group"
			aria-label="Permission request"
		>
			<div className="agent-client-tool-ui-approval-card-header">
				<div className="agent-client-tool-ui-approval-card-title">
					{showEmojis ? "🛡 " : ""}
					Permission required
				</div>
				<div className="agent-client-tool-ui-approval-card-subtitle">
					Choose how this action should proceed.
				</div>
			</div>

			{isInteractive && (
				<div className="agent-client-tool-ui-approval-card-actions">
					{options.map((option) => (
						<button
							key={option.optionId}
							type="button"
							className={`agent-client-tool-ui-approval-button ${option.kind ? `agent-client-tool-ui-kind-${option.kind}` : ""}`}
							disabled={!isInteractive}
							onClick={() => {
								onOptionSelected?.(option.optionId);
								if (onApprovePermission) {
									void onApprovePermission(
										requestId,
										option.optionId,
									);
								}
							}}
						>
							{option.name}
						</button>
					))}
				</div>
			)}

			{isSelected && selectedOption && (
				<div
					className="agent-client-tool-ui-approval-receipt agent-client-tool-ui-approval-receipt-selected"
					role="status"
				>
					{showEmojis ? "✓ " : ""}
					Selected: {selectedOption.name}
				</div>
			)}

			{isCancelled && (
				<div
					className="agent-client-tool-ui-approval-receipt agent-client-tool-ui-approval-receipt-cancelled"
					role="status"
				>
					{showEmojis ? "⚠ " : ""}
					Cancelled: Permission request was cancelled
				</div>
			)}
		</div>
	);
}
