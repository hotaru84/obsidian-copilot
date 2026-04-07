import type {
	IAgentClient,
	AgentConfig,
	InitializeResult,
	NewSessionResult,
} from "./agent-client.port";
import type { MessageContent } from "../models/chat-message";

export interface TerminalOutputRequestLike {
	terminalId: string;
	sessionId: string;
}

export interface TerminalOutputResponseLike {
	output: string;
	truncated: boolean;
	exitStatus?:
		| {
				exitCode?: number | null;
				signal?: string | null;
		  }
		| null
		| undefined;
}

/**
 * UI-facing agent client abstraction used by chat views.
 *
 * This keeps the view layer independent from ACP-specific interfaces while
 * preserving compatibility with the existing ACP adapter methods.
 */
export interface IChatAgentClient extends IAgentClient {
	initialize(config: AgentConfig): Promise<InitializeResult>;
	newSession(workingDirectory: string): Promise<NewSessionResult>;
	setUpdateMessageCallback(
		updateMessage: (toolCallId: string, content: MessageContent) => void,
	): void;
	setAutoAllowPermissionsOverride(value: boolean | null): void;
	terminalOutput(
		params: TerminalOutputRequestLike,
	): Promise<TerminalOutputResponseLike>;
}
