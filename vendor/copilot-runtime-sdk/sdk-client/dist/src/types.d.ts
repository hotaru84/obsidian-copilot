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
    kind: "shell" | "write" | "mcp" | "read" | "url" | "custom-tool";
    toolCallId?: string;
    [key: string]: unknown;
}
export type PermissionRequestResult = {
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
} | {
    kind: "no-result";
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
export interface SessionConfig {
    model?: string;
    streaming?: boolean;
    onPermissionRequest?: PermissionHandler;
    onEvent?: (event: SessionEvent) => void;
    systemMessage?: SystemMessageConfig;
    tools?: SerializableToolDefinition[];
    availableTools?: string[];
    excludedTools?: string[];
    configDir?: string;
}
export interface ResumeSessionConfig extends SessionConfig {
}
export interface CreateSessionPayload {
    config: Omit<SessionConfig, "onPermissionRequest" | "onEvent">;
    callbackId: string;
}
export interface ResumeSessionPayload extends CreateSessionPayload {
    sessionId: string;
}
export interface CreateSessionResult {
    sessionId: string;
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
//# sourceMappingURL=types.d.ts.map