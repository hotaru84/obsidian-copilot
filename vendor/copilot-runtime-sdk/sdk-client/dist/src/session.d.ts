import type { AssistantMessageEvent, MessageOptions, SerializableToolDefinition, SessionEvent, SessionMode } from "./types.js";
export interface CopilotClientSessionBridge {
    _sessionSend(sessionId: string, options: MessageOptions): Promise<string>;
    _sessionSendAndWait(sessionId: string, options: MessageOptions, timeout?: number): Promise<AssistantMessageEvent | undefined>;
    _sessionDisconnect(sessionId: string): Promise<void>;
    _sessionGetMessages(sessionId: string): Promise<SessionEvent[]>;
    _sessionAbort(sessionId: string): Promise<void>;
    _sessionLog(sessionId: string, message: string, options?: {
        level?: "info" | "warning" | "error";
        ephemeral?: boolean;
    }): Promise<void>;
    _sessionSetModel(sessionId: string, model: string, options?: {
        reasoningEffort?: string;
    }): Promise<void>;
    _sessionSetAgent(sessionId: string, agentId: string): Promise<void>;
    _sessionClearAgent(sessionId: string): Promise<void>;
    _sessionSetMode(sessionId: string, mode: SessionMode): Promise<void>;
    _sessionExecutePrompt(sessionId: string, promptId: string, args?: string): Promise<AssistantMessageEvent | undefined>;
}
export declare class CopilotSession {
    readonly sessionId: string;
    private readonly client;
    private readonly eventHandlers;
    private toolDefinitions;
    constructor(sessionId: string, client: CopilotClientSessionBridge, onEvent?: (event: SessionEvent) => void);
    send(options: MessageOptions): Promise<string>;
    sendAndWait(options: MessageOptions, timeout?: number): Promise<AssistantMessageEvent | undefined>;
    on(handler: (event: SessionEvent) => void): () => void;
    registerTools(tools?: SerializableToolDefinition[]): void;
    getToolNames(): string[];
    getMessages(): Promise<SessionEvent[]>;
    disconnect(): Promise<void>;
    abort(): Promise<void>;
    setModel(model: string, options?: {
        reasoningEffort?: string;
    }): Promise<void>;
    setAgent(agentId: string): Promise<void>;
    clearAgent(): Promise<void>;
    setMode(mode: SessionMode): Promise<void>;
    executePrompt(promptId: string, args?: string): Promise<AssistantMessageEvent | undefined>;
    log(message: string, options?: {
        level?: "info" | "warning" | "error";
        ephemeral?: boolean;
    }): Promise<void>;
    _dispatchEvent(event: SessionEvent): void;
}
//# sourceMappingURL=session.d.ts.map