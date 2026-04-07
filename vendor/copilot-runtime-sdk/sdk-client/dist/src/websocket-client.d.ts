import type { AssistantMessageEvent, AgentInfo, CustomCommandInfo, GetAuthStatusResponse, GetStatusResponse, MessageOptions, ModelInfo, PromptInfo, PermissionHandler, ResumeSessionConfig, SetWorkspaceResult, RestartServerResult, SessionConfig, SessionEvent, SessionMode } from "./types.js";
import { CopilotSession, type CopilotClientSessionBridge } from "./session.js";
export interface WebSocketFactory {
    (url: string): WebSocket;
}
export type ConnectionState = "disconnected" | "connecting" | "connected";
export interface CopilotClientOptions {
    cliUrl?: string;
    serverUrl?: string;
    cwd?: string;
    socketFactory?: WebSocketFactory;
}
export interface TransportStatus {
    state: "ready";
    version: string;
    protocolVersion: number;
}
export interface TransportPing {
    pong: true;
    message: string;
    timestamp: number;
}
export interface TransportAuthState {
    configured: boolean;
    provider: string;
    statusMessage?: string;
}
export interface TransportCompletion {
    text: string;
    model: string;
}
export interface TransportSession {
    sessionId: string;
    model: string;
}
export declare class CopilotClient implements CopilotClientSessionBridge {
    private socket;
    private requestCounter;
    private state;
    private readonly pendingRequests;
    private readonly permissionCallbacks;
    private readonly sessions;
    private readonly serverUrl;
    private readonly socketFactory;
    private configuredWorkspaceCwd;
    constructor(options?: CopilotClientOptions);
    getState(): ConnectionState;
    start(): Promise<void>;
    stop(): Promise<Error[]>;
    forceStop(): Promise<void>;
    ping(message?: string): Promise<{
        message: string;
        timestamp: number;
    }>;
    getStatus(): Promise<GetStatusResponse>;
    getAuthStatus(): Promise<GetAuthStatusResponse>;
    listModels(): Promise<ModelInfo[]>;
    listAgents(): Promise<AgentInfo[]>;
    listCustomCommands(): Promise<CustomCommandInfo[]>;
    listPrompts(): Promise<PromptInfo[]>;
    setWorkspace(cwd: string): Promise<SetWorkspaceResult>;
    restartServer(): Promise<RestartServerResult>;
    createSession(config: SessionConfig): Promise<CopilotSession>;
    resumeSession(sessionId: string, config: ResumeSessionConfig): Promise<CopilotSession>;
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
    private sendRequest;
    private handleMessage;
    private handlePermissionEvent;
    private rejectAllPending;
}
/**
 * Legacy transport wrapper retained for backward compatibility.
 * Prefer direct `CopilotClient` usage for SDK-like integration.
 */
export declare class CopilotTransportClient {
    private readonly client;
    constructor(serverUrl: string, socketFactory?: WebSocketFactory);
    getStatus(): Promise<TransportStatus>;
    ping(message?: string): Promise<TransportPing>;
    getAuthState(): Promise<TransportAuthState>;
    complete(prompt: string, _maxTokens?: number): Promise<TransportCompletion>;
    listModels(): Promise<ModelInfo[]>;
    listAgents(): Promise<AgentInfo[]>;
    listCustomCommands(): Promise<CustomCommandInfo[]>;
    listPrompts(): Promise<PromptInfo[]>;
    setWorkspace(cwd: string): Promise<SetWorkspaceResult>;
    restartServer(): Promise<RestartServerResult>;
    createSession(model?: string): Promise<TransportSession>;
    stop(): Promise<Error[]>;
}
export declare const approveAll: PermissionHandler;
//# sourceMappingURL=websocket-client.d.ts.map