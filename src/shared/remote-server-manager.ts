import { spawn, type ChildProcess } from "child_process";

export type RemoteServerState = "stopped" | "starting" | "running" | "error";

export interface RemoteServerManagerOptions {
	executablePath: string;
	serverUrl: string;
	port: number;
	startupTimeoutMs: number;
	requestTimeoutMs: number;
	cwd?: string;
	logger?: Pick<Console, "info" | "warn" | "error">;
	env?: Record<string, string>;
}

export class RemoteServerManager {
	private process: ChildProcess | null = null;
	private state: RemoteServerState = "stopped";
	private lastError: Error | null = null;
	private startupLogBuffer = "";

	constructor(private readonly options: RemoteServerManagerOptions) {}

	getState(): RemoteServerState {
		return this.state;
	}

	getLastError(): Error | null {
		return this.lastError;
	}

	async start(): Promise<void> {
		if (this.state === "running") {
			return;
		}

		if (this.state === "starting") {
			if (!this.process) {
				throw new Error(
					"Bundled remote server is marked as starting but no process is running.",
				);
			}

			await this.waitForReady(
				this.process,
				this.options.startupTimeoutMs,
			);
			return;
		}

		this.state = "starting";
		this.lastError = null;

		const child = spawn(this.options.executablePath, [], {
			cwd: this.options.cwd,
			env: {
				...process.env,
				...this.options.env,
				COPILOT_RUNTIME_SDK_SERVER_PORT: String(this.options.port),
			},
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		this.process = child;
		this.startupLogBuffer = "";
		child.stdout?.on("data", (chunk: Buffer | string) => {
			this.appendStartupLog(chunk);
			this.options.logger?.info?.(
				`[RemoteServerManager] ${String(chunk).trim()}`,
			);
		});
		child.stderr?.on("data", (chunk: Buffer | string) => {
			this.appendStartupLog(chunk);
			this.options.logger?.warn?.(
				`[RemoteServerManager] ${String(chunk).trim()}`,
			);
		});
		child.once("exit", (code, signal) => {
			if (this.process !== child) {
				return;
			}

			this.process = null;
			if (this.state === "running" || this.state === "starting") {
				this.state = "error";
				this.lastError = new Error(
					`Bundled remote server exited unexpectedly (code=${String(code)}, signal=${String(signal)})`,
				);
			}
		});

		try {
			await this.waitForReady(child, this.options.startupTimeoutMs);
			this.state = "running";
		} catch (error) {
			this.state = "error";
			this.lastError = error as Error;
			await this.stop();
			throw error;
		}
	}

	async stop(): Promise<void> {
		const child = this.process;
		this.process = null;

		if (!child) {
			if (this.state !== "error") {
				this.state = "stopped";
			}
			return;
		}

		await new Promise<void>((resolve) => {
			child.once("exit", () => resolve());
			const killed = child.kill();
			if (!killed) {
				resolve();
			}
		});

		this.state = "stopped";
	}

	private waitForReady(
		child: ChildProcess,
		timeoutMs: number,
	): Promise<void> {
		if (this.hasReadyMarker(this.startupLogBuffer)) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			let settled = false;

			const cleanup = () => {
				window.clearTimeout(timeoutHandle);
				child.stdout?.off("data", onData);
				child.stderr?.off("data", onData);
				child.off("exit", onExit);
			};

			const finish = (result: "ready" | "timeout" | "exit") => {
				if (settled) {
					return;
				}
				settled = true;
				cleanup();

				if (result === "ready") {
					resolve();
					return;
				}

				if (result === "exit") {
					reject(
						new Error(
							"Bundled remote server exited before it became ready.",
						),
					);
					return;
				}

				reject(
					new Error(
						`Timed out waiting for bundled remote server at ${this.options.serverUrl}`,
					),
				);
			};

			const onData = (chunk: Buffer | string) => {
				this.appendStartupLog(chunk);
				if (this.hasReadyMarker(this.startupLogBuffer)) {
					finish("ready");
				}
			};

			const onExit = () => finish("exit");

			const timeoutHandle = window.setTimeout(
				() => finish("timeout"),
				timeoutMs,
			);

			child.stdout?.on("data", onData);
			child.stderr?.on("data", onData);
			child.once("exit", onExit);
		});
	}

	private appendStartupLog(chunk: Buffer | string): void {
		const text = String(chunk);
		if (!text) {
			return;
		}

		this.startupLogBuffer += text;
		if (this.startupLogBuffer.length > 4096) {
			this.startupLogBuffer = this.startupLogBuffer.slice(-4096);
		}
	}

	private hasReadyMarker(buffer: string): boolean {
		if (!buffer) {
			return false;
		}

		const normalized = buffer.toLowerCase();
		const expectedUrl = this.options.serverUrl.toLowerCase();
		const expectedPort = String(this.options.port);

		if (normalized.includes(`listening on ${expectedUrl}`)) {
			return true;
		}

		return (
			normalized.includes("listening on") &&
			normalized.includes(`:${expectedPort}`)
		);
	}
}
