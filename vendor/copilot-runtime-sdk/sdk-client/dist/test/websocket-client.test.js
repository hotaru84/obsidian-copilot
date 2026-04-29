import { describe, expect, it } from "vitest";
import { CopilotClient, CopilotTransportClient, } from "../src/websocket-client.js";
class FakeSocket extends EventTarget {
    handler;
    readyState = 1;
    constructor(handler) {
        super();
        this.handler = handler;
    }
    send(data) {
        const response = this.handler(data);
        queueMicrotask(() => {
            this.dispatchEvent(new MessageEvent("message", { data: response }));
        });
    }
    close() {
        queueMicrotask(() => {
            this.dispatchEvent(new Event("close"));
        });
    }
}
describe("CopilotClient", () => {
    it("supports status, auth, models and session sendAndWait", async () => {
        const client = new CopilotClient({
            serverUrl: "ws://example.test",
            socketFactory: () => {
                const socket = new FakeSocket((data) => {
                    const request = JSON.parse(data);
                    if (request.method === "server.health") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                version: "bridge-v2",
                                protocolVersion: 1,
                            },
                        });
                    }
                    if (request.method === "server.restart") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                success: true,
                                restarted: true,
                                closedSessions: 0,
                            },
                        });
                    }
                    if (request.method === "copilot.getAuthStatus") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                isAuthenticated: true,
                                authType: "mock",
                                statusMessage: "ok",
                            },
                        });
                    }
                    if (request.method === "copilot.listModels") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: [{ id: "gpt-5", name: "GPT-5" }],
                        });
                    }
                    if (request.method === "copilot.listAgents") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: [
                                {
                                    id: "explore",
                                    name: "Explore",
                                    description: "Fast read-only codebase exploration",
                                    source: "project",
                                    enabled: true,
                                },
                            ],
                        });
                    }
                    if (request.method === "copilot.listCustomCommands") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: [
                                {
                                    name: "agent-customization",
                                    description: "Manage agent customization files",
                                    source: "project",
                                    enabled: true,
                                },
                            ],
                        });
                    }
                    if (request.method === "copilot.listPrompts") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: [
                                {
                                    id: "explain-code",
                                    name: "Explain Code",
                                    description: "Explain selected code",
                                },
                            ],
                        });
                    }
                    if (request.method === "copilot.setWorkspace") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                success: true,
                                appliesOnNextClientCreation: true,
                                cwd: "C:/workspace",
                            },
                        });
                    }
                    if (request.method === "copilot.createSession") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { sessionId: "session-1" },
                        });
                    }
                    if (request.method === "copilot.session.sendAndWait") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                type: "assistant.message",
                                data: {
                                    content: `Mock completion for: ${request.payload?.options?.prompt ?? ""}`,
                                },
                            },
                        });
                    }
                    if (request.method === "copilot.session.setAgent") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { success: true },
                        });
                    }
                    if (request.method === "copilot.session.clearAgent") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { success: true },
                        });
                    }
                    if (request.method === "copilot.session.setMode") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { success: true },
                        });
                    }
                    if (request.method === "copilot.session.executePrompt") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                type: "assistant.message",
                                data: {
                                    content: "Prompt executed",
                                },
                            },
                        });
                    }
                    if (request.method === "copilot.session.disconnect") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { success: true },
                        });
                    }
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: false,
                        error: {
                            code: "unsupported_method",
                            message: `Unsupported request: ${request.method}`,
                        },
                    });
                });
                queueMicrotask(() => {
                    socket.dispatchEvent(new Event("open"));
                });
                return socket;
            },
        });
        await client.start();
        expect(client.getState()).toBe("connected");
        const status = await client.getStatus();
        const auth = await client.getAuthStatus();
        const models = await client.listModels();
        const agents = await client.listAgents();
        const prompts = await client.listPrompts();
        const workspace = await client.setWorkspace("C:/workspace");
        const restart = await client.restartServer();
        const commands = await client.listCustomCommands();
        const session = await client.createSession({});
        await session.setAgent("explore");
        await session.clearAgent();
        await session.setMode("plan");
        const promptEvent = await session.executePrompt("explain-code", "x=1");
        const completion = await session.sendAndWait({
            prompt: "Write a function",
        });
        expect(status.version).toBe("bridge-v2");
        expect(auth.isAuthenticated).toBe(true);
        expect(models[0].id).toBe("gpt-5");
        expect(agents[0].name).toBe("Explore");
        expect(prompts[0].id).toBe("explain-code");
        expect(workspace.success).toBe(true);
        expect(restart.restarted).toBe(true);
        expect(commands[0].name).toBe("agent-customization");
        expect(promptEvent?.type).toBe("assistant.message");
        expect(completion?.type).toBe("assistant.message");
        expect(completion?.data.content).toContain("Write a function");
        await session.disconnect();
        const errors = await client.stop();
        expect(errors).toHaveLength(0);
        expect(client.getState()).toBe("disconnected");
    });
    it("supports ping payload", async () => {
        const client = new CopilotClient({
            serverUrl: "ws://example.test",
            socketFactory: () => {
                const socket = new FakeSocket((data) => {
                    const request = JSON.parse(data);
                    if (request.method === "server.ping") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                message: `pong: ${request.payload?.message ?? ""}`,
                                timestamp: 1,
                            },
                        });
                    }
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: { success: true },
                    });
                });
                queueMicrotask(() => {
                    socket.dispatchEvent(new Event("open"));
                });
                return socket;
            },
        });
        const pong = await client.ping("test message");
        expect(pong.message).toBe("pong: test message");
    });
    it("applies workspace from constructor option on connect", async () => {
        const observedMethods = [];
        const observedCwd = [];
        const client = new CopilotClient({
            serverUrl: "ws://example.test",
            cwd: "C:/workspace-from-options",
            socketFactory: () => {
                const socket = new FakeSocket((data) => {
                    const request = JSON.parse(data);
                    observedMethods.push(request.method);
                    if (request.method === "copilot.setWorkspace") {
                        observedCwd.push(request.payload?.cwd ?? "");
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                success: true,
                                appliesOnNextClientCreation: true,
                                cwd: request.payload?.cwd ?? "",
                            },
                        });
                    }
                    if (request.method === "server.health") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                version: "bridge-v2",
                                protocolVersion: 1,
                            },
                        });
                    }
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: { success: true },
                    });
                });
                queueMicrotask(() => {
                    socket.dispatchEvent(new Event("open"));
                });
                return socket;
            },
        });
        const status = await client.getStatus();
        expect(status.version).toBe("bridge-v2");
        expect(observedMethods).toEqual(["copilot.setWorkspace", "server.health"]);
        expect(observedCwd).toEqual(["C:/workspace-from-options"]);
        const errors = await client.stop();
        expect(errors).toHaveLength(0);
    });
    it("serializes mcpServers and config discovery settings", async () => {
        const requests = [];
        const client = new CopilotClient({
            serverUrl: "ws://example.test",
            socketFactory: () => {
                const socket = new FakeSocket((data) => {
                    const request = JSON.parse(data);
                    requests.push(request);
                    if (request.method === "copilot.createSession") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { sessionId: "session-created" },
                        });
                    }
                    if (request.method === "copilot.resumeSession") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: {
                                sessionId: request.payload?.sessionId ?? "session-resumed",
                            },
                        });
                    }
                    if (request.method === "copilot.session.disconnect") {
                        return JSON.stringify({
                            id: request.id,
                            type: "response",
                            ok: true,
                            payload: { success: true },
                        });
                    }
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: { success: true },
                    });
                });
                queueMicrotask(() => {
                    socket.dispatchEvent(new Event("open"));
                });
                return socket;
            },
        });
        await client.start();
        const config = {
            enableConfigDiscovery: true,
            mcpServers: {
                filesystem: {
                    type: "stdio",
                    command: "npx",
                    args: [
                        "-y",
                        "@modelcontextprotocol/server-filesystem",
                        "C:/workspace",
                    ],
                },
            },
            onPermissionRequest: () => ({ kind: "approve-once" }),
            onEvent: () => { },
        };
        const created = await client.createSession(config);
        const resumed = await client.resumeSession("session-existing", config);
        const createRequest = requests.find((request) => request.method === "copilot.createSession");
        const resumeRequest = requests.find((request) => request.method === "copilot.resumeSession");
        expect(createRequest?.payload?.config?.enableConfigDiscovery).toBe(true);
        expect(createRequest?.payload?.config?.mcpServers).toEqual(config.mcpServers);
        expect(createRequest?.payload?.config?.onPermissionRequest).toBeUndefined();
        expect(createRequest?.payload?.config?.onEvent).toBeUndefined();
        expect(resumeRequest?.payload?.sessionId).toBe("session-existing");
        expect(resumeRequest?.payload?.config?.enableConfigDiscovery).toBe(true);
        expect(resumeRequest?.payload?.config?.mcpServers).toEqual(config.mcpServers);
        expect(resumeRequest?.payload?.config?.onPermissionRequest).toBeUndefined();
        expect(resumeRequest?.payload?.config?.onEvent).toBeUndefined();
        await created.disconnect();
        await resumed.disconnect();
        const errors = await client.stop();
        expect(errors).toHaveLength(0);
    });
    it("supports legacy transport wrapper", async () => {
        const client = new CopilotTransportClient("ws://example.test", () => {
            const socket = new FakeSocket((data) => {
                const request = JSON.parse(data);
                if (request.method === "server.health") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            version: "bridge-v2",
                            protocolVersion: 1,
                        },
                    });
                }
                if (request.method === "server.ping") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            message: `pong: ${request.payload?.message ?? ""}`,
                            timestamp: 100,
                        },
                    });
                }
                if (request.method === "copilot.getAuthStatus") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            isAuthenticated: true,
                            authType: "assumed",
                            statusMessage: "ok",
                        },
                    });
                }
                if (request.method === "copilot.listModels") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: [{ id: "gpt-5", name: "GPT-5" }],
                    });
                }
                if (request.method === "copilot.listAgents") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: [
                            {
                                id: "explore",
                                name: "Explore",
                                description: "Fast read-only codebase exploration",
                                source: "project",
                                enabled: true,
                            },
                        ],
                    });
                }
                if (request.method === "copilot.listCustomCommands") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: [
                            {
                                name: "agent-customization",
                                description: "Manage agent customization files",
                                source: "project",
                                enabled: true,
                            },
                        ],
                    });
                }
                if (request.method === "copilot.listPrompts") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: [
                            {
                                id: "explain-code",
                                name: "Explain Code",
                                description: "Explain selected code",
                            },
                        ],
                    });
                }
                if (request.method === "copilot.setWorkspace") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            success: true,
                            appliesOnNextClientCreation: true,
                            cwd: "C:/workspace",
                        },
                    });
                }
                if (request.method === "copilot.createSession") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            sessionId: request.payload?.config?.model ?? "session-legacy",
                        },
                    });
                }
                if (request.method === "copilot.session.sendAndWait") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: {
                            type: "assistant.message",
                            data: {
                                content: `Mock completion for: ${request.payload?.options?.prompt ?? ""}`,
                            },
                        },
                    });
                }
                if (request.method === "copilot.session.disconnect") {
                    return JSON.stringify({
                        id: request.id,
                        type: "response",
                        ok: true,
                        payload: { success: true },
                    });
                }
                return JSON.stringify({
                    id: request.id,
                    type: "response",
                    ok: false,
                    error: {
                        code: "unsupported_method",
                        message: "Unsupported request",
                    },
                });
            });
            queueMicrotask(() => {
                socket.dispatchEvent(new Event("open"));
            });
            return socket;
        });
        const status = await client.getStatus();
        const ping = await client.ping("legacy");
        const auth = await client.getAuthState();
        const agents = await client.listAgents();
        const prompts = await client.listPrompts();
        const workspace = await client.setWorkspace("C:/workspace");
        const commands = await client.listCustomCommands();
        const completion = await client.complete("say hello", 64);
        const session = await client.createSession("gpt-5");
        expect(status.state).toBe("ready");
        expect(status.version).toBe("bridge-v2");
        expect(ping.pong).toBe(true);
        expect(auth.configured).toBe(true);
        expect(agents[0].name).toBe("Explore");
        expect(prompts[0].id).toBe("explain-code");
        expect(workspace.success).toBe(true);
        expect(commands[0].name).toBe("agent-customization");
        expect(completion.text).toContain("say hello");
        expect(completion.model).toBe("gpt-5");
        expect(session.sessionId).toBe("gpt-5");
        expect(session.model).toBe("gpt-5");
        const errors = await client.stop();
        expect(errors).toHaveLength(0);
    });
});
//# sourceMappingURL=websocket-client.test.js.map