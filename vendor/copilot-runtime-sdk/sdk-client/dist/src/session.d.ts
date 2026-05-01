import type { ActionResult, AssistantMessageEvent, ExtensionListResult, HistoryCompactResult, HistoryTruncateResult, InstructionsGetSourcesResult, MessageOptions, PluginListResult, SessionFleetStartResult, SessionMCPOAuthLoginOptions, SessionMCPOAuthLoginResult, SessionMCPServerList, SessionModeGetResult, SessionModelGetCurrentResult, SessionModelSwitchToResult, SessionMode, SessionPlanReadResult, SessionRpcAgentGetCurrentResult, SessionRpcAgentList, SessionShellExecResult, SessionShellKillResult, SessionCommandsHandlePendingResult, SessionToolsHandlePendingResult, SessionWorkspacesGetResult, SessionWorkspacesListFilesResult, SessionWorkspacesReadFileResult, SerializableToolDefinition, SessionEvent, SkillListResult, UIElicitationResponse, UIElicitationResult, UIElicitationSchema, UsageGetMetricsResult } from "./types.js";
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
}
export interface CopilotSessionRpc {
    agent: {
        list(): Promise<SessionRpcAgentList>;
        getCurrent(): Promise<SessionRpcAgentGetCurrentResult>;
        select(name: string): Promise<void>;
        deselect(): Promise<void>;
        reload(): Promise<SessionRpcAgentList>;
    };
    plan: {
        read(): Promise<SessionPlanReadResult>;
        update(content: string): Promise<void>;
        delete(): Promise<void>;
    };
    permissions: {
        setApproveAll(enabled: boolean): Promise<ActionResult>;
        resetSessionApprovals(): Promise<ActionResult>;
    };
    mcp: {
        list(): Promise<SessionMCPServerList>;
        enable(serverName: string): Promise<void>;
        disable(serverName: string): Promise<void>;
        reload(): Promise<void>;
        oauth: {
            login(serverName: string, options?: SessionMCPOAuthLoginOptions): Promise<SessionMCPOAuthLoginResult>;
        };
    };
    skills: {
        list(): Promise<SkillListResult>;
        enable(name: string): Promise<void>;
        disable(name: string): Promise<void>;
        reload(): Promise<void>;
    };
    instructions: {
        getSources(): Promise<InstructionsGetSourcesResult>;
    };
    model: {
        getCurrent(): Promise<SessionModelGetCurrentResult>;
        switchTo(modelId: string, options?: {
            reasoningEffort?: string;
        }): Promise<SessionModelSwitchToResult>;
    };
    mode: {
        get(): Promise<SessionModeGetResult>;
        set(mode: SessionMode): Promise<void>;
    };
    workspaces: {
        getWorkspace(): Promise<SessionWorkspacesGetResult>;
        listFiles(): Promise<SessionWorkspacesListFilesResult>;
        readFile(path: string): Promise<SessionWorkspacesReadFileResult>;
        createFile(path: string, content: string): Promise<void>;
    };
    fleet: {
        start(prompt?: string): Promise<SessionFleetStartResult>;
    };
    plugins: {
        list(): Promise<PluginListResult>;
    };
    extensions: {
        list(): Promise<ExtensionListResult>;
        enable(id: string): Promise<void>;
        disable(id: string): Promise<void>;
        reload(): Promise<void>;
    };
    tools: {
        handlePendingToolCall(requestId: string, result: string | {
            content: unknown[];
        }, error?: string): Promise<SessionToolsHandlePendingResult>;
    };
    commands: {
        handlePendingCommand(requestId: string, error?: string): Promise<SessionCommandsHandlePendingResult>;
    };
    ui: {
        elicitation(message: string, requestedSchema: UIElicitationSchema): Promise<UIElicitationResponse>;
        handlePendingElicitation(requestId: string, result: UIElicitationResponse): Promise<UIElicitationResult>;
    };
    shell: {
        exec(command: string, options?: {
            cwd?: string;
            timeout?: number;
        }): Promise<SessionShellExecResult>;
        kill(processId: string, signal?: string): Promise<SessionShellKillResult>;
    };
    history: {
        compact(): Promise<HistoryCompactResult>;
        truncate(eventId: string): Promise<HistoryTruncateResult>;
    };
    usage: {
        getMetrics(): Promise<UsageGetMetricsResult>;
    };
}
export declare class CopilotSession {
    readonly sessionId: string;
    private readonly client;
    private readonly eventHandlers;
    private toolDefinitions;
    readonly rpc: CopilotSessionRpc;
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