import { describe, expect, it } from "vitest";
import { COPILOT_CREATE_SESSION_METHOD, COPILOT_GET_AUTH_STATUS_METHOD, COPILOT_LIST_CUSTOM_COMMANDS_METHOD, COPILOT_LIST_PROMPTS_METHOD, COPILOT_SET_WORKSPACE_METHOD, RESTART_SERVER_METHOD, COPILOT_LIST_MODELS_METHOD, COPILOT_SESSION_SET_AGENT_METHOD, COPILOT_SESSION_CLEAR_AGENT_METHOD, COPILOT_SESSION_SET_MODE_METHOD, COPILOT_SESSION_SEND_AND_WAIT_METHOD, HEALTH_METHOD, PING_METHOD, createCreateSessionRequest, createGetAuthStatusRequest, createHealthRequest, createListCustomCommandsRequest, createListPromptsRequest, createListModelsRequest, createPingRequest, createRestartServerRequest, createSetWorkspaceRequest, createSessionSetAgentRequest, createSessionClearAgentRequest, createSessionSetModeRequest, isCreateSessionRequest, isGetAuthStatusRequest, isHealthRequest, isListCustomCommandsRequest, isListPromptsRequest, isListModelsRequest, isPingRequest, isRestartServerRequest, isSetWorkspaceRequest, isSessionSetAgentRequest, isSessionClearAgentRequest, isSessionSetModeRequest, isSessionSendAndWaitRequest, } from "../src/protocol.js";
describe("shared protocol", () => {
    it("creates a valid health request", () => {
        const request = createHealthRequest("req-1");
        expect(request.method).toBe(HEALTH_METHOD);
        expect(isHealthRequest(request)).toBe(true);
    });
    it("creates a valid ping request", () => {
        const request = createPingRequest("req-2");
        expect(request.method).toBe(PING_METHOD);
        expect(isPingRequest(request)).toBe(true);
    });
    it("creates a valid restart server request", () => {
        const request = createRestartServerRequest("req-2b");
        expect(request.method).toBe(RESTART_SERVER_METHOD);
        expect(isRestartServerRequest(request)).toBe(true);
    });
    it("creates a valid get auth status request", () => {
        const request = createGetAuthStatusRequest("req-3");
        expect(request.method).toBe(COPILOT_GET_AUTH_STATUS_METHOD);
        expect(isGetAuthStatusRequest(request)).toBe(true);
    });
    it("creates a valid list models request", () => {
        const request = createListModelsRequest("req-5");
        expect(request.method).toBe(COPILOT_LIST_MODELS_METHOD);
        expect(isListModelsRequest(request)).toBe(true);
    });
    it("creates a valid list custom commands request", () => {
        const request = createListCustomCommandsRequest("req-5b");
        expect(request.method).toBe(COPILOT_LIST_CUSTOM_COMMANDS_METHOD);
        expect(isListCustomCommandsRequest(request)).toBe(true);
    });
    it("creates a valid list prompts request", () => {
        const request = createListPromptsRequest("req-5c");
        expect(request.method).toBe(COPILOT_LIST_PROMPTS_METHOD);
        expect(isListPromptsRequest(request)).toBe(true);
    });
    it("creates a valid create session request", () => {
        const request = createCreateSessionRequest("req-6", {
            callbackId: "cb-1",
            config: {
                model: "gpt-4.1",
            },
        });
        expect(request.method).toBe(COPILOT_CREATE_SESSION_METHOD);
        expect(isCreateSessionRequest(request)).toBe(true);
    });
    it("recognizes session sendAndWait request", () => {
        const request = {
            id: "req-7",
            type: "request",
            method: COPILOT_SESSION_SEND_AND_WAIT_METHOD,
            payload: {
                sessionId: "session-1",
                options: { prompt: "hi" },
            },
        };
        expect(isSessionSendAndWaitRequest(request)).toBe(true);
    });
    it("creates a valid session setAgent request", () => {
        const request = createSessionSetAgentRequest("req-8", {
            sessionId: "session-1",
            agentId: "explore",
        });
        expect(request.method).toBe(COPILOT_SESSION_SET_AGENT_METHOD);
        expect(isSessionSetAgentRequest(request)).toBe(true);
    });
    it("creates a valid session clearAgent request", () => {
        const request = createSessionClearAgentRequest("req-8c", {
            sessionId: "session-1",
        });
        expect(request.method).toBe(COPILOT_SESSION_CLEAR_AGENT_METHOD);
        expect(isSessionClearAgentRequest(request)).toBe(true);
    });
    it("creates a valid session setMode request", () => {
        const request = createSessionSetModeRequest("req-8d", {
            sessionId: "session-1",
            mode: "plan",
        });
        expect(request.method).toBe(COPILOT_SESSION_SET_MODE_METHOD);
        expect(isSessionSetModeRequest(request)).toBe(true);
    });
    it("creates a valid set workspace request", () => {
        const request = createSetWorkspaceRequest("req-9", {
            cwd: "C:/workspace",
        });
        expect(request.method).toBe(COPILOT_SET_WORKSPACE_METHOD);
        expect(isSetWorkspaceRequest(request)).toBe(true);
    });
});
//# sourceMappingURL=protocol.test.js.map