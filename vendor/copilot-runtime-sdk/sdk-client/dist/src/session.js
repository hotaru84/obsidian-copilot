export class CopilotSession {
    sessionId;
    client;
    eventHandlers = new Set();
    toolDefinitions = [];
    rpc;
    constructor(sessionId, client, onEvent) {
        this.sessionId = sessionId;
        this.client = client;
        if (onEvent) {
            this.eventHandlers.add(onEvent);
        }
        this.rpc = {
            agent: {
                list: () => this.client._sessionAgentList(this.sessionId),
                getCurrent: () => this.client._sessionAgentGetCurrent(this.sessionId),
                select: (name) => this.client._sessionAgentSelect(this.sessionId, name),
                deselect: () => this.client._sessionAgentDeselect(this.sessionId),
                reload: () => this.client._sessionAgentReload(this.sessionId),
            },
            plan: {
                read: () => this.client._sessionPlanRead(this.sessionId),
                update: (content) => this.client._sessionPlanUpdate(this.sessionId, content),
                delete: () => this.client._sessionPlanDelete(this.sessionId),
            },
            permissions: {
                setApproveAll: (enabled) => this.client._sessionPermissionsSetApproveAll(this.sessionId, enabled),
                resetSessionApprovals: () => this.client._sessionPermissionsResetSessionApprovals(this.sessionId),
            },
            mcp: {
                list: () => this.client._sessionMCPList(this.sessionId),
                enable: (serverName) => this.client._sessionMCPEnable(this.sessionId, serverName),
                disable: (serverName) => this.client._sessionMCPDisable(this.sessionId, serverName),
                reload: () => this.client._sessionMCPReload(this.sessionId),
                oauth: {
                    login: (serverName, options) => this.client._sessionMCPOAuthLogin(this.sessionId, serverName, options),
                },
            },
            skills: {
                list: () => this.client._sessionSkillsList(this.sessionId),
                enable: (name) => this.client._sessionSkillsEnable(this.sessionId, name),
                disable: (name) => this.client._sessionSkillsDisable(this.sessionId, name),
                reload: () => this.client._sessionSkillsReload(this.sessionId),
            },
            instructions: {
                getSources: () => this.client._sessionInstructionsGetSources(this.sessionId),
            },
            model: {
                getCurrent: () => this.client._sessionModelGetCurrent(this.sessionId),
                switchTo: (modelId, options) => this.client._sessionModelSwitchTo(this.sessionId, modelId, options),
            },
            mode: {
                get: () => this.client._sessionModeGet(this.sessionId),
                set: (mode) => this.client._sessionModeSet(this.sessionId, mode),
            },
            workspaces: {
                getWorkspace: () => this.client._sessionWorkspacesGetWorkspace(this.sessionId),
                listFiles: () => this.client._sessionWorkspacesListFiles(this.sessionId),
                readFile: (path) => this.client._sessionWorkspacesReadFile(this.sessionId, path),
                createFile: (path, content) => this.client._sessionWorkspacesCreateFile(this.sessionId, path, content),
            },
            fleet: {
                start: (prompt) => this.client._sessionFleetStart(this.sessionId, prompt),
            },
            plugins: {
                list: () => this.client._sessionPluginsList(this.sessionId),
            },
            extensions: {
                list: () => this.client._sessionExtensionsList(this.sessionId),
                enable: (id) => this.client._sessionExtensionsEnable(this.sessionId, id),
                disable: (id) => this.client._sessionExtensionsDisable(this.sessionId, id),
                reload: () => this.client._sessionExtensionsReload(this.sessionId),
            },
            tools: {
                handlePendingToolCall: (requestId, result, error) => this.client._sessionToolsHandlePendingToolCall(this.sessionId, requestId, result, error),
            },
            commands: {
                handlePendingCommand: (requestId, error) => this.client._sessionCommandsHandlePendingCommand(this.sessionId, requestId, error),
            },
            ui: {
                elicitation: (message, requestedSchema) => this.client._sessionUIElicitation(this.sessionId, message, requestedSchema),
                handlePendingElicitation: (requestId, result) => this.client._sessionUIHandlePendingElicitation(this.sessionId, requestId, result),
            },
            shell: {
                exec: (command, options) => this.client._sessionShellExec(this.sessionId, command, options),
                kill: (processId, signal) => this.client._sessionShellKill(this.sessionId, processId, signal),
            },
            history: {
                compact: () => this.client._sessionHistoryCompact(this.sessionId),
                truncate: (eventId) => this.client._sessionHistoryTruncate(this.sessionId, eventId),
            },
            usage: {
                getMetrics: () => this.client._sessionUsageGetMetrics(this.sessionId),
            },
        };
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