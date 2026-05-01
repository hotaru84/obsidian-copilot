export const PROTOCOL_VERSION = "0.1.0";
export const HEALTH_METHOD = "server.health";
export const PING_METHOD = "server.ping";
export const RESTART_SERVER_METHOD = "server.restart";
export const COPILOT_GET_AUTH_STATUS_METHOD = "copilot.getAuthStatus";
export const COPILOT_LIST_MODELS_METHOD = "copilot.listModels";
export const COPILOT_LIST_AGENTS_METHOD = "copilot.listAgents";
export const COPILOT_LIST_PROMPTS_METHOD = "copilot.listPrompts";
export const COPILOT_LIST_CUSTOM_COMMANDS_METHOD = "copilot.listCustomCommands";
export const COPILOT_CREATE_SESSION_METHOD = "copilot.createSession";
export const COPILOT_RESUME_SESSION_METHOD = "copilot.resumeSession";
export const COPILOT_SESSION_SEND_METHOD = "copilot.session.send";
export const COPILOT_SESSION_SEND_AND_WAIT_METHOD = "copilot.session.sendAndWait";
export const COPILOT_SESSION_DISCONNECT_METHOD = "copilot.session.disconnect";
export const COPILOT_SESSION_GET_MESSAGES_METHOD = "copilot.session.getMessages";
export const COPILOT_SESSION_ABORT_METHOD = "copilot.session.abort";
export const COPILOT_SESSION_LOG_METHOD = "copilot.session.log";
export const COPILOT_SESSION_SET_MODEL_METHOD = "copilot.session.setModel";
export const COPILOT_SESSION_SET_AGENT_METHOD = "copilot.session.setAgent";
export const COPILOT_SESSION_CLEAR_AGENT_METHOD = "copilot.session.clearAgent";
export const COPILOT_SESSION_SET_MODE_METHOD = "copilot.session.setMode";
export const COPILOT_SESSION_EXECUTE_PROMPT_METHOD = "copilot.session.executePrompt";
export const COPILOT_SESSION_AGENT_LIST_METHOD = "copilot.session.agent.list";
export const COPILOT_SESSION_AGENT_GET_CURRENT_METHOD = "copilot.session.agent.getCurrent";
export const COPILOT_SESSION_AGENT_SELECT_METHOD = "copilot.session.agent.select";
export const COPILOT_SESSION_AGENT_DESELECT_METHOD = "copilot.session.agent.deselect";
export const COPILOT_SESSION_AGENT_RELOAD_METHOD = "copilot.session.agent.reload";
export const COPILOT_SESSION_PLAN_READ_METHOD = "copilot.session.plan.read";
export const COPILOT_SESSION_PLAN_UPDATE_METHOD = "copilot.session.plan.update";
export const COPILOT_SESSION_PLAN_DELETE_METHOD = "copilot.session.plan.delete";
export const COPILOT_SESSION_PERMISSIONS_SET_APPROVE_ALL_METHOD = "copilot.session.permissions.setApproveAll";
export const COPILOT_SESSION_PERMISSIONS_RESET_APPROVALS_METHOD = "copilot.session.permissions.resetSessionApprovals";
export const COPILOT_SESSION_MCP_LIST_METHOD = "copilot.session.mcp.list";
export const COPILOT_SESSION_MCP_ENABLE_METHOD = "copilot.session.mcp.enable";
export const COPILOT_SESSION_MCP_DISABLE_METHOD = "copilot.session.mcp.disable";
export const COPILOT_SESSION_MCP_RELOAD_METHOD = "copilot.session.mcp.reload";
export const COPILOT_SESSION_MCP_OAUTH_LOGIN_METHOD = "copilot.session.mcp.oauth.login";
export const COPILOT_SESSION_SKILLS_LIST_METHOD = "copilot.session.skills.list";
export const COPILOT_SESSION_SKILLS_ENABLE_METHOD = "copilot.session.skills.enable";
export const COPILOT_SESSION_SKILLS_DISABLE_METHOD = "copilot.session.skills.disable";
export const COPILOT_SESSION_SKILLS_RELOAD_METHOD = "copilot.session.skills.reload";
export const COPILOT_SESSION_INSTRUCTIONS_GET_SOURCES_METHOD = "copilot.session.instructions.getSources";
export const COPILOT_MCP_DISCOVER_METHOD = "copilot.mcp.discover";
export const COPILOT_MCP_CONFIG_LIST_METHOD = "copilot.mcp.config.list";
export const COPILOT_MCP_CONFIG_ENABLE_METHOD = "copilot.mcp.config.enable";
export const COPILOT_MCP_CONFIG_DISABLE_METHOD = "copilot.mcp.config.disable";
export const COPILOT_SKILLS_DISCOVER_METHOD = "copilot.skills.discover";
export const COPILOT_SKILLS_CONFIG_SET_DISABLED_METHOD = "copilot.skills.config.setDisabledSkills";
export const COPILOT_SET_WORKSPACE_METHOD = "copilot.setWorkspace";
export const COPILOT_PERMISSION_RESPOND_METHOD = "copilot.permission.respond";
export const COPILOT_PERMISSION_REQUEST_EVENT = "copilot.permission.request";
export const COPILOT_SESSION_EVENT = "copilot.session.event";
// session.rpc.model
export const COPILOT_SESSION_MODEL_GET_CURRENT_METHOD = "copilot.session.model.getCurrent";
export const COPILOT_SESSION_MODEL_SWITCH_TO_METHOD = "copilot.session.model.switchTo";
// session.rpc.mode
export const COPILOT_SESSION_MODE_GET_METHOD = "copilot.session.mode.get";
export const COPILOT_SESSION_MODE_SET_METHOD = "copilot.session.mode.set";
// session.rpc.workspaces
export const COPILOT_SESSION_WORKSPACES_GET_WORKSPACE_METHOD = "copilot.session.workspaces.getWorkspace";
export const COPILOT_SESSION_WORKSPACES_LIST_FILES_METHOD = "copilot.session.workspaces.listFiles";
export const COPILOT_SESSION_WORKSPACES_READ_FILE_METHOD = "copilot.session.workspaces.readFile";
export const COPILOT_SESSION_WORKSPACES_CREATE_FILE_METHOD = "copilot.session.workspaces.createFile";
// session.rpc.fleet  (experimental)
export const COPILOT_SESSION_FLEET_START_METHOD = "copilot.session.fleet.start";
// session.rpc.plugins  (experimental)
export const COPILOT_SESSION_PLUGINS_LIST_METHOD = "copilot.session.plugins.list";
// session.rpc.extensions  (experimental)
export const COPILOT_SESSION_EXTENSIONS_LIST_METHOD = "copilot.session.extensions.list";
export const COPILOT_SESSION_EXTENSIONS_ENABLE_METHOD = "copilot.session.extensions.enable";
export const COPILOT_SESSION_EXTENSIONS_DISABLE_METHOD = "copilot.session.extensions.disable";
export const COPILOT_SESSION_EXTENSIONS_RELOAD_METHOD = "copilot.session.extensions.reload";
// session.rpc.tools
export const COPILOT_SESSION_TOOLS_HANDLE_PENDING_METHOD = "copilot.session.tools.handlePendingToolCall";
// session.rpc.commands
export const COPILOT_SESSION_COMMANDS_HANDLE_PENDING_METHOD = "copilot.session.commands.handlePendingCommand";
// session.rpc.ui
export const COPILOT_SESSION_UI_ELICITATION_METHOD = "copilot.session.ui.elicitation";
export const COPILOT_SESSION_UI_HANDLE_PENDING_ELICITATION_METHOD = "copilot.session.ui.handlePendingElicitation";
// session.rpc.shell
export const COPILOT_SESSION_SHELL_EXEC_METHOD = "copilot.session.shell.exec";
export const COPILOT_SESSION_SHELL_KILL_METHOD = "copilot.session.shell.kill";
// session.rpc.history  (experimental)
export const COPILOT_SESSION_HISTORY_COMPACT_METHOD = "copilot.session.history.compact";
export const COPILOT_SESSION_HISTORY_TRUNCATE_METHOD = "copilot.session.history.truncate";
// session.rpc.usage  (experimental)
export const COPILOT_SESSION_USAGE_GET_METRICS_METHOD = "copilot.session.usage.getMetrics";
// client.rpc.models
export const COPILOT_MODELS_LIST_METHOD = "copilot.models.list";
// client.rpc.tools
export const COPILOT_TOOLS_LIST_METHOD = "copilot.tools.list";
// client.rpc.account
export const COPILOT_ACCOUNT_GET_QUOTA_METHOD = "copilot.account.getQuota";
// client.rpc.sessionFs
export const COPILOT_SESSION_FS_SET_PROVIDER_METHOD = "copilot.sessionFs.setProvider";
// client.rpc.sessions  (experimental)
export const COPILOT_SESSIONS_FORK_METHOD = "copilot.sessions.fork";
export function createRequest(id, method, payload) {
    return {
        id,
        type: "request",
        method,
        payload,
    };
}
export function createHealthRequest(id) {
    return createRequest(id, HEALTH_METHOD, {});
}
export function createPingRequest(id, message) {
    return createRequest(id, PING_METHOD, { message });
}
export function createRestartServerRequest(id) {
    return createRequest(id, RESTART_SERVER_METHOD, {});
}
export function createGetAuthStatusRequest(id) {
    return createRequest(id, COPILOT_GET_AUTH_STATUS_METHOD, {});
}
export function createListModelsRequest(id) {
    return createRequest(id, COPILOT_LIST_MODELS_METHOD, {});
}
export function createListAgentsRequest(id) {
    return createRequest(id, COPILOT_LIST_AGENTS_METHOD, {});
}
export function createListPromptsRequest(id) {
    return createRequest(id, COPILOT_LIST_PROMPTS_METHOD, {});
}
export function createListCustomCommandsRequest(id) {
    return createRequest(id, COPILOT_LIST_CUSTOM_COMMANDS_METHOD, {});
}
export function createCreateSessionRequest(id, payload) {
    return createRequest(id, COPILOT_CREATE_SESSION_METHOD, payload);
}
export function createResumeSessionRequest(id, payload) {
    return createRequest(id, COPILOT_RESUME_SESSION_METHOD, payload);
}
export function createSessionSendRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_SEND_METHOD, payload);
}
export function createSessionSendAndWaitRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_SEND_AND_WAIT_METHOD, payload);
}
export function createSessionDisconnectRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_DISCONNECT_METHOD, payload);
}
export function createSessionGetMessagesRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_GET_MESSAGES_METHOD, payload);
}
export function createSessionAbortRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_ABORT_METHOD, payload);
}
export function createSessionLogRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_LOG_METHOD, payload);
}
export function createSessionSetModelRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_SET_MODEL_METHOD, payload);
}
export function createSessionSetAgentRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_SET_AGENT_METHOD, payload);
}
export function createSessionClearAgentRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_CLEAR_AGENT_METHOD, payload);
}
export function createSessionSetModeRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_SET_MODE_METHOD, payload);
}
export function createSessionExecutePromptRequest(id, payload) {
    return createRequest(id, COPILOT_SESSION_EXECUTE_PROMPT_METHOD, payload);
}
export function createSetWorkspaceRequest(id, payload) {
    return createRequest(id, COPILOT_SET_WORKSPACE_METHOD, payload);
}
export function createPermissionRespondRequest(id, payload) {
    return createRequest(id, COPILOT_PERMISSION_RESPOND_METHOD, payload);
}
export function createHealthResponse(id, status) {
    return {
        id,
        type: "response",
        ok: true,
        payload: {
            version: status.version,
            protocolVersion: status.protocolVersion ?? 1,
        },
    };
}
export function createPingResponse(id, message) {
    return {
        id,
        type: "response",
        ok: true,
        payload: {
            message: `pong${message ? `: ${message}` : ""}`,
            timestamp: Date.now(),
        },
    };
}
export function createRestartServerResponse(id, result) {
    return {
        id,
        type: "response",
        ok: true,
        payload: result,
    };
}
export function createGetAuthStatusResponse(id, state) {
    return {
        id,
        type: "response",
        ok: true,
        payload: state,
    };
}
export function createListModelsResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createListAgentsResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createListPromptsResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createSetWorkspaceResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createListCustomCommandsResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createCreateSessionResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function createSessionSendAndWaitResponse(id, response) {
    return {
        id,
        type: "response",
        ok: true,
        payload: response,
    };
}
export function isRequestEnvelope(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (candidate.type === "request" &&
        typeof candidate.id === "string" &&
        typeof candidate.method === "string");
}
export function isHealthRequest(value) {
    return isRequestEnvelope(value) && value.method === HEALTH_METHOD;
}
export function isPingRequest(value) {
    return isRequestEnvelope(value) && value.method === PING_METHOD;
}
export function isRestartServerRequest(value) {
    return isRequestEnvelope(value) && value.method === RESTART_SERVER_METHOD;
}
export function isGetAuthStatusRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_GET_AUTH_STATUS_METHOD);
}
export function isListModelsRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_LIST_MODELS_METHOD);
}
export function isListAgentsRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_LIST_AGENTS_METHOD);
}
export function isListPromptsRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_LIST_PROMPTS_METHOD);
}
export function isListCustomCommandsRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_LIST_CUSTOM_COMMANDS_METHOD);
}
export function isCreateSessionRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_CREATE_SESSION_METHOD);
}
export function isResumeSessionRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_RESUME_SESSION_METHOD);
}
export function isSessionSendRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_SESSION_SEND_METHOD);
}
export function isSessionSendAndWaitRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_SEND_AND_WAIT_METHOD);
}
export function isSessionDisconnectRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_DISCONNECT_METHOD);
}
export function isSessionGetMessagesRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_GET_MESSAGES_METHOD);
}
export function isSessionAbortRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_SESSION_ABORT_METHOD);
}
export function isSessionLogRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_SESSION_LOG_METHOD);
}
export function isSessionSetModelRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_SET_MODEL_METHOD);
}
export function isSessionSetAgentRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_SET_AGENT_METHOD);
}
export function isSessionClearAgentRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_CLEAR_AGENT_METHOD);
}
export function isSessionSetModeRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_SESSION_SET_MODE_METHOD);
}
export function isSessionExecutePromptRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_SESSION_EXECUTE_PROMPT_METHOD);
}
export function isSetWorkspaceRequest(value) {
    return (isRequestEnvelope(value) && value.method === COPILOT_SET_WORKSPACE_METHOD);
}
export function isPermissionRespondRequest(value) {
    return (isRequestEnvelope(value) &&
        value.method === COPILOT_PERMISSION_RESPOND_METHOD);
}
export function createSessionEvent(payload) {
    return {
        type: "event",
        event: COPILOT_SESSION_EVENT,
        payload,
    };
}
export function createPermissionRequestEvent(payload) {
    return {
        type: "event",
        event: COPILOT_PERMISSION_REQUEST_EVENT,
        payload,
    };
}
//# sourceMappingURL=protocol.js.map