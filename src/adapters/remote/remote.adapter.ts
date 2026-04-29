import type {
	AgentConnectionState,
	AgentConfig,
	ElicitationResult,
	HistoryCompactionResult,
	HistoryTruncationResult,
	InitializeResult,
	NewSessionResult,
} from "../../domain/ports/agent-client.port";
import type {
	ListSessionsResult,
	LoadSessionResult,
	ResumeSessionResult,
	ForkSessionResult,
} from "../../domain/models/session-info";
import type {
	ElicitationResponse,
	PermissionOption,
	MessageContent,
	ToolCallContent,
	ToolCallLocation,
	ToolKind,
	ToolCallStatus,
} from "../../domain/models/chat-message";
import type { PromptContent } from "../../domain/models/prompt-content";
import type { ProcessError } from "../../domain/models/agent-error";
import type { SessionUpdate } from "../../domain/models/session-update";
import type {
	PromptTemplateInfo,
	SlashCommand,
	SessionMode,
	SessionModel,
	SessionModeState,
	SessionModelState,
	RemoteAgentInfo,
	SessionRemoteAgentState,
	SessionUsageMetrics,
} from "../../domain/models/chat-session";
import type {
	IChatAgentClient,
	TerminalOutputRequestLike,
	TerminalOutputResponseLike,
} from "../../domain/ports/chat-agent-client.port";
import type AgentClientPlugin from "../../plugin";
import { getLogger, Logger } from "../../shared/logger";

import {
	CopilotClient,
	type CopilotSession,
	type SessionEvent,
	type PermissionRequest,
	type PermissionRequestResult,
	type MessageAttachment,
	type SessionMode as RemoteSessionMode,
	type SessionConfig as RemoteSessionConfig,
	type MCPServerConfig,
} from "../../../vendor/copilot-runtime-sdk/sdk-client/dist/src/index.js";

interface SessionState {
	session: CopilotSession;
	workingDirectory?: string;
	currentModeId: string;
	currentModelId?: string;
	currentRemoteAgentId: string | null;
	remoteAgentSelectionById: Map<string, string>;
	availableCommands: SlashCommand[];
	availableModels: SessionModel[];
	availableRemoteAgents: RemoteAgentInfo[];
	messageDeltaBuffer: string;
	thoughtDeltaBuffer: string;
}

interface PendingPermissionRequest {
	requestId: string;
	sessionId: string;
	toolCallId: string;
	options: PermissionOption[];
	resolve: (result: PermissionRequestResult) => void;
	selectedOptionId?: string;
}

interface TerminalSnapshot {
	output: string;
	truncated: boolean;
	exitStatus?: {
		exitCode?: number | null;
		signal?: string | null;
	} | null;
}

type CopilotClientOptionsWithCwd = ConstructorParameters<
	typeof CopilotClient
>[0] & {
	cwd?: string;
};

const REMOTE_MODES: SessionMode[] = [
	{ id: "interactive", name: "Interactive" },
	{ id: "plan", name: "Plan" },
	{ id: "autopilot", name: "Autopilot" },
];

const COPILOT_SESSION_AGENT_RELOAD_METHOD = "copilot.session.agent.reload";
const COPILOT_SESSION_HISTORY_COMPACT_METHOD =
	"copilot.session.history.compact";
const COPILOT_SESSION_HISTORY_TRUNCATE_METHOD =
	"copilot.session.history.truncate";
const COPILOT_SESSION_USAGE_GET_METRICS_METHOD =
	"copilot.session.usage.getMetrics";
const COPILOT_SESSION_UI_HANDLE_PENDING_ELICITATION_METHOD =
	"copilot.session.ui.handlePendingElicitation";
const CONNECTION_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

type RawCopilotClient = {
	sendRequest?: (
		method: string,
		payload: Record<string, unknown>,
		timeoutMs?: number,
	) => Promise<unknown>;
};

function toRemoteMode(modeId: string): RemoteSessionMode {
	if (
		modeId === "interactive" ||
		modeId === "plan" ||
		modeId === "autopilot"
	) {
		return modeId;
	}
	throw new Error(`Unsupported remote session mode: ${modeId}`);
}

function safeString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function isNonNull<T>(value: T | null): value is T {
	return value !== null;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function inferToolKind(kind: string | undefined): ToolKind {
	if (!kind) return "other";
	if (kind.includes("read")) return "read";
	if (kind.includes("write") || kind.includes("edit")) return "edit";
	if (kind.includes("delete")) return "delete";
	if (kind.includes("search")) return "search";
	if (kind.includes("shell") || kind.includes("command")) return "execute";
	if (kind.includes("fetch") || kind.includes("url")) return "fetch";
	if (kind.includes("mode")) return "switch_mode";
	if (kind === "memory") return "read";
	if (kind === "hook") return "execute";
	return "other";
}

function extractTextFromEvent(event: SessionEvent): string | undefined {
	const content = event.data?.content;
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((item) => {
				if (typeof item === "string") return item;
				if (item && typeof item === "object") {
					const maybeText = (item as Record<string, unknown>).text;
					if (typeof maybeText === "string") return maybeText;
					const maybeContent = (item as Record<string, unknown>)
						.content;
					if (typeof maybeContent === "string") return maybeContent;
				}
				return "";
			})
			.join("\n")
			.trim();
	}

	return undefined;
}

function extractRecordPath(
	record: Record<string, unknown>,
): string | undefined {
	return (
		safeString(record.path) ||
		safeString(record.filePath) ||
		safeString(record.file_path) ||
		safeString(record.targetPath) ||
		safeString(record.target_path) ||
		safeString(record.sourcePath) ||
		safeString(record.source_path)
	);
}

function extractRecordLine(
	record: Record<string, unknown>,
): number | null | undefined {
	return (
		safeNumber(record.line) ??
		safeNumber(record.startLine) ??
		safeNumber(record.start_line) ??
		null
	);
}

function collectToolLocations(
	value: unknown,
	results: ToolCallLocation[],
	seen: Set<string>,
	depth = 0,
): void {
	if (depth > 3 || value == null) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectToolLocations(item, results, seen, depth + 1);
		}
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	const record = value as Record<string, unknown>;
	const path = extractRecordPath(record);
	if (path) {
		const line = extractRecordLine(record);
		const key = `${path}:${line ?? ""}`;
		if (!seen.has(key)) {
			seen.add(key);
			results.push({ path, line });
		}
	}

	for (const key in record) {
		collectToolLocations(record[key], results, seen, depth + 1);
	}
}

function extractToolLocations(
	data: Record<string, unknown>,
): ToolCallLocation[] | undefined {
	const results: ToolCallLocation[] = [];
	collectToolLocations(data, results, new Set());
	return results.length > 0 ? results : undefined;
}

function pushToolContent(
	content: ToolCallContent[],
	item: ToolCallContent,
	seen: Set<string>,
): void {
	if (item.type === "terminal") {
		const key = `terminal:${item.terminalId}`;
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		content.push(item);
		return;
	}

	const key = `diff:${item.path}:${item.oldText ?? ""}:${item.newText}`;
	if (seen.has(key)) {
		return;
	}
	seen.add(key);
	content.push(item);
}

function collectToolContent(
	value: unknown,
	content: ToolCallContent[],
	seen: Set<string>,
	depth = 0,
): void {
	if (depth > 3 || value == null) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectToolContent(item, content, seen, depth + 1);
		}
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	const record = value as Record<string, unknown>;
	const terminalId =
		safeString(record.terminalId) || safeString(record.terminal_id);
	if (terminalId) {
		pushToolContent(content, { type: "terminal", terminalId }, seen);
	}

	const path = extractRecordPath(record);
	const newText =
		safeString(record.newText) ||
		safeString(record.new_text) ||
		safeString(record.after) ||
		safeString(record.content);
	const oldText =
		safeString(record.oldText) ||
		safeString(record.old_text) ||
		safeString(record.before);

	if (path && (newText !== undefined || oldText !== undefined)) {
		pushToolContent(
			content,
			{
				type: "diff",
				path,
				newText: newText ?? "",
				oldText,
			},
			seen,
		);
	}

	for (const key in record) {
		collectToolContent(record[key], content, seen, depth + 1);
	}
}

function extractToolContent(
	data: Record<string, unknown>,
): ToolCallContent[] | undefined {
	const content: ToolCallContent[] = [];
	collectToolContent(data, content, new Set());
	return content.length > 0 ? content : undefined;
}

export class RemoteAdapter implements IChatAgentClient {
	private logger: Logger;
	private client: CopilotClient | null = null;
	private isInitializedFlag = false;
	private currentAgentId: string | null = null;
	private currentConfig: AgentConfig | null = null;

	private sessionUpdateCallback: ((update: SessionUpdate) => void) | null =
		null;
	private errorCallback: ((error: ProcessError) => void) | null = null;
	private updateMessage: (
		toolCallId: string,
		content: MessageContent,
	) => void = () => {};

	private sessionStates = new Map<string, SessionState>();
	private lastSelectedRemoteAgentByWorkingDirectory = new Map<
		string,
		string
	>();
	private remoteAgentSelectionSupportByWorkingDirectory = new Map<
		string,
		boolean
	>();

	private pendingPermissions = new Map<string, PendingPermissionRequest>();
	private permissionQueuesBySession = new Map<string, string[]>();
	private activePermissionRequestBySession = new Map<string, string | null>();
	private terminalSnapshots = new Map<string, TerminalSnapshot>();
	private autoAllowPermissions = false;
	private autoAllowPermissionsOverride: boolean | null = null;

	constructor(private plugin: AgentClientPlugin) {
		this.logger = getLogger();
	}

	setUpdateMessageCallback(
		updateMessage: (toolCallId: string, content: MessageContent) => void,
	): void {
		this.updateMessage = updateMessage;
	}

	setAutoAllowPermissionsOverride(value: boolean | null): void {
		this.autoAllowPermissionsOverride = value;
	}

	private getActivePermissionRequestId(sessionId: string): string | null {
		return this.activePermissionRequestBySession.get(sessionId) ?? null;
	}

	private setActivePermissionRequestId(
		sessionId: string,
		requestId: string | null,
	): void {
		if (requestId === null) {
			this.activePermissionRequestBySession.delete(sessionId);
			return;
		}
		this.activePermissionRequestBySession.set(sessionId, requestId);
	}

	private enqueuePermission(sessionId: string, requestId: string): void {
		const queue = this.permissionQueuesBySession.get(sessionId) ?? [];
		queue.push(requestId);
		this.permissionQueuesBySession.set(sessionId, queue);
	}

	private dequeuePermission(sessionId: string): string | undefined {
		const queue = this.permissionQueuesBySession.get(sessionId);
		if (!queue || queue.length === 0) {
			return undefined;
		}

		const next = queue.shift();
		if (queue.length === 0) {
			this.permissionQueuesBySession.delete(sessionId);
		} else {
			this.permissionQueuesBySession.set(sessionId, queue);
		}

		return next;
	}

	private rememberRemoteAgentSelection(
		workingDirectory: string | undefined,
		agentId: string | null,
	): void {
		if (!workingDirectory) {
			return;
		}

		if (agentId === null) {
			this.lastSelectedRemoteAgentByWorkingDirectory.delete(
				workingDirectory,
			);
			return;
		}

		this.lastSelectedRemoteAgentByWorkingDirectory.set(
			workingDirectory,
			agentId,
		);
	}

	private getRememberedRemoteAgentSelection(
		workingDirectory: string | undefined,
	): string | null {
		if (!workingDirectory) {
			return null;
		}

		return (
			this.lastSelectedRemoteAgentByWorkingDirectory.get(
				workingDirectory,
			) ?? null
		);
	}

	private async restoreSessionRemoteAgentSelection(
		sessionId: string,
		remoteAgents: SessionRemoteAgentState | undefined,
	): Promise<SessionRemoteAgentState | undefined> {
		if (!remoteAgents || remoteAgents.availableAgents.length === 0) {
			return remoteAgents;
		}

		const state = this.getSessionState(sessionId);
		const rememberedAgentId = this.getRememberedRemoteAgentSelection(
			state.workingDirectory,
		);

		if (!rememberedAgentId) {
			return remoteAgents;
		}

		const isAvailable = remoteAgents.availableAgents.some(
			(agent) => agent.agentId === rememberedAgentId,
		);

		if (!isAvailable) {
			this.rememberRemoteAgentSelection(state.workingDirectory, null);
			return {
				...remoteAgents,
				currentAgentId: null,
			};
		}

		try {
			await this.setSessionAgent(sessionId, rememberedAgentId);
			return {
				...remoteAgents,
				currentAgentId: rememberedAgentId,
			};
		} catch (error) {
			this.logger.warn(
				`[RemoteAdapter] Failed to restore remote agent '${rememberedAgentId}' for session '${sessionId}'`,
				error,
			);
			return {
				...remoteAgents,
				currentAgentId: null,
			};
		}
	}

	private async supportsRemoteAgentSelection(
		session: CopilotSession,
		workingDirectory: string | undefined,
		agents: RemoteAgentInfo[],
	): Promise<boolean> {
		if (agents.length === 0) {
			return false;
		}

		const cacheKey = workingDirectory ?? "__default__";
		const cached =
			this.remoteAgentSelectionSupportByWorkingDirectory.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		const probeAgentId = agents[0]?.agentId;
		if (!probeAgentId) {
			this.remoteAgentSelectionSupportByWorkingDirectory.set(
				cacheKey,
				false,
			);
			return false;
		}

		try {
			await session.setAgent(probeAgentId);
			await session.clearAgent();
			this.remoteAgentSelectionSupportByWorkingDirectory.set(
				cacheKey,
				true,
			);
			return true;
		} catch (error) {
			this.logger.warn(
				`[RemoteAdapter] Runtime listed agents but selection failed for probe '${probeAgentId}'. Hiding remote agent selector for this workspace.`,
				error,
			);
			this.remoteAgentSelectionSupportByWorkingDirectory.set(
				cacheKey,
				false,
			);
			return false;
		}
	}

	private getClient(cwd?: string): CopilotClient {
		if (this.client) {
			return this.client;
		}

		const initialCwd = cwd ?? this.currentConfig?.workingDirectory;
		const clientOptions: CopilotClientOptionsWithCwd = {
			serverUrl: this.plugin.getRemoteServerUrl(),
			...(initialCwd ? { cwd: initialCwd } : {}),
		};

		this.client = new CopilotClient(clientOptions);
		return this.client;
	}

	private async syncWorkspace(cwd?: string): Promise<void> {
		if (!cwd) {
			return;
		}

		const client = this.getClient(cwd);
		await this.ensureClientStarted(client, "set workspace");
		this.logger.log(`[RemoteAdapter] Setting workspace to: ${cwd}`);
		await client.setWorkspace(cwd);
	}

	private async withRetryBackoff<T>(
		fn: () => Promise<T>,
		context: string,
	): Promise<T> {
		let lastError: unknown = null;

		for (
			let attempt = 0;
			attempt < CONNECTION_RETRY_DELAYS_MS.length;
			attempt++
		) {
			try {
				return await fn();
			} catch (error) {
				lastError = error;
				this.logger.warn(
					`[RemoteAdapter] Attempt ${attempt + 1} failed for ${context}:`,
					error,
				);

				if (attempt === CONNECTION_RETRY_DELAYS_MS.length - 1) {
					break;
				}
				await delay(CONNECTION_RETRY_DELAYS_MS[attempt]);
			}
		}

		throw new Error(
			`Failed to ${context} after ${CONNECTION_RETRY_DELAYS_MS.length} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
		);
	}

	private async ensureClientStarted(
		client: CopilotClient,
		context: string,
	): Promise<void> {
		await this.withRetryBackoff(async () => {
			if (client.getState() !== "connected") {
				await client.start();
			}
		}, context);
	}

	private async sendRawClientRequest<T>(
		client: CopilotClient,
		method: string,
		payload: Record<string, unknown>,
		timeoutMs = 10000,
	): Promise<T> {
		await this.ensureClientStarted(client, method);
		const rawClient = client as unknown as RawCopilotClient;
		if (typeof rawClient.sendRequest !== "function") {
			throw new Error(
				`Remote SDK client does not expose raw request support for ${method}.`,
			);
		}

		return (await rawClient.sendRequest(method, payload, timeoutMs)) as T;
	}

	private async reloadSessionAgents(
		sessionId: string,
		workingDirectory?: string,
	): Promise<void> {
		const client = this.getClient(workingDirectory);
		await this.sendRawClientRequest<void>(
			client,
			COPILOT_SESSION_AGENT_RELOAD_METHOD,
			{ sessionId },
		);
	}

	private normalizePromptInfo(prompt: unknown): PromptTemplateInfo | null {
		if (!prompt || typeof prompt !== "object") {
			return null;
		}

		const record = prompt as Record<string, unknown>;
		const promptId = safeString(record.id);
		const name = safeString(record.name);
		if (!promptId || !name) {
			return null;
		}

		return {
			promptId,
			name,
			description: safeString(record.description),
			prompt: safeString(record.prompt),
		};
	}

	private async ensureBundledServer(): Promise<void> {
		if (this.plugin.settings.remoteRuntime.serverMode !== "bundled") {
			return;
		}

		if (!this.plugin.settings.remoteRuntime.autoStartBundledServer) {
			return;
		}

		const manager = this.plugin.getOrCreateRemoteServerManager();
		if (!manager) {
			throw new Error(
				"Bundled remote server is not available. Run npm run sync:remote-sdk and rebuild the plugin.",
			);
		}

		await manager.start();
	}

	private parseMcpServersJson(): Record<string, MCPServerConfig> | undefined {
		const raw = this.plugin.settings.remoteRuntime.mcpServersJson?.trim();
		if (!raw) {
			return undefined;
		}

		try {
			const parsed: unknown = JSON.parse(raw);
			if (
				!parsed ||
				typeof parsed !== "object" ||
				Array.isArray(parsed)
			) {
				this.logger.warn(
					"[RemoteAdapter] Ignoring MCP servers config because JSON root is not an object.",
				);
				return undefined;
			}
			return parsed as Record<string, MCPServerConfig>;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.logger.warn(
				`[RemoteAdapter] Failed to parse MCP servers JSON: ${message}`,
			);
			return undefined;
		}
	}

	private buildSessionConfig(
		base: Omit<
			RemoteSessionConfig,
			"enableConfigDiscovery" | "mcpServers" | "configDir"
		>,
	): RemoteSessionConfig {
		const mcpServers = this.parseMcpServersJson();
		return {
			...base,
			enableConfigDiscovery:
				this.plugin.settings.remoteRuntime.enableConfigDiscovery,
			...(mcpServers ? { mcpServers } : {}),
		};
	}

	async initialize(config: AgentConfig): Promise<InitializeResult> {
		this.currentConfig = config;
		this.autoAllowPermissions = this.plugin.settings.autoAllowPermissions;

		await this.ensureBundledServer();

		const client = this.getClient(config.workingDirectory);

		return await this.withRetryBackoff(async () => {
			await this.ensureClientStarted(client, "initialize remote runtime");

			const [status, auth] = await Promise.all([
				client.getStatus(),
				client.getAuthStatus().catch(() => ({
					isAuthenticated: false,
					authType: "copilot",
				})),
			]);

			this.isInitializedFlag = true;
			this.currentAgentId = config.id;

			return {
				authMethods: auth.isAuthenticated
					? []
					: [
							{
								id: "copilot-login",
								name: "Copilot Login",
								description:
									"Authenticate GitHub Copilot on the remote runtime host.",
							},
						],
				protocolVersion: status.protocolVersion,
				agentCapabilities: {
					loadSession: true,
					sessionCapabilities: {
						list: {},
						resume: {},
						fork: {},
					},
					promptCapabilities: {
						image: true,
					},
				},
				agentInfo: {
					name: "copilot-runtime-sdk",
					title: "Copilot Remote Runtime",
					version: status.version,
				},
				promptCapabilities: {
					image: true,
				},
			};
		}, "initialize remote runtime");
	}

	private async buildSessionSnapshot(
		session: CopilotSession,
		workingDirectory?: string,
	): Promise<{
		modes: SessionModeState;
		models?: SessionModelState;
		commands: SlashCommand[];
		remoteAgents?: SessionRemoteAgentState;
	}> {
		// Use the existing shared client for snapshot operations
		const client = this.getClient(workingDirectory);
		await this.ensureClientStarted(client, "load remote session snapshot");
		const [models, customCommands, agents] = (await Promise.all([
			client.listModels().catch(() => []),
			client.listCustomCommands().catch(() => []),
			client.listAgents().catch(() => []),
		])) as [unknown[], unknown[], unknown[]];

		const availableModels: SessionModel[] = models
			.map((model): SessionModel | null => {
				if (!model || typeof model !== "object") {
					return null;
				}

				const record = model as Record<string, unknown>;
				const modelId = safeString(record.id);
				if (!modelId) {
					return null;
				}

				return {
					modelId,
					name: safeString(record.name) || modelId,
				};
			})
			.filter(isNonNull);

		const availableRemoteAgents: RemoteAgentInfo[] = agents
			.map((agent): RemoteAgentInfo | null => {
				if (!agent || typeof agent !== "object") {
					return null;
				}

				const record = agent as Record<string, unknown>;
				if (record.enabled === false) {
					return null;
				}

				const agentId = safeString(record.id);
				const name = safeString(record.name);
				if (!agentId || !name) {
					return null;
				}

				const description = safeString(record.description);

				return {
					agentId,
					name,
					...(description ? { description } : {}),
				};
			})
			.filter(isNonNull);

		let selectableRemoteAgents = availableRemoteAgents;

		if (availableRemoteAgents.length > 0) {
			const canSelectAgents = await this.supportsRemoteAgentSelection(
				session,
				workingDirectory,
				availableRemoteAgents,
			);
			if (!canSelectAgents) {
				selectableRemoteAgents = [];
			}
		}

		if (selectableRemoteAgents.length > 0) {
			this.logger.log(
				"[RemoteAdapter] Loaded remote agents:",
				selectableRemoteAgents.map((a) => ({
					id: a.agentId,
					name: a.name,
				})),
			);
		}

		const remoteAgentSelectionById = new Map<string, string>(
			selectableRemoteAgents.map((agent) => [agent.agentId, agent.name]),
		);

		const commandEntries: SlashCommand[] = customCommands
			.map((command): SlashCommand | null => {
				if (!command || typeof command !== "object") {
					return null;
				}

				const record = command as Record<string, unknown>;
				const name = safeString(record.name);
				if (!name) {
					return null;
				}

				return {
					name,
					description: safeString(record.description) || name,
					source: "agent" as const,
				};
			})
			.filter(isNonNull);

		const state: SessionState = {
			session,
			workingDirectory,
			currentModeId: "interactive",
			currentModelId: availableModels[0]?.modelId,
			currentRemoteAgentId: null,
			remoteAgentSelectionById,
			availableCommands: commandEntries,
			availableModels,
			availableRemoteAgents: selectableRemoteAgents,
			messageDeltaBuffer: "",
			thoughtDeltaBuffer: "",
		};
		this.sessionStates.set(session.sessionId, state);

		if (this.sessionUpdateCallback && commandEntries.length > 0) {
			this.sessionUpdateCallback({
				type: "available_commands_update",
				sessionId: session.sessionId,
				commands: commandEntries,
			});
		}

		return {
			modes: {
				availableModes: REMOTE_MODES,
				currentModeId: "interactive",
			},
			models:
				availableModels.length > 0
					? {
							availableModels,
							currentModelId: availableModels[0].modelId,
						}
					: undefined,
			commands: commandEntries,
			remoteAgents:
				selectableRemoteAgents.length > 0
					? {
							availableAgents: selectableRemoteAgents,
							currentAgentId: null,
						}
					: undefined,
		};
	}

	private handleRemoteEvent(sessionId: string, event: SessionEvent): void {
		if (!this.sessionUpdateCallback) {
			return;
		}

		const state = this.sessionStates.get(sessionId);
		const eventId = event.id;

		if (event.type === "assistant.message_delta") {
			const delta =
				safeString(event.data?.delta) || extractTextFromEvent(event);
			if (delta) {
				if (state) {
					state.messageDeltaBuffer += delta;
				}
				this.sessionUpdateCallback({
					type: "agent_message_chunk",
					sessionId,
					eventId,
					text: delta,
				});
			}
			return;
		}

		if (event.type === "assistant.reasoning_delta") {
			const delta =
				safeString(event.data?.delta) || extractTextFromEvent(event);
			if (delta) {
				if (state) {
					state.thoughtDeltaBuffer += delta;
				}
				this.sessionUpdateCallback({
					type: "agent_thought_chunk",
					sessionId,
					eventId,
					text: delta,
				});
			}
			return;
		}

		if (event.type === "assistant.message") {
			const text = extractTextFromEvent(event);
			if (text) {
				if (state && state.messageDeltaBuffer.length > 0) {
					const full = state.messageDeltaBuffer;
					state.messageDeltaBuffer = "";
					if (text === full) {
						return;
					}
				}
				this.sessionUpdateCallback({
					type: "agent_message_chunk",
					sessionId,
					eventId,
					text,
				});
			}
			return;
		}

		if (event.type === "assistant.reasoning") {
			const text = extractTextFromEvent(event);
			if (text) {
				if (state && state.thoughtDeltaBuffer.length > 0) {
					const full = state.thoughtDeltaBuffer;
					state.thoughtDeltaBuffer = "";
					if (text === full) {
						return;
					}
				}
				this.sessionUpdateCallback({
					type: "agent_thought_chunk",
					sessionId,
					eventId,
					text,
				});
			}
			return;
		}

		if (event.type === "user.message") {
			if (state) {
				state.messageDeltaBuffer = "";
				state.thoughtDeltaBuffer = "";
			}
			const text = extractTextFromEvent(event);
			if (text) {
				this.sessionUpdateCallback({
					type: "user_message_chunk",
					sessionId,
					eventId,
					text,
				});
			}
			return;
		}

		if (event.type === "session.idle") {
			this.sessionUpdateCallback({
				type: "session_idle",
				sessionId,
				eventId,
			});
			return;
		}

		if (event.type === "session.mode_changed") {
			const modeId =
				safeString(event.data?.mode) ||
				safeString(event.data?.currentModeId);
			if (modeId) {
				const state = this.sessionStates.get(sessionId);
				if (state) {
					state.currentModeId = modeId;
				}
				this.sessionUpdateCallback({
					type: "current_mode_update",
					sessionId,
					eventId,
					currentModeId: modeId,
				});
			}
			return;
		}

		if (event.type === "commands.changed") {
			const commands = Array.isArray(event.data?.commands)
				? event.data.commands
				: [];
			const converted = commands
				.map((item) => {
					if (!item || typeof item !== "object") return null;
					const rec = item as Record<string, unknown>;
					const name = safeString(rec.name);
					if (!name) return null;
					return {
						name,
						description: safeString(rec.description) || name,
						hint: safeString(rec.hint) || undefined,
						source: "agent" as const,
					};
				})
				.filter(
					(item): item is NonNullable<typeof item> => item !== null,
				);

			const state = this.sessionStates.get(sessionId);
			if (state) {
				state.availableCommands = converted;
			}

			this.sessionUpdateCallback({
				type: "available_commands_update",
				sessionId,
				eventId,
				commands: converted,
			});
			return;
		}

		if (event.type === "elicitation.requested") {
			const requestId =
				safeString(event.data?.requestId) ||
				safeString(event.data?.request_id);
			const message = safeString(event.data?.message);
			const requestedSchema =
				event.data?.requestedSchema &&
				typeof event.data.requestedSchema === "object"
					? event.data.requestedSchema
					: event.data?.schema &&
						  typeof event.data.schema === "object"
						? event.data.schema
						: undefined;

			if (requestId && message && requestedSchema) {
				this.sessionUpdateCallback({
					type: "elicitation_request",
					sessionId,
					eventId,
					requestId,
					message,
					requestedSchema:
						requestedSchema as import("../../domain/models/chat-message").ElicitationSchema,
				});
			}
			return;
		}

		if (event.type === "elicitation.completed") {
			const requestId =
				safeString(event.data?.requestId) ||
				safeString(event.data?.request_id);
			if (!requestId) {
				return;
			}

			this.sessionUpdateCallback({
				type: "elicitation_complete",
				sessionId,
				eventId,
				requestId,
				response:
					event.data?.result && typeof event.data.result === "object"
						? (event.data.result as ElicitationResponse)
						: undefined,
				success:
					typeof event.data?.success === "boolean"
						? event.data.success
						: undefined,
				error: safeString(event.data?.error),
			});
		}

		if (
			event.type === "tool.execution_start" ||
			event.type === "tool.execution_complete" ||
			event.type === "tool.execution_failed"
		) {
			const rawInput =
				event.data && typeof event.data === "object"
					? event.data
					: undefined;
			const toolCallId =
				safeString(event.data?.toolCallId) ||
				safeString(event.data?.tool_call_id) ||
				event.id ||
				crypto.randomUUID();

			const rawKind =
				safeString(event.data?.kind) ||
				safeString(event.data?.toolKind) ||
				safeString(event.data?.toolName);

			const status: ToolCallStatus =
				event.type === "tool.execution_start"
					? "in_progress"
					: event.type === "tool.execution_failed"
						? "failed"
						: event.data?.success === false
							? "failed"
							: "completed";

			this.sessionUpdateCallback({
				type:
					event.type === "tool.execution_start"
						? "tool_call"
						: "tool_call_update",
				sessionId,
				eventId,
				toolCallId,
				title:
					safeString(event.data?.title) ||
					safeString(event.data?.toolName),
				status,
				kind: inferToolKind(rawKind),
				content: rawInput ? extractToolContent(rawInput) : undefined,
				locations: rawInput
					? extractToolLocations(rawInput)
					: undefined,
				rawInput,
			});

			if (rawInput) {
				this.updateTerminalSnapshotsFromToolEvent(rawInput, status);
			}
		}
	}

	private updateTerminalSnapshotsFromToolEvent(
		rawInput: Record<string, unknown>,
		status: ToolCallStatus,
	): void {
		const terminalIds = new Set<string>();
		const directTerminalId =
			safeString(rawInput.terminalId) || safeString(rawInput.terminal_id);
		if (directTerminalId) {
			terminalIds.add(directTerminalId);
		}

		const contentBlocks = extractToolContent(rawInput);
		if (contentBlocks) {
			for (const block of contentBlocks) {
				if (block.type === "terminal") {
					terminalIds.add(block.terminalId);
				}
			}
		}

		if (terminalIds.size === 0) {
			return;
		}

		const outputParts: string[] = [];
		for (const key of ["output", "stdout", "stderr"]) {
			const text = safeString(rawInput[key]);
			if (text) {
				outputParts.push(text);
			}
		}

		const combinedOutput = outputParts.join("\n").trim();
		const exitCode =
			safeNumber(rawInput.exitCode) ??
			safeNumber(rawInput.exit_code) ??
			safeNumber(rawInput.code);
		const signal =
			safeString(rawInput.signal) ?? safeString(rawInput.exitSignal);

		for (const terminalId of terminalIds) {
			const previous = this.terminalSnapshots.get(terminalId);
			const nextOutput =
				combinedOutput.length > 0
					? previous?.output
						? `${previous.output}\n${combinedOutput}`
						: combinedOutput
					: (previous?.output ?? "");

			this.terminalSnapshots.set(terminalId, {
				output: nextOutput,
				truncated: false,
				exitStatus:
					status === "in_progress"
						? undefined
						: {
								exitCode:
									exitCode ??
									(status === "completed" ? 0 : 1),
								signal: signal ?? null,
							},
			});
		}
	}

	private buildForkTranscript(messages: MessageContent[]): string {
		const lines: string[] = [];
		for (const content of messages) {
			if (content.type === "text") {
				lines.push(content.text);
				continue;
			}
			if (content.type === "text_with_context") {
				lines.push(content.text);
				continue;
			}
			if (content.type === "agent_thought") {
				lines.push(`(thought) ${content.text}`);
			}
		}

		return lines.join("\n").trim();
	}

	private async buildForkSystemMessageContent(
		sessionId: string,
	): Promise<string | undefined> {
		const history = await this.plugin.settingsStore
			.loadSessionMessages(sessionId)
			.catch(() => null);
		if (!history || history.length === 0) {
			return undefined;
		}

		const transcriptBlocks: string[] = [];
		for (const message of history) {
			const body = this.buildForkTranscript(message.content);
			if (!body) {
				continue;
			}
			const role = message.role === "assistant" ? "Assistant" : "User";
			transcriptBlocks.push(`${role}:\n${body}`);
		}

		if (transcriptBlocks.length === 0) {
			return undefined;
		}

		const full = transcriptBlocks.join("\n\n");
		return full.length > 12000 ? full.slice(full.length - 12000) : full;
	}

	private async handlePermissionRequest(
		sessionId: string,
		request: PermissionRequest,
	): Promise<PermissionRequestResult> {
		const requestId = crypto.randomUUID();
		const toolCallId = request.toolCallId || crypto.randomUUID();
		const options: PermissionOption[] = [
			{
				optionId: "allow_once",
				name: "Allow Once",
				kind: "allow_once",
			},
			{
				optionId: "reject_once",
				name: "Reject Once",
				kind: "reject_once",
			},
		];

		if (
			(this.autoAllowPermissionsOverride ?? this.autoAllowPermissions) &&
			this.sessionUpdateCallback
		) {
			this.sessionUpdateCallback({
				type: "tool_call",
				sessionId,
				toolCallId,
				title: `Permission: ${request.kind}`,
				status: "in_progress",
				kind: inferToolKind(request.kind),
				permissionRequest: {
					requestId,
					options,
					selectedOptionId: "allow_once",
					isActive: false,
				},
			});
			return { kind: "approved" };
		}

		return await new Promise<PermissionRequestResult>((resolve) => {
			this.pendingPermissions.set(requestId, {
				requestId,
				sessionId,
				toolCallId,
				options,
				resolve,
			});

			if (this.sessionUpdateCallback) {
				this.sessionUpdateCallback({
					type: "tool_call",
					sessionId,
					toolCallId,
					title: `Permission: ${request.kind}`,
					status: "pending",
					kind: inferToolKind(request.kind),
					permissionRequest: {
						requestId,
						options,
						isActive: false, // Default to inactive until processed by queue
					},
				});
			}

			this.enqueuePermission(sessionId, requestId);
			this.processNextPermission(sessionId);
		});
	}

	private processNextPermission(sessionId: string): void {
		if (!this.sessionUpdateCallback) {
			return;
		}

		// Don't activate if there is already an active request for this session
		if (this.getActivePermissionRequestId(sessionId)) {
			return;
		}

		const nextRequestId = this.dequeuePermission(sessionId);
		if (!nextRequestId) {
			return;
		}

		const nextRequest = this.pendingPermissions.get(nextRequestId);
		if (!nextRequest) {
			return;
		}

		this.setActivePermissionRequestId(sessionId, nextRequestId);
		this.sessionUpdateCallback({
			type: "tool_call_update",
			sessionId: nextRequest.sessionId,
			toolCallId: nextRequest.toolCallId,
			status: "pending",
			kind: "execute",
			permissionRequest: {
				requestId: nextRequest.requestId,
				options: nextRequest.options,
				isActive: true, // Now officially active for the user
			},
		});
	}

	async newSession(workingDirectory: string): Promise<NewSessionResult> {
		// Create a new client instance with the working directory
		// This ensures SetWorkspace API changes are applied for session creation
		const clientOptions: CopilotClientOptionsWithCwd = {
			serverUrl: this.plugin.getRemoteServerUrl(),
			cwd: workingDirectory,
		};
		const client = new CopilotClient(clientOptions);

		return await this.withRetryBackoff(async () => {
			await this.ensureClientStarted(client, "create remote session");

			const created = await client.createSession(
				this.buildSessionConfig({
					streaming: true,
					onPermissionRequest: (request, invocation) =>
						this.handlePermissionRequest(invocation.sessionId, request),
				}),
			);
			created.on((event) => this.handleRemoteEvent(created.sessionId, event));

			const snapshot = await this.buildSessionSnapshot(
				created,
				workingDirectory,
			);
			const remoteAgents = await this.restoreSessionRemoteAgentSelection(
				created.sessionId,
				snapshot.remoteAgents,
			);

			return {
				sessionId: created.sessionId,
				modes: snapshot.modes,
				models: snapshot.models,
				remoteAgents,
			};
		}, "create remote session");
	}

	async authenticate(_methodId: string): Promise<boolean> {
		const auth = await this.getClient()
			.getAuthStatus()
			.catch(() => null);
		return auth?.isAuthenticated === true;
	}

	private getSessionState(sessionId: string): SessionState {
		const state = this.sessionStates.get(sessionId);
		if (!state) {
			throw new Error(`Session not found: ${sessionId}`);
		}
		return state;
	}

	private toMessageOptions(content: PromptContent[]): {
		prompt: string;
		attachments?: MessageAttachment[];
	} {
		const textParts: string[] = [];
		const attachments: MessageAttachment[] = [];

		for (const block of content) {
			if (block.type === "text") {
				textParts.push(block.text);
				continue;
			}

			if (block.type === "resource") {
				textParts.push(block.resource.text);
				continue;
			}

			if (block.type === "image") {
				attachments.push({
					type: "blob",
					data: block.data,
					mimeType: block.mimeType,
					displayName: "image",
				});
			}
		}

		return {
			prompt:
				textParts.length > 0
					? textParts.join("\n\n")
					: attachments.length > 0
						? "Please process the attached image."
						: "",
			attachments: attachments.length > 0 ? attachments : undefined,
		};
	}

	async sendPrompt(
		sessionId: string,
		content: PromptContent[],
	): Promise<void> {
		const state = this.getSessionState(sessionId);
		const client = this.getClient(state.workingDirectory);

		await this.withRetryBackoff(async () => {
			await this.ensureClientStarted(client, "send prompt");
			const options = this.toMessageOptions(content);
			await state.session.send(options);
		}, "send prompt");
	}

	async cancel(sessionId: string): Promise<void> {
		const state = this.getSessionState(sessionId);
		await state.session.abort();
	}

	async disconnect(): Promise<void> {
		for (const pending of this.pendingPermissions.values()) {
			pending.resolve({
				kind: "denied-no-approval-rule-and-could-not-request-from-user",
			});
		}
		this.pendingPermissions.clear();
		this.permissionQueuesBySession.clear();
		this.activePermissionRequestBySession.clear();
		this.terminalSnapshots.clear();

		for (const state of this.sessionStates.values()) {
			await state.session.disconnect().catch(() => {
				// Ignore disconnect failures during shutdown.
			});
		}
		this.sessionStates.clear();
		this.lastSelectedRemoteAgentByWorkingDirectory.clear();
		this.remoteAgentSelectionSupportByWorkingDirectory.clear();

		if (this.client) {
			await this.client.stop();
			this.client = null;
		}

		this.isInitializedFlag = false;
		this.currentAgentId = null;
	}

	onSessionUpdate(callback: (update: SessionUpdate) => void): void {
		this.sessionUpdateCallback = callback;
	}

	onError(callback: (error: ProcessError) => void): void {
		this.errorCallback = callback;
	}

	async respondToPermission(
		requestId: string,
		optionId: string,
	): Promise<void> {
		const pending = this.pendingPermissions.get(requestId);
		if (!pending) {
			this.logger.warn(`Permission request not found: ${requestId}`);
			return;
		}

		pending.selectedOptionId = optionId;
		this.pendingPermissions.delete(requestId);

		if (
			this.getActivePermissionRequestId(pending.sessionId) === requestId
		) {
			this.setActivePermissionRequestId(pending.sessionId, null);
		}

		const approved = optionId.startsWith("allow");
		pending.resolve(
			approved
				? { kind: "approved" }
				: {
						kind: "denied-interactively-by-user",
						feedback: "Denied from Obsidian UI",
					},
		);

		if (this.sessionUpdateCallback) {
			this.sessionUpdateCallback({
				type: "tool_call_update",
				sessionId: pending.sessionId,
				toolCallId: pending.toolCallId,
				status: approved ? "in_progress" : "failed",
				kind: "execute",
				permissionRequest: {
					requestId,
					options: pending.options,
					selectedOptionId: optionId,
					isActive: false,
				},
			});
		}

		this.processNextPermission(pending.sessionId);
	}

	isInitialized(): boolean {
		return this.isInitializedFlag;
	}

	getCurrentAgentId(): string | null {
		return this.currentAgentId;
	}

	async setSessionMode(sessionId: string, modeId: string): Promise<void> {
		const state = this.getSessionState(sessionId);
		await state.session.setMode(toRemoteMode(modeId));
		state.currentModeId = modeId;
		this.sessionUpdateCallback?.({
			type: "current_mode_update",
			sessionId,
			currentModeId: modeId,
		});
	}

	async setSessionModel(sessionId: string, modelId: string): Promise<void> {
		const state = this.getSessionState(sessionId);
		await state.session.setModel(modelId);
		state.currentModelId = modelId;
	}

	async setSessionAgent(
		sessionId: string,
		agentId: string | null,
	): Promise<void> {
		const state = this.getSessionState(sessionId);

		if (agentId === null) {
			await this.withRetryBackoff(async () => {
				const client = this.getClient(state.workingDirectory);
				await this.ensureClientStarted(client, "set workspace");
				await client.setWorkspace(state.workingDirectory ?? "");
				await state.session.clearAgent();
			}, "clear remote agent");

			state.currentRemoteAgentId = null;
			this.rememberRemoteAgentSelection(state.workingDirectory, null);
			this.sessionUpdateCallback?.({
				type: "current_remote_agent_update",
				sessionId,
				currentRemoteAgentId: null,
			});
			return;
		}

		await this.withRetryBackoff(async () => {
			const client = this.getClient(state.workingDirectory);
			await this.ensureClientStarted(client, "set workspace");
			await client.setWorkspace(state.workingDirectory ?? "");

			// Explicitly reload available agents before selection
			await this.reloadSessionAgents(sessionId, state.workingDirectory);

			const selectedFromSnapshot = state.availableRemoteAgents.find(
				(agent) => agent.agentId === agentId || agent.name === agentId,
			);
			const canonicalAgentId = selectedFromSnapshot?.agentId ?? agentId;

			try {
				await state.session.setAgent(canonicalAgentId);
				state.currentRemoteAgentId = canonicalAgentId;
				this.rememberRemoteAgentSelection(
					state.workingDirectory,
					canonicalAgentId,
				);
			} catch (error) {
				// If selection fails, try to refresh the agent list once and retry with the updated ID
				const latestAgents = (await client
					.listAgents()
					.catch(() => [])) as unknown[];

				const latestMatch = latestAgents.find((item) => {
					if (!item || typeof item !== "object") {
						return false;
					}
					const record = item as Record<string, unknown>;
					return (
						safeString(record.id) === agentId ||
						safeString(record.name) === agentId
					);
				});

				const latestCanonicalId =
					latestMatch && typeof latestMatch === "object"
						? safeString(
								(latestMatch as Record<string, unknown>).id,
							)
						: undefined;

				if (!latestCanonicalId) {
					throw error;
				}

				this.logger.warn(
					`[RemoteAdapter] Failed to set remote agent by id '${canonicalAgentId}', retrying with refreshed id '${latestCanonicalId}'`,
					error,
				);
				await state.session.setAgent(latestCanonicalId);

				state.currentRemoteAgentId = latestCanonicalId;
				this.rememberRemoteAgentSelection(
					state.workingDirectory,
					latestCanonicalId,
				);
			}

			this.sessionUpdateCallback?.({
				type: "current_remote_agent_update",
				sessionId,
				currentRemoteAgentId: state.currentRemoteAgentId,
			});
		}, "set remote agent");
	}

	async listSessions(
		cwd?: string,
		cursor?: string,
	): Promise<ListSessionsResult> {
		const saved = this.plugin.settingsStore.getSavedSessions(
			"copilot",
			cwd,
		);
		const offset = cursor ? Number.parseInt(cursor, 10) : 0;
		const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
		const pageSize = 30;
		const page = saved.slice(safeOffset, safeOffset + pageSize);
		const nextCursor =
			safeOffset + pageSize < saved.length
				? String(safeOffset + pageSize)
				: undefined;

		return {
			sessions: page.map((item) => ({
				sessionId: item.sessionId,
				cwd: item.cwd,
				title: item.title,
				updatedAt: item.updatedAt,
			})),
			nextCursor,
		};
	}

	async loadSession(
		sessionId: string,
		cwd: string,
	): Promise<LoadSessionResult> {
		const result = await this.resumeSession(sessionId, cwd);
		const state = this.getSessionState(result.sessionId);
		const events = await state.session.getMessages();
		for (const event of events) {
			this.handleRemoteEvent(result.sessionId, event);
		}

		return {
			sessionId: result.sessionId,
			modes: result.modes,
			models: result.models,
			remoteAgents: result.remoteAgents,
		};
	}

	async resumeSession(
		sessionId: string,
		cwd: string,
	): Promise<ResumeSessionResult> {
		// Create a new client instance with the working directory
		// This ensures SetWorkspace API changes are applied for session resumption
		const clientOptions: CopilotClientOptionsWithCwd = {
			serverUrl: this.plugin.getRemoteServerUrl(),
			cwd: cwd,
		};
		const client = new CopilotClient(clientOptions);

		return await this.withRetryBackoff(async () => {
			await this.ensureClientStarted(client, "resume remote session");

			const resumed = await client.resumeSession(
				sessionId,
				this.buildSessionConfig({
					streaming: true,
					onPermissionRequest: (request, invocation) =>
						this.handlePermissionRequest(invocation.sessionId, request),
				}),
			);
			resumed.on((event) => this.handleRemoteEvent(resumed.sessionId, event));

			const snapshot = await this.buildSessionSnapshot(resumed, cwd);
			const remoteAgents = await this.restoreSessionRemoteAgentSelection(
				resumed.sessionId,
				snapshot.remoteAgents,
			);

			return {
				sessionId: resumed.sessionId,
				modes: snapshot.modes,
				models: snapshot.models,
				remoteAgents,
			};
		}, "resume remote session");
	}

	async forkSession(
		sessionId: string,
		cwd: string,
	): Promise<ForkSessionResult> {
		// Create a new client instance with the working directory
		// This ensures SetWorkspace API changes are applied for session forking
		const clientOptions: CopilotClientOptionsWithCwd = {
			serverUrl: this.plugin.getRemoteServerUrl(),
			cwd: cwd,
		};
		const client = new CopilotClient(clientOptions);

		return await this.withRetryBackoff(async () => {
			await this.ensureClientStarted(client, "fork remote session");

			const systemMessageContent =
				await this.buildForkSystemMessageContent(sessionId);

			const forked = await client.createSession(
				this.buildSessionConfig({
					streaming: true,
					onPermissionRequest: (request, invocation) =>
						this.handlePermissionRequest(invocation.sessionId, request),
					systemMessage: systemMessageContent
						? {
								mode: "append",
								content:
									"Forked session context from previous conversation:\n\n" +
									systemMessageContent,
							}
						: undefined,
				}),
			);
			forked.on((event) => this.handleRemoteEvent(forked.sessionId, event));

			const snapshot = await this.buildSessionSnapshot(forked, cwd);
			const remoteAgents = await this.restoreSessionRemoteAgentSelection(
				forked.sessionId,
				snapshot.remoteAgents,
			);

			return {
				sessionId: forked.sessionId,
				modes: snapshot.modes,
				models: snapshot.models,
				remoteAgents,
			};
		}, "fork remote session");
	}

	async terminalOutput(
		params: TerminalOutputRequestLike,
	): Promise<TerminalOutputResponseLike> {
		const snapshot = this.terminalSnapshots.get(params.terminalId);
		if (snapshot) {
			return {
				output: snapshot.output,
				truncated: snapshot.truncated,
				exitStatus: snapshot.exitStatus,
			};
		}

		return {
			output: "No terminal output is available yet for this remote runtime terminal.",
			truncated: false,
			exitStatus: undefined,
		};
	}

	async listPrompts(): Promise<PromptTemplateInfo[]> {
		const client = this.getClient(this.currentConfig?.workingDirectory);
		await this.ensureClientStarted(client, "list prompt templates");
		const prompts = await client.listPrompts();
		return prompts
			.map((prompt) => this.normalizePromptInfo(prompt))
			.filter(isNonNull);
	}

	async executePrompt(
		sessionId: string,
		promptId: string,
		args?: string,
	): Promise<void> {
		const state = this.getSessionState(sessionId);
		await this.ensureClientStarted(
			this.getClient(state.workingDirectory),
			"execute prompt template",
		);
		const response = await state.session.executePrompt(promptId, args);
		if (response) {
			this.handleRemoteEvent(sessionId, response);
		}
		this.sessionUpdateCallback?.({
			type: "session_idle",
			sessionId,
		});
	}

	async compactHistory(sessionId: string): Promise<HistoryCompactionResult> {
		const state = this.getSessionState(sessionId);
		const client = this.getClient(state.workingDirectory);
		return this.sendRawClientRequest<HistoryCompactionResult>(
			client,
			COPILOT_SESSION_HISTORY_COMPACT_METHOD,
			{ sessionId },
		);
	}

	async truncateHistory(
		sessionId: string,
		eventId: string,
	): Promise<HistoryTruncationResult> {
		const state = this.getSessionState(sessionId);
		const client = this.getClient(state.workingDirectory);
		return this.sendRawClientRequest<HistoryTruncationResult>(
			client,
			COPILOT_SESSION_HISTORY_TRUNCATE_METHOD,
			{ sessionId, eventId },
		);
	}

	async getUsageMetrics(
		sessionId: string,
	): Promise<SessionUsageMetrics | null> {
		const state = this.getSessionState(sessionId);
		const client = this.getClient(state.workingDirectory);
		return this.sendRawClientRequest<SessionUsageMetrics | null>(
			client,
			COPILOT_SESSION_USAGE_GET_METRICS_METHOD,
			{ sessionId },
		);
	}

	async handlePendingElicitation(
		sessionId: string,
		requestId: string,
		response: ElicitationResponse,
	): Promise<ElicitationResult> {
		const state = this.getSessionState(sessionId);
		const client = this.getClient(state.workingDirectory);
		return this.sendRawClientRequest<ElicitationResult>(
			client,
			COPILOT_SESSION_UI_HANDLE_PENDING_ELICITATION_METHOD,
			{ sessionId, requestId, result: response },
		);
	}

	getConnectionState(): AgentConnectionState {
		if (!this.client) {
			return "disconnected";
		}

		const state = this.client.getState();
		if (state === "connected") {
			return "connected";
		}
		if (state === "connecting") {
			return "connecting";
		}
		return "disconnected";
	}
}
