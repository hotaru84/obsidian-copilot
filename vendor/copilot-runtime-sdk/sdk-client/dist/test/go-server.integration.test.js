import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CopilotClient } from "../src/websocket-client.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "../../..");
const goServerDir = resolve(workspaceRoot, "packages/server-go");
const goServerBin = resolve(goServerDir, process.platform === "win32"
    ? "client-integration-server.exe"
    : "client-integration-server");
function wait(ms) {
    return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}
function randomPort() {
    return 43000 + Math.floor(Math.random() * 2000);
}
async function waitForServer(port) {
    for (let i = 0; i < 40; i += 1) {
        try {
            const socket = new WebSocket(`ws://127.0.0.1:${port}`);
            await new Promise((resolveReady, rejectReady) => {
                const onOpen = () => {
                    socket.removeEventListener("error", onError);
                    resolveReady();
                };
                const onError = () => {
                    socket.removeEventListener("open", onOpen);
                    rejectReady(new Error("connect failed"));
                };
                socket.addEventListener("open", onOpen, { once: true });
                socket.addEventListener("error", onError, { once: true });
            });
            socket.close();
            return;
        }
        catch {
            await wait(100);
        }
    }
    throw new Error(`Go server did not start on port ${port}`);
}
function buildGoServerBinary() {
    const build = spawnSync("go", ["build", "-o", goServerBin, "."], {
        cwd: goServerDir,
        encoding: "utf-8",
        env: process.env,
    });
    if (build.status !== 0) {
        throw new Error(build.stderr || build.stdout || "failed to build Go server");
    }
}
async function startGoServer(port) {
    buildGoServerBinary();
    const child = spawn(goServerBin, [], {
        cwd: goServerDir,
        env: {
            ...process.env,
            COPILOT_BRIDGE_DISABLE_SDK: "1",
            COPILOT_RUNTIME_SDK_SERVER_PORT: `${port}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
    });
    child.on("exit", (code) => {
        if (code && code !== 0) {
            process.stderr.write(stderr);
        }
    });
    await waitForServer(port);
    return child;
}
async function stopGoServer(child) {
    if (child.exitCode !== null) {
        return;
    }
    await new Promise((resolveStop) => {
        child.once("exit", () => resolveStop());
        child.kill();
        setTimeout(() => {
            if (child.exitCode === null) {
                child.kill("SIGKILL");
            }
        }, 2000);
    });
    if (existsSync(goServerBin)) {
        rmSync(goServerBin, { force: true });
    }
}
describe("CopilotClient + Go server", () => {
    const children = [];
    afterEach(async () => {
        while (children.length > 0) {
            const child = children.pop();
            if (child) {
                await stopGoServer(child);
            }
        }
    });
    it("works end-to-end against the Go mock server", async () => {
        const port = randomPort();
        const child = await startGoServer(port);
        children.push(child);
        const client = new CopilotClient({
            serverUrl: `ws://127.0.0.1:${port}`,
        });
        await client.start();
        const status = await client.getStatus();
        const auth = await client.getAuthStatus();
        const models = await client.listModels();
        let permissionSeen = false;
        const session = await client.createSession({
            includeSubAgentStreamingEvents: false,
            customAgents: [
                {
                    name: "skill-agent",
                    skills: ["test-skill"],
                },
            ],
            defaultAgent: {
                excludedTools: ["run_in_terminal"],
            },
            agent: "skill-agent",
            skillDirectories: ["C:/workspace/.skills"],
            disabledSkills: ["disabled-skill"],
            onPermissionRequest: async (request) => {
                permissionSeen = request.kind === "shell";
                return { kind: "approve-once" };
            },
        });
        const agentList = await session.rpc.agent.list();
        const currentAgent = await session.rpc.agent.getCurrent();
        await session.rpc.agent.select("explore");
        await session.rpc.agent.deselect();
        const reloadedAgents = await session.rpc.agent.reload();
        const plan = await session.rpc.plan.read();
        await session.rpc.plan.update("# Test Plan\n\n- item");
        await session.rpc.plan.delete();
        const approveAll = await session.rpc.permissions.setApproveAll(true);
        const resetApprovals = await session.rpc.permissions.resetSessionApprovals();
        const sessionMcp = await session.rpc.mcp.list();
        await session.rpc.mcp.reload();
        const sessionSkills = await session.rpc.skills.list();
        const instructionSources = await session.rpc.instructions.getSources();
        const discoveredMcp = await client.rpc.mcp.discover();
        const mcpConfig = await client.rpc.mcp.config.list();
        const discoveredSkills = await client.rpc.skills.discover();
        await client.rpc.skills.config.setDisabledSkills(["disabled-skill"]);
        const event = await session.sendAndWait({
            prompt: "run echo done",
        });
        expect(status.version).toContain("bridge-v1.2");
        expect(status.protocolVersion).toBe(1);
        expect(auth.isAuthenticated).toBe(true);
        expect(models.some((model) => model.id === "mock-copilot")).toBe(true);
        expect(permissionSeen).toBe(true);
        expect(agentList.agents.length).toBeGreaterThan(0);
        expect(currentAgent.agent).toBeNull();
        expect(reloadedAgents.agents.length).toBeGreaterThan(0);
        expect(plan.exists).toBe(false);
        expect(approveAll.success).toBe(true);
        expect(resetApprovals.success).toBe(true);
        expect(sessionMcp.servers).toEqual([]);
        expect(sessionSkills.skills).toEqual([]);
        expect(instructionSources.sources).toEqual([]);
        expect(discoveredMcp.servers).toEqual([]);
        expect(mcpConfig.servers).toEqual({});
        expect(discoveredSkills.skills).toEqual([]);
        expect(event?.type).toBe("assistant.message");
        expect(event?.data.content).toContain("done");
        await session.disconnect();
        await client.stop();
    }, 20000);
});
//# sourceMappingURL=go-server.integration.test.js.map