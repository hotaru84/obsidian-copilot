export type CopilotServerState = "starting" | "ready" | "stopped" | "error";
export interface HealthStatus {
    state: CopilotServerState;
    startedAt: string;
    version: string;
}
export interface PingStatus {
    message: string;
    timestamp: number;
}
export interface GetStatusResponse {
    version: string;
    protocolVersion: number;
}
export interface GetAuthStatusResponse {
    isAuthenticated: boolean;
    authType?: string;
    statusMessage?: string;
}
export interface ModelInfo {
    id: string;
    name?: string;
    capabilities?: {
        supports?: Record<string, unknown>;
        limits?: Record<string, unknown>;
    };
}
export interface CustomCommandInfo {
    name: string;
    description: string;
    source: string;
    enabled: boolean;
}
export interface AgentInfo {
    id: string;
    name: string;
    description?: string;
    source?: string;
    enabled?: boolean;
}
export interface PromptInfo {
    id: string;
    name: string;
    description?: string;
    prompt?: string;
}
export interface PermissionRequest {
    kind: "shell" | "write" | "mcp" | "read" | "url" | "custom-tool" | "memory" | "hook";
    toolCallId?: string;
    [key: string]: unknown;
}
export interface ActionResult {
    success: boolean;
}
export type PermissionRequestResult = {
    kind: "approve-once";
    rules?: unknown[];
} | {
    kind: "approve-for-session";
    rules: unknown[];
} | {
    kind: "approve-for-location";
    rules: unknown[];
} | {
    kind: "reject";
    feedback?: string;
} | {
    kind: "user-not-available";
} | {
    kind: "no-result";
} | {
    kind: "approved";
} | {
    kind: "denied-by-rules";
    rules: unknown[];
} | {
    kind: "denied-no-approval-rule-and-could-not-request-from-user";
} | {
    kind: "denied-interactively-by-user";
    feedback?: string;
} | {
    kind: "denied-by-content-exclusion-policy";
    path: string;
    message: string;
} | {
    kind: "denied-by-permission-request-hook";
    message?: string;
    interrupt?: boolean;
};
export type PermissionHandler = (request: PermissionRequest, invocation: {
    sessionId: string;
}) => Promise<PermissionRequestResult> | PermissionRequestResult;
export interface AttachmentLineRange {
    start: number;
    end: number;
}
export interface AttachmentSelectionPosition {
    line: number;
    character: number;
}
export interface AttachmentSelection {
    start: AttachmentSelectionPosition;
    end: AttachmentSelectionPosition;
}
export type MessageAttachment = {
    type: "file";
    path: string;
    displayName?: string;
    lineRange?: AttachmentLineRange;
} | {
    type: "directory";
    path: string;
    displayName?: string;
} | {
    type: "selection";
    filePath: string;
    displayName: string;
    selection?: AttachmentSelection;
    text?: string;
} | {
    type: "github_reference";
    number: number;
    referenceType: "issue" | "pr" | "discussion";
    state: string;
    title: string;
    url: string;
} | {
    type: "blob";
    data: string;
    mimeType: string;
    displayName?: string;
};
export interface MessageOptions {
    prompt: string;
    attachments?: MessageAttachment[];
}
export interface SessionEvent {
    type: string;
    id?: string;
    agentId?: string;
    parentId?: string | null;
    timestamp?: string;
    ephemeral?: boolean;
    data: Record<string, unknown>;
}
export interface AssistantMessageEvent extends SessionEvent {
    type: "assistant.message";
    data: {
        content: string;
        [key: string]: unknown;
    };
}
export interface SystemMessageConfig {
    mode?: "append" | "replace" | "customize";
    content?: string;
    sections?: Record<string, unknown>;
}
export interface SerializableToolDefinition {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    skipPermission?: boolean;
}
export interface MCPServerBaseConfig {
    tools?: string[];
    timeout?: number;
    [key: string]: unknown;
}
export interface MCPLocalServerConfig extends MCPServerBaseConfig {
    type?: "local" | "stdio";
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
}
export interface MCPRemoteServerConfig extends MCPServerBaseConfig {
    type: "http" | "sse";
    url: string;
    headers?: Record<string, string>;
}
export type MCPServerConfig = MCPLocalServerConfig | MCPRemoteServerConfig;
export interface CustomAgentConfig {
    name: string;
    displayName?: string;
    description?: string;
    prompt?: string;
    infer?: boolean;
    availableTools?: string[];
    excludedTools?: string[];
    skills?: string[];
}
export interface DefaultAgentConfig {
    excludedTools?: string[];
}
export interface SessionRpcAgentInfo {
    name: string;
    displayName: string;
    description: string;
}
export interface SessionRpcAgentList {
    agents: SessionRpcAgentInfo[];
}
export interface SessionRpcAgentGetCurrentResult {
    agent: SessionRpcAgentInfo | null;
}
export interface SessionPlanReadResult {
    exists: boolean;
    content: string | null;
    path: string | null;
}
export interface SessionMCPServerInfo {
    name: string;
    status: string;
    source?: string;
    error?: string;
}
export interface SessionMCPServerList {
    servers: SessionMCPServerInfo[];
}
export interface DiscoveredMCPServerInfo {
    name: string;
    type?: string;
    source: string;
    enabled: boolean;
}
export interface DiscoveredMCPServerList {
    servers: DiscoveredMCPServerInfo[];
}
export interface MCPConfigListResult {
    servers: Record<string, Record<string, unknown>>;
}
export interface SessionMCPOAuthLoginOptions {
    callbackSuccessMessage?: string;
    clientName?: string;
    forceReauth?: boolean;
}
export interface SessionMCPOAuthLoginResult {
    authorizationUrl?: string;
}
export interface SkillInfo {
    name: string;
    description: string;
    source: string;
    userInvocable: boolean;
    enabled: boolean;
    path?: string;
    projectPath?: string;
}
export interface SkillListResult {
    skills: SkillInfo[];
}
export type InstructionsSource = Record<string, unknown> & {
    id?: string;
    label?: string;
    type?: string;
    sourcePath?: string;
    content?: string;
    applyTo?: string;
    description?: string;
    location?: Record<string, unknown>;
};
export interface InstructionsGetSourcesResult {
    sources: InstructionsSource[];
}
export interface ElicitationContext {
    sessionId: string;
    message: string;
    requestedSchema: UIElicitationSchema;
    mode?: string;
    elicitationSource?: string;
    url?: string;
}
export type ElicitationHandler = (context: ElicitationContext) => Promise<UIElicitationResponse>;
export interface SessionConfig {
    model?: string;
    streaming?: boolean;
    onPermissionRequest?: PermissionHandler;
    onElicitationRequest?: ElicitationHandler;
    onEvent?: (event: SessionEvent) => void;
    systemMessage?: SystemMessageConfig;
    tools?: SerializableToolDefinition[];
    availableTools?: string[];
    excludedTools?: string[];
    workingDirectory?: string;
    includeSubAgentStreamingEvents?: boolean;
    configDir?: string;
    enableConfigDiscovery?: boolean;
    mcpServers?: Record<string, MCPServerConfig>;
    customAgents?: CustomAgentConfig[];
    defaultAgent?: DefaultAgentConfig;
    agent?: string;
    skillDirectories?: string[];
    disabledSkills?: string[];
}
export interface ResumeSessionConfig extends SessionConfig {
}
export interface CreateSessionPayload {
    config: Omit<SessionConfig, "onPermissionRequest" | "onElicitationRequest" | "onEvent">;
    callbackId: string;
    requestElicitation?: boolean;
}
export interface ResumeSessionPayload extends CreateSessionPayload {
    sessionId: string;
}
export interface SessionCapabilities {
    ui?: {
        elicitation?: boolean;
    };
}
export interface CreateSessionResult {
    sessionId: string;
    capabilities?: SessionCapabilities;
}
export interface SessionSendPayload {
    sessionId: string;
    options: MessageOptions;
}
export interface SessionSendAndWaitPayload {
    sessionId: string;
    options: MessageOptions;
    timeout?: number;
}
export interface SessionIdPayload {
    sessionId: string;
}
export interface SessionSetModelPayload {
    sessionId: string;
    model: string;
    reasoningEffort?: string;
}
export interface SessionSetAgentPayload {
    sessionId: string;
    agentId: string;
}
export type SessionMode = "interactive" | "plan" | "autopilot";
export interface SessionClearAgentPayload {
    sessionId: string;
}
export interface SessionSetModePayload {
    sessionId: string;
    mode: SessionMode;
}
export interface SessionExecutePromptPayload {
    sessionId: string;
    promptId: string;
    args?: string;
}
export interface SessionAgentSelectPayload {
    sessionId: string;
    name: string;
}
export interface SessionPlanUpdatePayload {
    sessionId: string;
    content: string;
}
export interface SessionSetApproveAllPayload {
    sessionId: string;
    enabled: boolean;
}
export interface SessionMCPServerPayload {
    sessionId: string;
    serverName: string;
}
export interface SessionMCPOAuthLoginPayload extends SessionMCPServerPayload {
    callbackSuccessMessage?: string;
    clientName?: string;
    forceReauth?: boolean;
}
export interface SessionSkillPayload {
    sessionId: string;
    name: string;
}
export interface MCPDiscoverPayload {
    workingDirectory?: string;
}
export interface MCPConfigTogglePayload {
    names: string[];
}
export interface SkillsDiscoverPayload {
    projectPaths?: string[];
    skillDirectories?: string[];
}
export interface SkillsConfigSetDisabledSkillsPayload {
    disabledSkills: string[];
}
export interface SetWorkspacePayload {
    cwd: string;
}
export interface SetWorkspaceResult {
    success: boolean;
    appliesOnNextClientCreation: boolean;
    cwd: string;
}
export interface RestartServerResult {
    success: boolean;
    restarted: boolean;
    closedSessions: number;
}
export interface SessionLogPayload {
    sessionId: string;
    message: string;
    level?: "info" | "warning" | "error";
    ephemeral?: boolean;
}
export interface PermissionRespondPayload {
    requestId: string;
    result: PermissionRequestResult;
}
export interface PermissionRequestEventPayload {
    callbackId: string;
    requestId: string;
    permissionRequest: PermissionRequest;
    sessionId: string;
}
export interface SessionEventRelayPayload {
    sessionId: string;
    event: SessionEvent;
}
export interface RequestEnvelope<TPayload> {
    id: string;
    type: "request";
    method: string;
    payload: TPayload;
}
export interface ResponseEnvelope<TPayload> {
    id: string;
    type: "response";
    ok: boolean;
    payload?: TPayload;
    error?: {
        code: string;
        message: string;
    };
}
export interface EventEnvelope<TPayload> {
    type: "event";
    event: string;
    payload: TPayload;
}
export type ProtocolMessage<TRequest = unknown, TResponse = unknown, TEvent = unknown> = RequestEnvelope<TRequest> | ResponseEnvelope<TResponse> | EventEnvelope<TEvent>;
export interface SessionModelGetCurrentResult {
    modelId?: string;
}
export interface SessionModelSwitchToResult {
    modelId?: string;
}
export interface SessionModeGetResult {
    mode: SessionMode;
}
export interface WorkspaceInfo {
    id: string;
    cwd?: string;
    name?: string;
    branch?: string;
    repository?: string;
    [key: string]: unknown;
}
export interface SessionWorkspacesGetResult {
    workspace: WorkspaceInfo | null;
}
export interface SessionWorkspacesListFilesResult {
    files: string[];
}
export interface SessionWorkspacesReadFileResult {
    content: string;
}
export interface SessionFleetStartResult {
    started: boolean;
}
export interface PluginInfo {
    name: string;
    marketplace: string;
    enabled: boolean;
    version?: string;
}
export interface PluginListResult {
    plugins: PluginInfo[];
}
export interface ExtensionInfo {
    id: string;
    name: string;
    source: string;
    status: string;
    pid?: number;
}
export interface ExtensionListResult {
    extensions: ExtensionInfo[];
}
export interface SessionToolsHandlePendingResult {
    success: boolean;
}
export interface SessionCommandsHandlePendingResult {
    success: boolean;
}
export interface UIElicitationSchemaProperty {
    type: string;
    title?: string;
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    default?: unknown;
}
export interface UIElicitationSchema {
    type: "object";
    properties: Record<string, UIElicitationSchemaProperty>;
    required?: string[];
}
export type UIElicitationResponseAction = "accept" | "decline" | "cancel";
export interface UIElicitationResponse {
    action: UIElicitationResponseAction;
    content?: Record<string, unknown>;
}
export interface UIElicitationResult {
    success: boolean;
}
export interface SessionShellExecResult {
    processId: string;
}
export interface SessionShellKillResult {
    killed: boolean;
}
export interface HistoryCompactResult {
    success: boolean;
    messagesRemoved: number;
    tokensRemoved: number;
    contextWindow?: Record<string, unknown>;
}
export interface HistoryTruncateResult {
    eventsRemoved: number;
}
export interface UsageModelMetric {
    totalRequests?: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    [key: string]: unknown;
}
export interface UsageGetMetricsResult {
    totalUserRequests: number;
    totalPremiumRequestCost: number;
    totalApiDurationMs: number;
    lastCallInputTokens: number;
    lastCallOutputTokens: number;
    sessionStartTime: number;
    currentModel?: string;
    modelMetrics: Record<string, UsageModelMetric>;
    codeChanges: Record<string, unknown>;
}
export interface ServerModelCapabilities {
    [key: string]: unknown;
}
export interface ServerModelBilling {
    [key: string]: unknown;
}
export interface ServerModelInfo {
    id: string;
    name: string;
    capabilities: ServerModelCapabilities;
    billing?: ServerModelBilling;
    defaultReasoningEffort?: string;
    supportedReasoningEfforts?: string[];
    policy?: Record<string, unknown>;
}
export interface ServerModelsListPayload {
    gitHubToken?: string;
}
export interface ServerModelListResult {
    models: ServerModelInfo[];
}
export interface ServerToolInfo {
    name: string;
    description: string;
    namespacedName?: string;
    instructions?: string;
    parameters?: Record<string, unknown>;
}
export interface ServerToolsListPayload {
    model?: string;
}
export interface ServerToolListResult {
    tools: ServerToolInfo[];
}
export interface AccountQuotaSnapshot {
    entitlementRequests: number;
    usedRequests: number;
    remainingPercentage: number;
    isUnlimitedEntitlement: boolean;
    overageAllowedWithExhaustedQuota: boolean;
    usageAllowedWithExhaustedQuota: boolean;
    overage: number;
    resetDate?: string;
}
export interface AccountGetQuotaPayload {
    gitHubToken?: string;
}
export interface AccountGetQuotaResult {
    quotaSnapshots: Record<string, AccountQuotaSnapshot>;
}
export type SessionFsConventions = "posix" | "windows";
export interface SessionFsSetProviderPayload {
    conventions: SessionFsConventions;
    initialCwd: string;
    sessionStatePath: string;
}
export interface SessionFsSetProviderResult {
    success: boolean;
}
export interface SessionsForkPayload {
    sessionId: string;
    toEventId?: string;
}
export interface SessionsForkResult {
    sessionId: string;
}
//# sourceMappingURL=types.d.ts.map