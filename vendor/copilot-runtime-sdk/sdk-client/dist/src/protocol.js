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
export const COPILOT_SET_WORKSPACE_METHOD = "copilot.setWorkspace";
export const COPILOT_PERMISSION_RESPOND_METHOD = "copilot.permission.respond";
export const COPILOT_PERMISSION_REQUEST_EVENT = "copilot.permission.request";
export const COPILOT_SESSION_EVENT = "copilot.session.event";
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