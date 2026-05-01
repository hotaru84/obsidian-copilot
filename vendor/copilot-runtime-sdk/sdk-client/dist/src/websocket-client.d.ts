import type { AccountGetQuotaPayload, AccountGetQuotaResult, ActionResult, AssistantMessageEvent, AgentInfo, CustomCommandInfo, DiscoveredMCPServerList, ExtensionListResult, GetAuthStatusResponse, GetStatusResponse, HistoryCompactResult, HistoryTruncateResult, InstructionsGetSourcesResult, MCPConfigListResult, MessageOptions, PluginListResult, ModelInfo, PromptInfo, PermissionHandler, ResumeSessionConfig, ServerModelListResult, ServerModelsListPayload, ServerToolListResult, ServerToolsListPayload, SessionFleetStartResult, SessionFsConventions, SessionFsSetProviderResult, SessionModelGetCurrentResult, SessionModelSwitchToResult, SessionModeGetResult, SessionMode, SessionsForkResult, SessionShellExecResult, SessionShellKillResult, SessionCommandsHandlePendingResult, SessionToolsHandlePendingResult, SessionWorkspacesGetResult, SessionWorkspacesListFilesResult, SessionWorkspacesReadFileResult, SetWorkspaceResult, RestartServerResult, SessionMCPOAuthLoginOptions, SessionMCPOAuthLoginResult, SessionMCPServerList, SessionConfig, SessionEvent, SessionPlanReadResult, SessionRpcAgentGetCurrentResult, SessionRpcAgentList, SkillsDiscoverPayload, SkillListResult, UIElicitationResponse, UIElicitationResult, UIElicitationSchema, UsageGetMetricsResult } from "./types.js";
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
export interface CopilotClientRpc {
    mcp: {
        discover(workingDirectory?: string): Promise<DiscoveredMCPServerList>;
        config: {
            list(): Promise<MCPConfigListResult>;
            enable(names: string[]): Promise<void>;
            disable(names: string[]): Promise<void>;
        };
    };
    skills: {
        discover(options?: SkillsDiscoverPayload): Promise<SkillListResult>;
        config: {
            setDisabledSkills(disabledSkills: string[]): Promise<void>;
        };
    };
    models: {
        list(options?: ServerModelsListPayload): Promise<ServerModelListResult>;
    };
    tools: {
        list(options?: ServerToolsListPayload): Promise<ServerToolListResult>;
    };
    account: {
        getQuota(options?: AccountGetQuotaPayload): Promise<AccountGetQuotaResult>;
    };
    sessionFs: {
        setProvider(conventions: SessionFsConventions, initialCwd: string, sessionStatePath: string): Promise<SessionFsSetProviderResult>;
    };
    sessions: {
        fork(sessionId: string, toEventId?: string): Promise<SessionsForkResult>;
    };
}
export declare class CopilotClient implements CopilotClientSessionBridge {
    private socket;
    private requestCounter;
    private state;
    private readonly pendingRequests;
    private readonly permissionCallbacks;
    private readonly elicitationCallbacks;
    private readonly sessions;
    private readonly serverUrl;
    private readonly socketFactory;
    private configuredWorkspaceCwd;
    readonly rpc: CopilotClientRpc;
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
    _sessionAgentList(sessionId: string): Promise<SessionRpcAgentList>;
    _sessionAgentGetCurrent(sessionId: string): Promise<SessionRpcAgentGetCurrentResult>;
    _sessionAgentSelect(sessionId: string, name: string): Promise<void>;
    _sessionAgentDeselect(sessionId: string): Promise<void>;
    _sessionAgentReload(sessionId: string): Promise<SessionRpcAgentList>;
    _sessionPlanRead(sessionId: string): Promise<SessionPlanReadResult>;
    _sessionPlanUpdate(sessionId: string, content: string): Promise<void>;
    _sessionPlanDelete(sessionId: string): Promise<void>;
    _sessionPermissionsSetApproveAll(sessionId: string, enabled: boolean): Promise<ActionResult>;
    _sessionPermissionsResetSessionApprovals(sessionId: string): Promise<ActionResult>;
    _sessionMCPList(sessionId: string): Promise<SessionMCPServerList>;
    _sessionMCPEnable(sessionId: string, serverName: string): Promise<void>;
    _sessionMCPDisable(sessionId: string, serverName: string): Promise<void>;
    _sessionMCPReload(sessionId: string): Promise<void>;
    _sessionMCPOAuthLogin(sessionId: string, serverName: string, options?: SessionMCPOAuthLoginOptions): Promise<SessionMCPOAuthLoginResult>;
    _sessionSkillsList(sessionId: string): Promise<SkillListResult>;
    _sessionSkillsEnable(sessionId: string, name: string): Promise<void>;
    _sessionSkillsDisable(sessionId: string, name: string): Promise<void>;
    _sessionSkillsReload(sessionId: string): Promise<void>;
    _sessionInstructionsGetSources(sessionId: string): Promise<InstructionsGetSourcesResult>;
    _sessionModelGetCurrent(sessionId: string): Promise<SessionModelGetCurrentResult>;
    _sessionModelSwitchTo(sessionId: string, modelId: string, options?: {
        reasoningEffort?: string;
    }): Promise<SessionModelSwitchToResult>;
    _sessionModeGet(sessionId: string): Promise<SessionModeGetResult>;
    _sessionModeSet(sessionId: string, mode: SessionMode): Promise<void>;
    _sessionWorkspacesGetWorkspace(sessionId: string): Promise<SessionWorkspacesGetResult>;
    _sessionWorkspacesListFiles(sessionId: string): Promise<SessionWorkspacesListFilesResult>;
    _sessionWorkspacesReadFile(sessionId: string, path: string): Promise<SessionWorkspacesReadFileResult>;
    _sessionWorkspacesCreateFile(sessionId: string, path: string, content: string): Promise<void>;
    _sessionFleetStart(sessionId: string, prompt?: string): Promise<SessionFleetStartResult>;
    _sessionPluginsList(sessionId: string): Promise<PluginListResult>;
    _sessionExtensionsList(sessionId: string): Promise<ExtensionListResult>;
    _sessionExtensionsEnable(sessionId: string, id: string): Promise<void>;
    _sessionExtensionsDisable(sessionId: string, id: string): Promise<void>;
    _sessionExtensionsReload(sessionId: string): Promise<void>;
    _sessionToolsHandlePendingToolCall(sessionId: string, requestId: string, result: string | {
        content: unknown[];
    }, error?: string): Promise<SessionToolsHandlePendingResult>;
    _sessionCommandsHandlePendingCommand(sessionId: string, requestId: string, error?: string): Promise<SessionCommandsHandlePendingResult>;
    _sessionUIElicitation(sessionId: string, message: string, requestedSchema: UIElicitationSchema): Promise<UIElicitationResponse>;
    _sessionUIHandlePendingElicitation(sessionId: string, requestId: string, result: UIElicitationResponse): Promise<UIElicitationResult>;
    _sessionShellExec(sessionId: string, command: string, options?: {
        cwd?: string;
        timeout?: number;
    }): Promise<SessionShellExecResult>;
    _sessionShellKill(sessionId: string, processId: string, signal?: string): Promise<SessionShellKillResult>;
    _sessionHistoryCompact(sessionId: string): Promise<HistoryCompactResult>;
    _sessionHistoryTruncate(sessionId: string, eventId: string): Promise<HistoryTruncateResult>;
    _sessionUsageGetMetrics(sessionId: string): Promise<UsageGetMetricsResult>;
    private sendRequest;
    private handleMessage;
    private handlePermissionEvent;
    private handleElicitationEvent;
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