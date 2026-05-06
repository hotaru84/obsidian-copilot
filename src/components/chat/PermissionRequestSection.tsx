import type AgentClientPlugin from "../../plugin";
import type { PermissionOption } from "../../domain/models/chat-message";
import { ToolUiApprovalCard } from "./tool-ui/ToolUiApprovalCard";

interface PermissionRequestSectionProps {
	permissionRequest: {
		requestId: string;
		options: PermissionOption[];
		selectedOptionId?: string;
		isCancelled?: boolean;
		isActive?: boolean;
	};
	toolCallId: string;
	plugin: AgentClientPlugin;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	onOptionSelected?: (optionId: string) => void;
}

export function PermissionRequestSection({
	permissionRequest,
	toolCallId,
	plugin,
	onApprovePermission,
	onOptionSelected,
}: PermissionRequestSectionProps) {
	const showEmojis = plugin.settings.displaySettings.showEmojis;

	const isCancelled = permissionRequest.isCancelled === true;
	const isActive = permissionRequest.isActive !== false;

	return (
		<ToolUiApprovalCard
			requestId={permissionRequest.requestId}
			toolCallId={toolCallId}
			options={permissionRequest.options}
			selectedOptionId={permissionRequest.selectedOptionId}
			isCancelled={isCancelled}
			isActive={isActive}
			showEmojis={showEmojis}
			onApprovePermission={onApprovePermission}
			onOptionSelected={onOptionSelected}
		/>
	);
}
