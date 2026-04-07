export class CopilotSession {
    sessionId;
    client;
    eventHandlers = new Set();
    toolDefinitions = [];
    constructor(sessionId, client, onEvent) {
        this.sessionId = sessionId;
        this.client = client;
        if (onEvent) {
            this.eventHandlers.add(onEvent);
        }
    }
    async send(options) {
        return this.client._sessionSend(this.sessionId, options);
    }
    async sendAndWait(options, timeout) {
        return this.client._sessionSendAndWait(this.sessionId, options, timeout);
    }
    on(handler) {
        this.eventHandlers.add(handler);
        return () => {
            this.eventHandlers.delete(handler);
        };
    }
    registerTools(tools) {
        this.toolDefinitions = tools ?? [];
    }
    getToolNames() {
        return this.toolDefinitions.map((tool) => tool.name);
    }
    async getMessages() {
        return this.client._sessionGetMessages(this.sessionId);
    }
    async disconnect() {
        await this.client._sessionDisconnect(this.sessionId);
    }
    async abort() {
        await this.client._sessionAbort(this.sessionId);
    }
    async setModel(model, options) {
        await this.client._sessionSetModel(this.sessionId, model, options);
    }
    async setAgent(agentId) {
        await this.client._sessionSetAgent(this.sessionId, agentId);
    }
    async clearAgent() {
        await this.client._sessionClearAgent(this.sessionId);
    }
    async setMode(mode) {
        await this.client._sessionSetMode(this.sessionId, mode);
    }
    async executePrompt(promptId, args) {
        return this.client._sessionExecutePrompt(this.sessionId, promptId, args);
    }
    async log(message, options) {
        await this.client._sessionLog(this.sessionId, message, options);
    }
    _dispatchEvent(event) {
        for (const handler of this.eventHandlers) {
            handler(event);
        }
    }
}
//# sourceMappingURL=session.js.map