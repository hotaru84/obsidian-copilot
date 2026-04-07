import { COPILOT_CREATE_SESSION_METHOD, COPILOT_GET_AUTH_STATUS_METHOD, COPILOT_LIST_AGENTS_METHOD, COPILOT_LIST_PROMPTS_METHOD, COPILOT_LIST_CUSTOM_COMMANDS_METHOD, COPILOT_SET_WORKSPACE_METHOD, COPILOT_LIST_MODELS_METHOD, COPILOT_PERMISSION_REQUEST_EVENT, COPILOT_PERMISSION_RESPOND_METHOD, COPILOT_RESUME_SESSION_METHOD, COPILOT_SESSION_ABORT_METHOD, COPILOT_SESSION_DISCONNECT_METHOD, COPILOT_SESSION_EVENT, COPILOT_SESSION_GET_MESSAGES_METHOD, COPILOT_SESSION_LOG_METHOD, COPILOT_SESSION_SEND_AND_WAIT_METHOD, COPILOT_SESSION_SEND_METHOD, COPILOT_SESSION_EXECUTE_PROMPT_METHOD, COPILOT_SESSION_SET_AGENT_METHOD, COPILOT_SESSION_CLEAR_AGENT_METHOD, COPILOT_SESSION_SET_MODE_METHOD, COPILOT_SESSION_SET_MODEL_METHOD, RESTART_SERVER_METHOD, HEALTH_METHOD, PING_METHOD, PROTOCOL_VERSION, createRequest, } from "./protocol.js";
import { CopilotSession } from "./session.js";
export class CopilotClient {
    socket = null;
    requestCounter = 0;
    state = "disconnected";
    pendingRequests = new Map();
    permissionCallbacks = new Map();
    sessions = new Map();
    serverUrl;
    socketFactory;
    configuredWorkspaceCwd;
    constructor(options = {}) {
        this.serverUrl =
            options.serverUrl ?? options.cliUrl ?? "ws://127.0.0.1:39453";
        this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
        this.configuredWorkspaceCwd = options.cwd;
    }
    getState() {
        return this.state;
    }
    async start() {
        if (this.state === "connected") {
            return;
        }
        this.state = "connecting";
        this.socket = this.socketFactory(this.serverUrl);
        await new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error("socket not initialized"));
                return;
            }
            this.socket.addEventListener("open", () => resolve(), { once: true });
            this.socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
        });
        this.socket.addEventListener("message", (event) => {
            this.handleMessage(event);
        });
        this.socket.addEventListener("close", () => {
            this.state = "disconnected";
            this.rejectAllPending(new Error("Connection is closed"));
        });
        this.state = "connected";
        if (this.configuredWorkspaceCwd) {
            await this.sendRequest(COPILOT_SET_WORKSPACE_METHOD, {
                cwd: this.configuredWorkspaceCwd,
            });
        }
    }
    async stop() {
        const errors = [];
        try {
            const disconnects = Array.from(this.sessions.values()).map((session) => session.disconnect());
            await Promise.all(disconnects);
        }
        catch (error) {
            errors.push(error);
        }
        this.permissionCallbacks.clear();
        this.sessions.clear();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.state = "disconnected";
        return errors;
    }
    async forceStop() {
        this.permissionCallbacks.clear();
        this.sessions.clear();
        this.rejectAllPending(new Error("Connection is closed"));
        this.socket?.close();
        this.socket = null;
        this.state = "disconnected";
    }
    async ping(message) {
        return this.sendRequest(PING_METHOD, { message });
    }
    async getStatus() {
        const response = await this.sendRequest(HEALTH_METHOD, {});
        return {
            version: response.version,
            protocolVersion: response.protocolVersion ?? Number.parseFloat(PROTOCOL_VERSION),
        };
    }
    async getAuthStatus() {
        return this.sendRequest(COPILOT_GET_AUTH_STATUS_METHOD, {});
    }
    async listModels() {
        return this.sendRequest(COPILOT_LIST_MODELS_METHOD, {});
    }
    async listAgents() {
        return this.sendRequest(COPILOT_LIST_AGENTS_METHOD, {});
    }
    async listCustomCommands() {
        return this.sendRequest(COPILOT_LIST_CUSTOM_COMMANDS_METHOD, {});
    }
    async listPrompts() {
        return this.sendRequest(COPILOT_LIST_PROMPTS_METHOD, {});
    }
    async setWorkspace(cwd) {
        this.configuredWorkspaceCwd = cwd;
        return this.sendRequest(COPILOT_SET_WORKSPACE_METHOD, {
            cwd,
        });
    }
    async restartServer() {
        return this.sendRequest(RESTART_SERVER_METHOD, {});
    }
    async createSession(config) {
        const callbackId = crypto.randomUUID();
        this.permissionCallbacks.set(callbackId, config.onPermissionRequest ?? approveAll);
        const payload = {
            callbackId,
            config: stripCallbacks(config),
        };
        const result = await this.sendRequest(COPILOT_CREATE_SESSION_METHOD, payload, 30000);
        const session = new CopilotSession(result.sessionId, this, config.onEvent);
        this.sessions.set(result.sessionId, session);
        return session;
    }
    async resumeSession(sessionId, config) {
        const callbackId = crypto.randomUUID();
        this.permissionCallbacks.set(callbackId, config.onPermissionRequest ?? approveAll);
        const result = await this.sendRequest(COPILOT_RESUME_SESSION_METHOD, {
            sessionId,
            callbackId,
            config: stripCallbacks(config),
        }, 30000);
        const resumed = new CopilotSession(result.sessionId, this, config.onEvent);
        this.sessions.set(result.sessionId, resumed);
        return resumed;
    }
    async _sessionSend(sessionId, options) {
        const response = await this.sendRequest(COPILOT_SESSION_SEND_METHOD, { sessionId, options }, 20000);
        return response.messageId;
    }
    async _sessionSendAndWait(sessionId, options, timeout) {
        return this.sendRequest(COPILOT_SESSION_SEND_AND_WAIT_METHOD, {
            sessionId,
            options,
            timeout,
        }, timeout ? Math.max(timeout + 500, 1000) : 20000);
    }
    async _sessionDisconnect(sessionId) {
        await this.sendRequest(COPILOT_SESSION_DISCONNECT_METHOD, { sessionId });
        this.sessions.delete(sessionId);
    }
    async _sessionGetMessages(sessionId) {
        return this.sendRequest(COPILOT_SESSION_GET_MESSAGES_METHOD, { sessionId });
    }
    async _sessionAbort(sessionId) {
        await this.sendRequest(COPILOT_SESSION_ABORT_METHOD, { sessionId });
    }
    async _sessionLog(sessionId, message, options) {
        await this.sendRequest(COPILOT_SESSION_LOG_METHOD, {
            sessionId,
            message,
            level: options?.level,
            ephemeral: options?.ephemeral,
        });
    }
    async _sessionSetModel(sessionId, model, options) {
        await this.sendRequest(COPILOT_SESSION_SET_MODEL_METHOD, {
            sessionId,
            model,
            reasoningEffort: options?.reasoningEffort,
        });
    }
    async _sessionSetAgent(sessionId, agentId) {
        await this.sendRequest(COPILOT_SESSION_SET_AGENT_METHOD, {
            sessionId,
            agentId,
        });
    }
    async _sessionClearAgent(sessionId) {
        await this.sendRequest(COPILOT_SESSION_CLEAR_AGENT_METHOD, { sessionId });
    }
    async _sessionSetMode(sessionId, mode) {
        await this.sendRequest(COPILOT_SESSION_SET_MODE_METHOD, {
            sessionId,
            mode,
        });
    }
    async _sessionExecutePrompt(sessionId, promptId, args) {
        return this.sendRequest(COPILOT_SESSION_EXECUTE_PROMPT_METHOD, {
            sessionId,
            promptId,
            args,
        });
    }
    async sendRequest(method, payload, timeoutMs = 5000) {
        await this.start();
        const socket = this.socket;
        if (!socket) {
            throw new Error("socket not connected");
        }
        const id = `req-${++this.requestCounter}`;
        const response = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, timeoutMs);
            this.pendingRequests.set(id, {
                resolve,
                reject,
                timer,
            });
            socket.send(JSON.stringify(createRequest(id, method, payload)));
        });
        if (!response.ok) {
            throw new Error(response.error?.message ?? "Unknown response error");
        }
        return response.payload;
    }
    handleMessage(event) {
        let parsed;
        try {
            parsed = JSON.parse(event.data);
        }
        catch {
            return;
        }
        if (parsed.type === "response") {
            const pending = this.pendingRequests.get(parsed.id);
            if (!pending) {
                return;
            }
            clearTimeout(pending.timer);
            this.pendingRequests.delete(parsed.id);
            pending.resolve(parsed);
            return;
        }
        if (parsed.type !== "event") {
            return;
        }
        if (parsed.event === COPILOT_PERMISSION_REQUEST_EVENT) {
            void this.handlePermissionEvent(parsed.payload);
            return;
        }
        if (parsed.event === COPILOT_SESSION_EVENT) {
            const payload = parsed.payload;
            const session = this.sessions.get(payload.sessionId);
            session?._dispatchEvent(payload.event);
        }
    }
    async handlePermissionEvent(payload) {
        const handler = this.permissionCallbacks.get(payload.callbackId) ?? approveAll;
        let result;
        try {
            result = await handler(payload.permissionRequest, {
                sessionId: payload.sessionId,
            });
        }
        catch {
            result = {
                kind: "denied-no-approval-rule-and-could-not-request-from-user",
            };
        }
        await this.sendRequest(COPILOT_PERMISSION_RESPOND_METHOD, {
            requestId: payload.requestId,
            result,
        });
    }
    rejectAllPending(reason) {
        for (const [id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timer);
            pending.reject(reason);
            this.pendingRequests.delete(id);
        }
    }
}
/**
 * Legacy transport wrapper retained for backward compatibility.
 * Prefer direct `CopilotClient` usage for SDK-like integration.
 */
export class CopilotTransportClient {
    client;
    constructor(serverUrl, socketFactory) {
        this.client = new CopilotClient({ serverUrl, socketFactory });
    }
    async getStatus() {
        const status = await this.client.getStatus();
        return {
            state: "ready",
            version: status.version,
            protocolVersion: status.protocolVersion,
        };
    }
    async ping(message) {
        const pong = await this.client.ping(message);
        return {
            pong: true,
            message: pong.message,
            timestamp: pong.timestamp,
        };
    }
    async getAuthState() {
        const auth = await this.client.getAuthStatus();
        return {
            configured: auth.isAuthenticated,
            provider: auth.authType ?? "assumed",
            statusMessage: auth.statusMessage,
        };
    }
    async complete(prompt, _maxTokens) {
        const models = await this.client.listModels();
        const selectedModel = models[0]?.id ?? "mock-copilot";
        const session = await this.client.createSession({ model: selectedModel });
        try {
            const event = await session.sendAndWait({ prompt });
            const content = event && typeof event.data?.content === "string"
                ? event.data.content
                : "";
            return {
                text: content,
                model: selectedModel,
            };
        }
        finally {
            await session.disconnect();
        }
    }
    async listModels() {
        return this.client.listModels();
    }
    async listAgents() {
        return this.client.listAgents();
    }
    async listCustomCommands() {
        return this.client.listCustomCommands();
    }
    async listPrompts() {
        return this.client.listPrompts();
    }
    async setWorkspace(cwd) {
        return this.client.setWorkspace(cwd);
    }
    async restartServer() {
        return this.client.restartServer();
    }
    async createSession(model) {
        const session = await this.client.createSession({ model });
        return {
            sessionId: session.sessionId,
            model: model ?? "",
        };
    }
    async stop() {
        return this.client.stop();
    }
}
function stripCallbacks(config) {
    const { onPermissionRequest: _onPermissionRequest, onEvent: _onEvent, ...rest } = config;
    return rest;
}
export const approveAll = () => ({ kind: "approved" });
//# sourceMappingURL=websocket-client.js.map