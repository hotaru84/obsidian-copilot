import * as React from "react";

interface ToolUiTerminalCardProps {
	terminalId: string;
	isRunning: boolean;
	isCancelled: boolean;
	output: string;
	exitStatus: {
		exitCode: number | null;
		signal: string | null;
	} | null;
	showEmojis: boolean;
}

export function ToolUiTerminalCard({
	terminalId,
	isRunning,
	isCancelled,
	output,
	exitStatus,
	showEmojis,
}: ToolUiTerminalCardProps) {
	const statusLabel = isRunning
		? "RUNNING"
		: isCancelled
			? "CANCELLED"
			: "FINISHED";

	const statusClass = isRunning
		? "agent-client-tool-ui-terminal-status-running"
		: isCancelled
			? "agent-client-tool-ui-terminal-status-cancelled"
			: "agent-client-tool-ui-terminal-status-finished";

	return (
		<div className="agent-client-tool-ui-terminal-card">
			<div className="agent-client-tool-ui-terminal-header">
				<div className="agent-client-tool-ui-terminal-title">
					{showEmojis ? "🖥 " : ""}
					Terminal {terminalId.slice(0, 8)}
				</div>
				<span
					className={`agent-client-tool-ui-terminal-status ${statusClass}`}
				>
					{statusLabel}
				</span>
			</div>

			<pre className="agent-client-tool-ui-terminal-output">
				{output || (isRunning ? "Waiting for output..." : "No output")}
			</pre>

			{exitStatus && (
				<div
					className={`agent-client-tool-ui-terminal-exit ${exitStatus.exitCode === 0 ? "agent-client-tool-ui-terminal-exit-success" : "agent-client-tool-ui-terminal-exit-error"}`}
				>
					Exit Code: {exitStatus.exitCode}
					{exitStatus.signal ? ` | Signal: ${exitStatus.signal}` : ""}
				</div>
			)}
		</div>
	);
}
