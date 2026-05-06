import * as React from "react";
import * as Diff from "diff";
import type AgentClientPlugin from "../../../plugin";
import type { DiffContent } from "../../../domain/models/chat-message";

interface ToolUiDiffCardProps {
	diff: DiffContent;
	plugin: AgentClientPlugin;
	autoCollapse?: boolean;
	collapseThreshold?: number;
}

export function ToolUiDiffCard({
	diff,
	plugin,
	autoCollapse = false,
	collapseThreshold = 10,
}: ToolUiDiffCardProps) {
	const showEmojis = plugin.settings.displaySettings.showEmojis;
	const oldText = diff.oldText ?? "";
	const newText = diff.newText;
	const filePath = diff.path;

	const lineCount = newText.split("\n").length;
	const shouldAutoCollapse = autoCollapse && lineCount > collapseThreshold;
	const [collapsed, setCollapsed] = React.useState(shouldAutoCollapse);

	React.useEffect(() => {
		setCollapsed(shouldAutoCollapse);
	}, [shouldAutoCollapse]);

	const diffResult = React.useMemo(() => {
		return Diff.diffLines(oldText, newText);
	}, [oldText, newText]);

	return (
		<div className="agent-client-tool-ui-diff-card">
			<div className="agent-client-tool-ui-diff-header">
				<div className="agent-client-tool-ui-diff-title">
					{showEmojis ? "✏️ " : ""}
					Code Diff
				</div>
				<div className="agent-client-tool-ui-diff-path">{filePath}</div>
			</div>

			{shouldAutoCollapse && (
				<button
					type="button"
					className="agent-client-tool-ui-diff-toggle"
					onClick={() => setCollapsed((prev) => !prev)}
				>
					{collapsed ? "Show diff" : "Hide diff"}
				</button>
			)}

			{!collapsed && (
				<pre className="agent-client-tool-ui-diff-content">
					{diffResult.map((part, idx) => {
						const className = part.added
							? "agent-client-tool-ui-diff-added"
							: part.removed
								? "agent-client-tool-ui-diff-removed"
								: "agent-client-tool-ui-diff-unchanged";
						return (
							<span key={idx} className={className}>
								{part.value}
							</span>
						);
					})}
				</pre>
			)}
		</div>
	);
}
