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
            onPermissionRequest: async (request) => {
                permissionSeen = request.kind === "shell";
                return { kind: "approve-once" };
            },
        });
        const event = await session.sendAndWait({
            prompt: "run echo done",
        });
        expect(status.version).toContain("bridge-v1.2");
        expect(status.protocolVersion).toBe(1);
        expect(auth.isAuthenticated).toBe(true);
        expect(models.some((model) => model.id === "mock-copilot")).toBe(true);
        expect(permissionSeen).toBe(true);
        expect(event?.type).toBe("assistant.message");
        expect(event?.data.content).toContain("done");
        await session.disconnect();
        await client.stop();
    });
});
//# sourceMappingURL=go-server.integration.test.js.map