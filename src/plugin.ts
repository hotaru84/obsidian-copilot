import {
	Plugin,
	WorkspaceLeaf,
	WorkspaceSplit,
	Notice,
	Menu,
	setIcon,
} from "obsidian";
import type { Root } from "react-dom/client";
import { ChatView, VIEW_TYPE_CHAT } from "./components/chat/ChatView";
import {
	createFloatingChat,
	FloatingViewContainer,
} from "./components/chat/FloatingChatView";
import { FloatingButtonContainer } from "./components/chat/FloatingButton";
import { ChatViewRegistry } from "./shared/chat-view-registry";
import {
	createSettingsStore,
	type SettingsStore,
} from "./adapters/obsidian/settings-store.adapter";
import {
	AgentClientSettingTab,
	CustomPromptsModal,
} from "./components/settings/AgentClientSettingTab";
import { AcpAdapter } from "./adapters/acp/acp.adapter";
import { sanitizeArgs, normalizeEnvVars } from "./shared/settings-utils";
import { parseChatFontSize } from "./shared/display-settings";
import {
	AgentEnvVar,
	CopilotAgentSettings,
} from "./domain/models/agent-config";
import type { SavedSessionInfo } from "./domain/models/session-info";
import { initializeLogger } from "./shared/logger";
import type {
	CustomPrompt,
	PromptExecutionRecord,
} from "./domain/models/scheduled-prompt";
import { isTimeWindowPrompt } from "./domain/models/scheduled-prompt";
import {
	ScheduledPromptRunner,
	trimExecutionHistory,
} from "./shared/scheduled-prompt-runner";
import { RunPromptModal } from "./components/chat/RunPromptModal";

function getLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDuration(ms: number): string {
	const clamped = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(clamped / 3600);
	const minutes = Math.floor((clamped % 3600) / 60);
	const seconds = clamped % 60;

	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

function formatClock(dateIso: string): string {
	return new Date(dateIso).toLocaleTimeString();
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength - 1)}…`;
}

/** Maximum seconds to wait for a new chat view to register after opening one. */
const MAX_VIEW_REGISTRATION_WAIT_SECONDS = 10;

// Re-export for backward compatibility
export type { AgentEnvVar };

/**
 * Send message shortcut configuration.
 * - 'enter': Enter to send, Shift+Enter for newline (default)
 * - 'cmd-enter': Cmd/Ctrl+Enter to send, Enter for newline
 */
export type SendMessageShortcut = "enter" | "cmd-enter";

/**
 * Chat view location configuration.
 * - 'right-tab': Open in right pane as tabs (default)
 * - 'right-split': Open in right pane with vertical split
 * - 'editor-tab': Open in editor area as tabs
 * - 'editor-split': Open in editor area with right split
 */
export type ChatViewLocation =
	| "right-tab"
	| "right-split"
	| "editor-tab"
	| "editor-split";

export interface AgentClientPluginSettings {
	copilot: CopilotAgentSettings;
	autoAllowPermissions: boolean;
	autoMentionActiveNote: boolean;
	debugMode: boolean;
	nodePath: string;
	exportSettings: {
		defaultFolder: string;
		filenameTemplate: string;
		autoExportOnNewChat: boolean;
		autoExportOnCloseChat: boolean;
		openFileAfterExport: boolean;
		includeImages: boolean;
		imageLocation: "obsidian" | "custom" | "base64";
		imageCustomFolder: string;
		frontmatterTag: string;
	};
	// WSL settings (Windows only)
	windowsWslMode: boolean;
	windowsWslDistribution?: string;
	// Input behavior
	sendMessageShortcut: SendMessageShortcut;
	// View settings
	chatViewLocation: ChatViewLocation;
	// Display settings
	displaySettings: {
		autoCollapseDiffs: boolean;
		diffCollapseThreshold: number;
		maxNoteLength: number;
		maxSelectionLength: number;
		showEmojis: boolean;
		fontSize: number | null;
	};
	// Locally saved session metadata (for agents without session/list support)
	savedSessions: SavedSessionInfo[];
	// Last used model per agent (agentId → modelId)
	lastUsedModels: Record<string, string>;
	// Floating chat button settings
	showFloatingButton: boolean;
	floatingButtonImage: string;
	floatingWindowSize: { width: number; height: number };
	floatingButtonPosition: { right: number; bottom: number } | null;
	// Scheduled / custom prompt settings
	customPrompts: CustomPrompt[];
	promptExecutionHistory: PromptExecutionRecord[];
	schedulerPaused: boolean;
}

const DEFAULT_SETTINGS: AgentClientPluginSettings = {
	copilot: {
		id: "copilot",
		displayName: "GitHub Copilot",
		command: "copilot",
		args: ["--acp", "--stdio"],
		env: [],
	},
	autoAllowPermissions: false,
	autoMentionActiveNote: true,
	debugMode: false,
	nodePath: "",
	exportSettings: {
		defaultFolder: "Agent Client",
		filenameTemplate: "agent_client_{date}_{time}",
		autoExportOnNewChat: false,
		autoExportOnCloseChat: false,
		openFileAfterExport: true,
		includeImages: true,
		imageLocation: "obsidian",
		imageCustomFolder: "Agent Client",
		frontmatterTag: "agent-client",
	},
	windowsWslMode: false,
	windowsWslDistribution: undefined,
	sendMessageShortcut: "enter",
	chatViewLocation: "right-tab",
	displaySettings: {
		autoCollapseDiffs: false,
		diffCollapseThreshold: 10,
		maxNoteLength: 10000,
		maxSelectionLength: 10000,
		showEmojis: true,
		fontSize: null,
	},
	savedSessions: [],
	lastUsedModels: {},
	showFloatingButton: false,
	floatingButtonImage: "",
	floatingWindowSize: { width: 400, height: 500 },
	floatingButtonPosition: { right: 40, bottom: 30 },
	customPrompts: [],
	promptExecutionHistory: [],
	schedulerPaused: false,
};

export default class AgentClientPlugin extends Plugin {
	settings: AgentClientPluginSettings;
	settingsStore!: SettingsStore;

	/** Registry for all chat view containers (sidebar + floating) */
	viewRegistry = new ChatViewRegistry();

	/** Map of viewId to AcpAdapter for multi-session support */
	private _adapters: Map<string, AcpAdapter> = new Map();
	/** Floating button container (independent from chat view instances) */
	private floatingButton: FloatingButtonContainer | null = null;
	/** Map of viewId to floating chat roots and containers (legacy, being migrated to viewRegistry) */
	private floatingChatInstances: Map<
		string,
		{ root: Root; container: HTMLElement }
	> = new Map();
	/** Counter for generating unique floating chat instance IDs */
	private floatingChatCounter = 0;
	/** Scheduled prompt runner */
	scheduledPromptRunner!: ScheduledPromptRunner;
	/** Status bar item for scheduler status */
	private schedulerStatusBarItem: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		initializeLogger(this.settings);

		// Initialize settings store
		this.settingsStore = createSettingsStore(this.settings, this);

		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		const ribbonIconEl = this.addRibbonIcon(
			"bot-message-square",
			"Open Agent Client",
			(_evt: MouseEvent) => {
				void this.activateView();
			},
		);
		ribbonIconEl.addClass("agent-client-ribbon-icon");

		this.addCommand({
			id: "open-chat-view",
			name: "Open agent chat",
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "focus-next-chat-view",
			name: "Focus next chat view",
			callback: () => {
				this.focusChatView("next");
			},
		});

		this.addCommand({
			id: "focus-previous-chat-view",
			name: "Focus previous chat view",
			callback: () => {
				this.focusChatView("previous");
			},
		});

		this.addCommand({
			id: "open-new-chat-view",
			name: "Open new chat view",
			callback: () => {
				void this.openNewChatViewWithAgent("copilot");
			},
		});

		// Register agent-specific commands
		this.registerAgentCommands();
		this.registerPermissionCommands();
		this.registerBroadcastCommands();

		// Floating chat window commands
		this.addCommand({
			id: "open-floating-chat",
			name: "Open floating chat window",
			callback: () => {
				if (!this.settings.showFloatingButton) return;
				const instances = this.getFloatingChatInstances();
				if (instances.length === 0) {
					this.openNewFloatingChat(true);
				} else if (instances.length === 1) {
					this.expandFloatingChat(instances[0]);
				} else {
					const focused = this.viewRegistry.getFocused();
					if (focused && focused.viewType === "floating") {
						focused.expand();
					} else {
						this.expandFloatingChat(
							instances[instances.length - 1],
						);
					}
				}
			},
		});

		this.addCommand({
			id: "open-new-floating-chat",
			name: "Open new floating chat window",
			callback: () => {
				if (!this.settings.showFloatingButton) return;
				this.openNewFloatingChat(true);
			},
		});

		this.addCommand({
			id: "close-floating-chat",
			name: "Close floating chat window",
			callback: () => {
				const focused = this.viewRegistry.getFocused();
				if (focused && focused.viewType === "floating") {
					focused.collapse();
				}
			},
		});

		this.addSettingTab(new AgentClientSettingTab(this.app, this));

		// Mount floating button (always present; visibility controlled by settings inside component)
		this.floatingButton = new FloatingButtonContainer(this);
		this.floatingButton.mount();

		// Mount initial floating chat instance only if enabled
		if (this.settings.showFloatingButton) {
			this.openNewFloatingChat();
		}

		// Initialize scheduled prompt runner
		this.scheduledPromptRunner = new ScheduledPromptRunner({
			getPrompts: () => this.settings.customPrompts,
			getHistory: () => this.settings.promptExecutionHistory,
			onRecord: (record) => {
				this.settings.promptExecutionHistory = trimExecutionHistory([
					...this.settings.promptExecutionHistory,
					record,
				]);
				void this.saveSettings();
				this.updateSchedulerStatusBar();
			},
			onStateChange: () => {
				this.updateSchedulerStatusBar();
			},
			getOrOpenView: async () => {
				// Prefer the focused view; fall back to any available view
				const focused = this.viewRegistry.getFocused();
				if (focused) return focused;
				const all = this.viewRegistry.getAll();
				if (all.length > 0) return all[0];

				// No view available – open one and wait up to MAX_VIEW_REGISTRATION_WAIT_SECONDS for it to register
				await this.activateView();
				for (let i = 0; i < MAX_VIEW_REGISTRATION_WAIT_SECONDS; i++) {
					await new Promise<void>((resolve) =>
						window.setTimeout(resolve, 1000),
					);
					const newAll = this.viewRegistry.getAll();
					if (newAll.length > 0) return newAll[0];
				}
				return null;
			},
		});

		this.scheduledPromptRunner.start();
		if (this.settings.schedulerPaused) {
			this.scheduledPromptRunner.pause();
		}

		// Status bar item for scheduler
		this.schedulerStatusBarItem = this.addStatusBarItem();
		this.schedulerStatusBarItem.addClass("mod-clickable");
		this.registerDomEvent(
			this.schedulerStatusBarItem,
			"click",
			(event: MouseEvent) => this.showSchedulerStatusMenu(event),
		);
		this.registerInterval(
			window.setInterval(() => this.updateSchedulerStatusBar(), 30_000),
		);
		this.updateSchedulerStatusBar();

		// Register scheduled prompt commands
		this.registerScheduledPromptCommands();

		// Clean up all ACP sessions when Obsidian quits
		// Note: We don't wait for disconnect to complete to avoid blocking quit
		this.registerEvent(
			this.app.workspace.on("quit", () => {
				// Fire and forget - don't block Obsidian from quitting
				for (const [viewId, adapter] of this._adapters) {
					adapter.disconnect().catch((error) => {
						console.warn(
							`[AgentClient] Quit cleanup error for view ${viewId}:`,
							error,
						);
					});
				}
				this._adapters.clear();
			}),
		);
	}

	onunload() {
		// Stop scheduler
		this.scheduledPromptRunner?.stop();

		// Unmount floating button
		this.floatingButton?.unmount();
		this.floatingButton = null;

		// Unmount all floating chat instances via registry
		for (const container of this.viewRegistry.getByType("floating")) {
			if (container instanceof FloatingViewContainer) {
				container.unmount();
			}
		}

		// Clear registry (sidebar views are managed by Obsidian workspace)
		this.viewRegistry.clear();

		// Clear legacy storage
		this.floatingChatInstances.clear();
	}

	/**
	 * Get or create an AcpAdapter for a specific view.
	 * Each ChatView has its own adapter for independent sessions.
	 */
	getOrCreateAdapter(viewId: string): AcpAdapter {
		let adapter = this._adapters.get(viewId);
		if (!adapter) {
			adapter = new AcpAdapter(this);
			this._adapters.set(viewId, adapter);
		}
		return adapter;
	}

	/**
	 * Remove and disconnect the adapter for a specific view.
	 * Called when a ChatView is closed.
	 */
	async removeAdapter(viewId: string): Promise<void> {
		const adapter = this._adapters.get(viewId);
		if (adapter) {
			try {
				await adapter.disconnect();
			} catch (error) {
				console.warn(
					`[AgentClient] Failed to disconnect adapter for view ${viewId}:`,
					error,
				);
			}
			this._adapters.delete(viewId);
		}
		// Note: lastActiveChatViewId is now managed by viewRegistry
		// Clearing happens automatically when view is unregistered
	}

	/**
	 * Get the last active ChatView ID for keybind targeting.
	 */
	get lastActiveChatViewId(): string | null {
		return this.viewRegistry.getFocusedId();
	}

	/**
	 * Set the last active ChatView ID.
	 * Called when a ChatView receives focus or interaction.
	 */
	setLastActiveChatViewId(viewId: string | null): void {
		if (viewId) {
			this.viewRegistry.setFocused(viewId);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

		if (leaves.length > 0) {
			// Find the leaf matching lastActiveChatViewId, or fall back to first leaf
			const focusedId = this.lastActiveChatViewId;
			if (focusedId) {
				leaf =
					leaves.find(
						(l) => (l.view as ChatView)?.viewId === focusedId,
					) || leaves[0];
			} else {
				leaf = leaves[0];
			}
		} else {
			leaf = this.createNewChatLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_CHAT,
					active: true,
				});
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
			this.focusTextarea(leaf);
		}
	}

	/**
	 * Focus the textarea in a ChatView leaf.
	 */
	private focusTextarea(leaf: WorkspaceLeaf): void {
		const viewContainerEl = leaf.view?.containerEl;
		if (viewContainerEl) {
			window.setTimeout(() => {
				const textarea = viewContainerEl.querySelector(
					"textarea.agent-client-chat-input-textarea",
				);
				if (textarea instanceof HTMLTextAreaElement) {
					textarea.focus();
				}
			}, 50);
		}
	}

	/**
	 * Focus the next or previous ChatView in the list.
	 * Uses ChatViewRegistry which includes both sidebar and floating views.
	 */
	private focusChatView(direction: "next" | "previous"): void {
		if (direction === "next") {
			this.viewRegistry.focusNext();
		} else {
			this.viewRegistry.focusPrevious();
		}
	}

	/**
	 * Create a new leaf for ChatView based on the configured location setting.
	 * @param isAdditional - true when opening additional views (e.g., Open New View)
	 */
	private createNewChatLeaf(isAdditional: boolean): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const location = this.settings.chatViewLocation;

		switch (location) {
			case "right-tab":
				if (isAdditional) {
					return this.createSidebarTab("right");
				}
				return workspace.getRightLeaf(false);
			case "right-split":
				return workspace.getRightLeaf(isAdditional);
			case "editor-tab":
				return workspace.getLeaf("tab");
			case "editor-split":
				return workspace.getLeaf("split");
			default:
				return workspace.getRightLeaf(false);
		}
	}

	/**
	 * Create a new tab within an existing sidebar tab group.
	 * Uses the parent of an existing chat leaf to add a sibling tab,
	 * avoiding the vertical split caused by getRightLeaf(true).
	 */
	private createSidebarTab(side: "right" | "left"): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const split =
			side === "right" ? workspace.rightSplit : workspace.leftSplit;

		// Find an existing chat leaf in this sidebar to get its tab group
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);
		const sidebarLeaf = existingLeaves.find(
			(leaf) => leaf.getRoot() === split,
		);

		if (sidebarLeaf) {
			const tabGroup = sidebarLeaf.parent;
			// Index is clamped by Obsidian, so a large value appends to the end
			return workspace.createLeafInParent(
				tabGroup as unknown as WorkspaceSplit,
				Number.MAX_SAFE_INTEGER,
			);
		}

		// Fallback: no existing chat leaf in sidebar, create first one
		return side === "right"
			? workspace.getRightLeaf(false)
			: workspace.getLeftLeaf(false);
	}

	/**
	 * Open a new chat view with a specific agent.
	 * Always creates a new view (doesn't reuse existing).
	 */
	async openNewChatViewWithAgent(agentId: string): Promise<void> {
		const leaf = this.createNewChatLeaf(true);
		if (!leaf) {
			console.warn("[AgentClient] Failed to create new leaf");
			return;
		}

		await leaf.setViewState({
			type: VIEW_TYPE_CHAT,
			active: true,
			state: { initialAgentId: agentId },
		});

		await this.app.workspace.revealLeaf(leaf);

		// Focus textarea after revealing the leaf
		const viewContainerEl = leaf.view?.containerEl;
		if (viewContainerEl) {
			window.setTimeout(() => {
				const textarea = viewContainerEl.querySelector(
					"textarea.agent-client-chat-input-textarea",
				);
				if (textarea instanceof HTMLTextAreaElement) {
					textarea.focus();
				}
			}, 0);
		}
	}

	/**
	 * Open a new floating chat window.
	 * Each window is independent with its own session.
	 */
	openNewFloatingChat(
		initialExpanded = false,
		initialPosition?: { x: number; y: number },
	): void {
		// instanceId is just the counter (e.g., "0", "1", "2")
		// FloatingViewContainer will create viewId as "floating-chat-{instanceId}"
		const instanceId = String(this.floatingChatCounter++);
		const container = createFloatingChat(
			this,
			instanceId,
			initialExpanded,
			initialPosition,
		);
		// Store by viewId for consistent lookup
		this.floatingChatInstances.set(container.viewId, {
			root: null as unknown as Root,
			container: container.getContainerEl(),
		});
	}

	/**
	 * Close a specific floating chat window.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	closeFloatingChat(viewId: string): void {
		const container = this.viewRegistry.get(viewId);
		if (container && container instanceof FloatingViewContainer) {
			container.unmount();
		}
		// Also remove from legacy floatingChatInstances if present
		this.floatingChatInstances.delete(viewId);
	}

	/**
	 * Get all floating chat instance viewIds.
	 * @returns Array of viewIds in "floating-chat-{id}" format
	 */
	getFloatingChatInstances(): string[] {
		return this.viewRegistry.getByType("floating").map((v) => v.viewId);
	}

	/**
	 * Expand a specific floating chat window by triggering a custom event.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	expandFloatingChat(viewId: string): void {
		window.dispatchEvent(
			new CustomEvent("agent-client:expand-floating-chat", {
				detail: { viewId },
			}),
		);
	}

	/**
	 * Toggle a specific floating chat window between expanded and collapsed.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	toggleFloatingChat(viewId: string): void {
		const container = this.viewRegistry.get(viewId);
		if (container && container instanceof FloatingViewContainer) {
			if (container.isExpanded()) {
				container.collapse();
			} else {
				container.expand();
			}
		}
	}

	/**
	 * Get the Copilot agent configuration
	 */
	getAvailableAgents(): Array<{ id: string; displayName: string }> {
		return [
			{
				id: this.settings.copilot.id,
				displayName:
					this.settings.copilot.displayName ||
					this.settings.copilot.id,
			},
		];
	}

	/**
	 * Open chat view and switch to specified agent
	 */
	private async openChatWithAgent(agentId: string): Promise<void> {
		await this.activateView();

		// Trigger new chat with specific agent
		// Pass agentId so ChatComponent knows to force new session even if empty
		this.app.workspace.trigger(
			"agent-client:new-chat-requested" as "quit",
			agentId,
		);
	}

	/**
	 * Register commands for each configured agent
	 */
	private registerAgentCommands(): void {
		const agents = this.getAvailableAgents();

		for (const agent of agents) {
			this.addCommand({
				id: `open-chat-with-${agent.id}`,
				name: `New chat with ${agent.displayName}`,
				callback: async () => {
					await this.openChatWithAgent(agent.id);
				},
			});
		}
	}

	private registerPermissionCommands(): void {
		this.addCommand({
			id: "approve-active-permission",
			name: "Approve active permission",
			callback: async () => {
				// Only activate sidebar view if the focused view is a sidebar
				// (avoid stealing focus from floating views)
				const focusedId = this.lastActiveChatViewId;
				const isFloatingFocused =
					focusedId?.startsWith("floating-chat-");
				if (!isFloatingFocused) {
					await this.activateView();
				}
				this.app.workspace.trigger(
					"agent-client:approve-active-permission" as "quit",
					this.lastActiveChatViewId,
				);
			},
		});

		this.addCommand({
			id: "reject-active-permission",
			name: "Reject active permission",
			callback: async () => {
				// Only activate sidebar view if the focused view is a sidebar
				// (avoid stealing focus from floating views)
				const focusedId = this.lastActiveChatViewId;
				const isFloatingFocused =
					focusedId?.startsWith("floating-chat-");
				if (!isFloatingFocused) {
					await this.activateView();
				}
				this.app.workspace.trigger(
					"agent-client:reject-active-permission" as "quit",
					this.lastActiveChatViewId,
				);
			},
		});

		this.addCommand({
			id: "toggle-auto-mention",
			name: "Toggle auto-mention",
			callback: async () => {
				// Only activate sidebar view if the focused view is a sidebar
				// (avoid stealing focus from floating views)
				const focusedId = this.lastActiveChatViewId;
				const isFloatingFocused =
					focusedId?.startsWith("floating-chat-");
				if (!isFloatingFocused) {
					await this.activateView();
				}
				this.app.workspace.trigger(
					"agent-client:toggle-auto-mention" as "quit",
					this.lastActiveChatViewId,
				);
			},
		});

		this.addCommand({
			id: "cancel-current-message",
			name: "Cancel current message",
			callback: () => {
				this.app.workspace.trigger(
					"agent-client:cancel-message" as "quit",
					this.lastActiveChatViewId,
				);
			},
		});
	}

	/**
	 * Register broadcast commands for multi-view operations
	 */
	private registerBroadcastCommands(): void {
		// Broadcast prompt: Copy prompt from active view to all other views
		this.addCommand({
			id: "broadcast-prompt",
			name: "Broadcast prompt",
			callback: () => {
				this.broadcastPrompt();
			},
		});

		// Broadcast send: Send message in all views that can send
		this.addCommand({
			id: "broadcast-send",
			name: "Broadcast send",
			callback: () => {
				void this.broadcastSend();
			},
		});

		// Broadcast cancel: Cancel operation in all views
		this.addCommand({
			id: "broadcast-cancel",
			name: "Broadcast cancel",
			callback: () => {
				void this.broadcastCancel();
			},
		});
	}

	/**
	 * Copy prompt from active view to all other views
	 */
	private broadcastPrompt(): void {
		const allViews = this.viewRegistry.getAll();
		if (allViews.length === 0) {
			new Notice("[Agent Client] no chat views open");
			return;
		}

		const inputState = this.viewRegistry.toFocused((v) =>
			v.getInputState(),
		);
		if (
			!inputState ||
			(inputState.text.trim() === "" && inputState.images.length === 0)
		) {
			new Notice("[Agent Client] no prompt to broadcast");
			return;
		}

		const focusedId = this.viewRegistry.getFocusedId();
		const targetViews = allViews.filter((v) => v.viewId !== focusedId);
		if (targetViews.length === 0) {
			new Notice("[Agent Client] no other chat views to broadcast to");
			return;
		}

		for (const view of targetViews) {
			view.setInputState(inputState);
		}
	}

	/**
	 * Send message in all views that can send
	 */
	private async broadcastSend(): Promise<void> {
		const allViews = this.viewRegistry.getAll();
		if (allViews.length === 0) {
			new Notice("[Agent Client] no chat views open");
			return;
		}

		const sendableViews = allViews.filter((v) => v.canSend());
		if (sendableViews.length === 0) {
			new Notice("[Agent Client] no views ready to send");
			return;
		}

		await Promise.allSettled(sendableViews.map((v) => v.sendMessage()));
	}

	/**
	 * Cancel operation in all views
	 */
	private async broadcastCancel(): Promise<void> {
		const allViews = this.viewRegistry.getAll();
		if (allViews.length === 0) {
			new Notice("[Agent Client] no chat views open");
			return;
		}

		await Promise.allSettled(allViews.map((v) => v.cancelOperation()));
		new Notice("[Agent Client] cancel broadcast to all views");
	}

	// ──────────────────────────────────────────────────────────────
	// Scheduled Prompts
	// ──────────────────────────────────────────────────────────────

	/**
	 * Register commands for scheduled / custom prompt management.
	 */
	private registerScheduledPromptCommands(): void {
		this.addCommand({
			id: "run-custom-prompt",
			name: "Run custom prompt",
			callback: () => {
				const prompts = this.settings.customPrompts;
				if (prompts.length === 0) {
					new Notice(
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						"[Agent Client] No custom prompts configured. Add prompts in Settings → Custom Prompts.",
					);
					return;
				}
				new RunPromptModal(
					this.app,
					prompts,
					this.scheduledPromptRunner,
				).open();
			},
		});

		this.addCommand({
			id: "toggle-scheduled-prompts",
			name: "Toggle scheduled prompts (pause / resume)",
			callback: () => {
				if (this.scheduledPromptRunner.isPaused) {
					this.scheduledPromptRunner.resume();
					this.settings.schedulerPaused = false;
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice("[Agent Client] Scheduled prompts resumed");
				} else {
					this.scheduledPromptRunner.pause();
					this.settings.schedulerPaused = true;
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					new Notice("[Agent Client] Scheduled prompts paused");
				}
				this.updateSchedulerStatusBar();
				void this.saveSettings();
			},
		});
	}

	private getTodayPromptHistory(): PromptExecutionRecord[] {
		const today = getLocalDateString(new Date());
		return this.settings.promptExecutionHistory.filter((record) => {
			const day = getLocalDateString(new Date(record.executedAt));
			return day === today;
		});
	}

	private openPluginSettingsTab(): void {
		const appWithSetting = this.app as {
			setting?: {
				open: () => void;
				openTabById: (tabId: string) => void;
			};
		};

		appWithSetting.setting?.open();
		appWithSetting.setting?.openTabById(this.manifest.id);
	}

	private showSchedulerStatusMenu(event: MouseEvent): void {
		if (!this.schedulerStatusBarItem) return;

		const menu = new Menu();
		const now = new Date();
		const running = this.scheduledPromptRunner.getCurrentExecution();
		const next = this.scheduledPromptRunner.getNextScheduledExecution(now);
		const todayHistory = this.getTodayPromptHistory();
		const latestRecord = this.settings.promptExecutionHistory.at(-1);

		menu.addItem((item) => {
			item.setTitle("Scheduler status").setIsLabel(true);
		});

		if (running) {
			const elapsedMs =
				now.getTime() - new Date(running.startedAt).getTime();
			menu.addItem((item) => {
				item.setTitle(
					`Running: ${running.promptName} (${formatDuration(elapsedMs)})`,
				).setIsLabel(true);
			});
		} else if (this.scheduledPromptRunner.isPaused) {
			menu.addItem((item) => {
				item.setTitle("Paused").setIsLabel(true);
			});
		} else if (next) {
			const remainingMs = new Date(next.runAt).getTime() - now.getTime();
			menu.addItem((item) => {
				item.setTitle(
					`Next: ${next.promptName} in ${formatDuration(remainingMs)}`,
				).setIsLabel(true);
			});
		} else {
			menu.addItem((item) => {
				item.setTitle("No upcoming scheduled prompt").setIsLabel(true);
			});
		}

		if (latestRecord) {
			const finishedAt =
				latestRecord.completedAt ?? latestRecord.executedAt;
			const latestStatus = latestRecord.success ? "completed" : "failed";
			menu.addItem((item) => {
				item.setTitle(
					`Last ${latestStatus}: ${latestRecord.promptName} at ${formatClock(finishedAt)}`,
				).setIsLabel(true);
			});
		}

		menu.addSeparator();

		menu.addItem((item) => {
			if (this.scheduledPromptRunner.isPaused) {
				item.setTitle("Resume scheduler")
					.setIcon("play")
					.onClick(() => {
						this.scheduledPromptRunner.resume();
						this.settings.schedulerPaused = false;
						this.updateSchedulerStatusBar();
						void this.saveSettings();
					});
				return;
			}

			item.setTitle("Pause scheduler")
				.setIcon("pause")
				.onClick(() => {
					this.scheduledPromptRunner.pause();
					this.settings.schedulerPaused = true;
					this.updateSchedulerStatusBar();
					void this.saveSettings();
				});
		});

		menu.addItem((item) => {
			item.setTitle("Open custom prompts settings")
				.setIcon("settings")
				.onClick(() => {
					new CustomPromptsModal(this.app, this).open();
				});
		});

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(
				"Today's history (click item to run again)",
			).setIsLabel(true);
		});

		if (todayHistory.length === 0) {
			menu.addItem((item) => {
				item.setTitle("No runs today").setIsLabel(true);
			});
		} else {
			const recentToday = [...todayHistory].slice(-8).reverse();
			for (const record of recentToday) {
				const statusIcon = record.success ? "✅" : "❌";
				const timestamp = formatClock(
					record.completedAt ?? record.executedAt,
				);
				menu.addItem((item) => {
					item.setTitle(
						`${statusIcon} ${timestamp} ${truncateText(record.promptName, 34)}`,
					)
						.setIcon("play")
						.onClick(() => {
							void this.scheduledPromptRunner.runNow(
								record.promptId,
							);
						});
				});
			}

			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle("Clear today's history")
					.setIcon("trash")
					.onClick(() => {
						const today = getLocalDateString(new Date());
						this.settings.promptExecutionHistory =
							this.settings.promptExecutionHistory.filter(
								(record) => {
									const day = getLocalDateString(
										new Date(record.executedAt),
									);
									return day !== today;
								},
							);
						this.updateSchedulerStatusBar();
						void this.saveSettings();
						new Notice(
							"[Agent Client] Cleared today's prompt history",
						);
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * Update the status bar text to reflect current scheduler state.
	 */
	updateSchedulerStatusBar(): void {
		if (!this.schedulerStatusBarItem) return;
		const el = this.schedulerStatusBarItem;
		el.empty();
		el.addClass("agent-client-scheduler-status");

		const enabledCount = this.settings.customPrompts.filter(
			(p) => p.enabled && isTimeWindowPrompt(p),
		).length;
		if (enabledCount === 0) {
			el.title = "";
			return;
		}

		const now = new Date();
		const running =
			this.scheduledPromptRunner?.getCurrentExecution() ?? null;

		const iconEl = el.createSpan({ cls: "agent-client-scheduler-icon" });
		const textEl = el.createSpan({ cls: "agent-client-scheduler-label" });

		if (running) {
			const elapsedMs =
				now.getTime() - new Date(running.startedAt).getTime();
			setIcon(iconEl, "loader-circle");
			iconEl.addClass("is-running");
			textEl.textContent = truncateText(running.promptName, 18);
			el.title = `Running (${formatDuration(elapsedMs)}). Click for details.`;
			return;
		}

		const paused = this.scheduledPromptRunner?.isPaused ?? true;
		if (paused) {
			setIcon(iconEl, "circle-pause");
			iconEl.addClass("is-paused");
			textEl.textContent = `${enabledCount}`;
			el.title = "Scheduled prompts paused. Click for details.";
			return;
		}

		setIcon(iconEl, "timer");
		iconEl.addClass("is-active");
		textEl.textContent = `${enabledCount}`;
		const next = this.scheduledPromptRunner?.getNextScheduledExecution(now);
		if (next) {
			const remainingMs = new Date(next.runAt).getTime() - now.getTime();
			el.title = `Next: ${next.promptName} in ${formatDuration(remainingMs)}. Click for details.`;
			return;
		}

		el.title = "Scheduled prompts active. Click for details.";
	}

	async loadSettings() {
		const rawSettings = ((await this.loadData()) ?? {}) as Record<
			string,
			unknown
		>;

		const copilotFromRaw =
			typeof rawSettings.copilot === "object" &&
			rawSettings.copilot !== null
				? (rawSettings.copilot as Record<string, unknown>)
				: {};

		const resolvedCopilotArgs = sanitizeArgs(copilotFromRaw.args);
		const resolvedCopilotEnv = normalizeEnvVars(copilotFromRaw.env);

		this.settings = {
			copilot: {
				id: DEFAULT_SETTINGS.copilot.id,
				displayName:
					typeof copilotFromRaw.displayName === "string" &&
					copilotFromRaw.displayName.trim().length > 0
						? copilotFromRaw.displayName.trim()
						: DEFAULT_SETTINGS.copilot.displayName,
				command:
					typeof copilotFromRaw.command === "string" &&
					copilotFromRaw.command.trim().length > 0
						? copilotFromRaw.command.trim()
						: DEFAULT_SETTINGS.copilot.command,
				args:
					resolvedCopilotArgs.length > 0
						? resolvedCopilotArgs
						: DEFAULT_SETTINGS.copilot.args,
				env: resolvedCopilotEnv.length > 0 ? resolvedCopilotEnv : [],
			},
			autoAllowPermissions:
				typeof rawSettings.autoAllowPermissions === "boolean"
					? rawSettings.autoAllowPermissions
					: DEFAULT_SETTINGS.autoAllowPermissions,
			autoMentionActiveNote:
				typeof rawSettings.autoMentionActiveNote === "boolean"
					? rawSettings.autoMentionActiveNote
					: DEFAULT_SETTINGS.autoMentionActiveNote,
			debugMode:
				typeof rawSettings.debugMode === "boolean"
					? rawSettings.debugMode
					: DEFAULT_SETTINGS.debugMode,
			nodePath:
				typeof rawSettings.nodePath === "string"
					? rawSettings.nodePath.trim()
					: DEFAULT_SETTINGS.nodePath,
			exportSettings: (() => {
				const rawExport = rawSettings.exportSettings as
					| Record<string, unknown>
					| null
					| undefined;
				if (rawExport && typeof rawExport === "object") {
					return {
						defaultFolder:
							typeof rawExport.defaultFolder === "string"
								? rawExport.defaultFolder
								: DEFAULT_SETTINGS.exportSettings.defaultFolder,
						filenameTemplate:
							typeof rawExport.filenameTemplate === "string"
								? rawExport.filenameTemplate
								: DEFAULT_SETTINGS.exportSettings
										.filenameTemplate,
						autoExportOnNewChat:
							typeof rawExport.autoExportOnNewChat === "boolean"
								? rawExport.autoExportOnNewChat
								: DEFAULT_SETTINGS.exportSettings
										.autoExportOnNewChat,
						autoExportOnCloseChat:
							typeof rawExport.autoExportOnCloseChat === "boolean"
								? rawExport.autoExportOnCloseChat
								: DEFAULT_SETTINGS.exportSettings
										.autoExportOnCloseChat,
						openFileAfterExport:
							typeof rawExport.openFileAfterExport === "boolean"
								? rawExport.openFileAfterExport
								: DEFAULT_SETTINGS.exportSettings
										.openFileAfterExport,
						includeImages:
							typeof rawExport.includeImages === "boolean"
								? rawExport.includeImages
								: DEFAULT_SETTINGS.exportSettings.includeImages,
						imageLocation:
							rawExport.imageLocation === "obsidian" ||
							rawExport.imageLocation === "custom" ||
							rawExport.imageLocation === "base64"
								? rawExport.imageLocation
								: DEFAULT_SETTINGS.exportSettings.imageLocation,
						imageCustomFolder:
							typeof rawExport.imageCustomFolder === "string"
								? rawExport.imageCustomFolder
								: DEFAULT_SETTINGS.exportSettings
										.imageCustomFolder,
						frontmatterTag:
							typeof rawExport.frontmatterTag === "string"
								? rawExport.frontmatterTag
								: DEFAULT_SETTINGS.exportSettings
										.frontmatterTag,
					};
				}
				return DEFAULT_SETTINGS.exportSettings;
			})(),
			windowsWslMode:
				typeof rawSettings.windowsWslMode === "boolean"
					? rawSettings.windowsWslMode
					: DEFAULT_SETTINGS.windowsWslMode,
			windowsWslDistribution:
				typeof rawSettings.windowsWslDistribution === "string"
					? rawSettings.windowsWslDistribution
					: DEFAULT_SETTINGS.windowsWslDistribution,
			sendMessageShortcut:
				rawSettings.sendMessageShortcut === "enter" ||
				rawSettings.sendMessageShortcut === "cmd-enter"
					? rawSettings.sendMessageShortcut
					: DEFAULT_SETTINGS.sendMessageShortcut,
			chatViewLocation:
				rawSettings.chatViewLocation === "right-tab" ||
				rawSettings.chatViewLocation === "right-split" ||
				rawSettings.chatViewLocation === "editor-tab" ||
				rawSettings.chatViewLocation === "editor-split"
					? rawSettings.chatViewLocation
					: DEFAULT_SETTINGS.chatViewLocation,
			displaySettings: (() => {
				const rawDisplay = rawSettings.displaySettings as
					| Record<string, unknown>
					| null
					| undefined;
				if (rawDisplay && typeof rawDisplay === "object") {
					return {
						autoCollapseDiffs:
							typeof rawDisplay.autoCollapseDiffs === "boolean"
								? rawDisplay.autoCollapseDiffs
								: DEFAULT_SETTINGS.displaySettings
										.autoCollapseDiffs,
						diffCollapseThreshold:
							typeof rawDisplay.diffCollapseThreshold ===
								"number" && rawDisplay.diffCollapseThreshold > 0
								? rawDisplay.diffCollapseThreshold
								: DEFAULT_SETTINGS.displaySettings
										.diffCollapseThreshold,
						maxNoteLength:
							typeof rawDisplay.maxNoteLength === "number" &&
							rawDisplay.maxNoteLength >= 1
								? rawDisplay.maxNoteLength
								: DEFAULT_SETTINGS.displaySettings
										.maxNoteLength,
						maxSelectionLength:
							typeof rawDisplay.maxSelectionLength === "number" &&
							rawDisplay.maxSelectionLength >= 1
								? rawDisplay.maxSelectionLength
								: DEFAULT_SETTINGS.displaySettings
										.maxSelectionLength,
						showEmojis:
							typeof rawDisplay.showEmojis === "boolean"
								? rawDisplay.showEmojis
								: DEFAULT_SETTINGS.displaySettings.showEmojis,
						fontSize: parseChatFontSize(rawDisplay.fontSize),
					};
				}
				return DEFAULT_SETTINGS.displaySettings;
			})(),
			savedSessions: Array.isArray(rawSettings.savedSessions)
				? (rawSettings.savedSessions as SavedSessionInfo[])
				: DEFAULT_SETTINGS.savedSessions,
			lastUsedModels: (() => {
				const raw = rawSettings.lastUsedModels;
				if (raw && typeof raw === "object" && !Array.isArray(raw)) {
					const result: Record<string, string> = {};
					for (const [key, value] of Object.entries(
						raw as Record<string, unknown>,
					)) {
						if (
							typeof key === "string" &&
							key.length > 0 &&
							typeof value === "string" &&
							value.length > 0
						) {
							result[key] = value;
						}
					}
					return result;
				}
				return DEFAULT_SETTINGS.lastUsedModels;
			})(),
			showFloatingButton:
				typeof rawSettings.showFloatingButton === "boolean"
					? rawSettings.showFloatingButton
					: DEFAULT_SETTINGS.showFloatingButton,
			floatingButtonImage:
				typeof rawSettings.floatingButtonImage === "string"
					? rawSettings.floatingButtonImage
					: DEFAULT_SETTINGS.floatingButtonImage,
			floatingWindowSize: (() => {
				const raw = rawSettings.floatingWindowSize as
					| { width?: number; height?: number }
					| null
					| undefined;
				if (
					raw &&
					typeof raw === "object" &&
					typeof raw.width === "number" &&
					typeof raw.height === "number"
				) {
					return { width: raw.width, height: raw.height };
				}
				return DEFAULT_SETTINGS.floatingWindowSize;
			})(),
			floatingButtonPosition: (() => {
				const raw = rawSettings.floatingButtonPosition as
					| { right?: number; bottom?: number }
					| null
					| undefined;
				if (
					raw &&
					typeof raw === "object" &&
					typeof raw.right === "number" &&
					typeof raw.bottom === "number"
				) {
					return { right: raw.right, bottom: raw.bottom };
				}
				return DEFAULT_SETTINGS.floatingButtonPosition;
			})(),
			customPrompts: (() => {
				if (!Array.isArray(rawSettings.customPrompts)) {
					return DEFAULT_SETTINGS.customPrompts;
				}
				return (rawSettings.customPrompts as unknown[]).filter(
					(p): p is CustomPrompt =>
						p !== null &&
						typeof p === "object" &&
						typeof (p as Record<string, unknown>).id === "string" &&
						typeof (p as Record<string, unknown>).name ===
							"string" &&
						typeof (p as Record<string, unknown>).content ===
							"string" &&
						typeof (p as Record<string, unknown>)
							.intervalMinutes === "number" &&
						typeof (p as Record<string, unknown>).enabled ===
							"boolean",
				);
			})(),
			promptExecutionHistory: (() => {
				if (!Array.isArray(rawSettings.promptExecutionHistory)) {
					return DEFAULT_SETTINGS.promptExecutionHistory;
				}
				return (rawSettings.promptExecutionHistory as unknown[]).filter(
					(r): r is PromptExecutionRecord =>
						r !== null &&
						typeof r === "object" &&
						typeof (r as Record<string, unknown>).id === "string" &&
						typeof (r as Record<string, unknown>).promptId ===
							"string" &&
						typeof (r as Record<string, unknown>).promptName ===
							"string" &&
						typeof (r as Record<string, unknown>).executedAt ===
							"string" &&
						typeof (r as Record<string, unknown>).success ===
							"boolean",
				);
			})(),
			schedulerPaused:
				typeof rawSettings.schedulerPaused === "boolean"
					? rawSettings.schedulerPaused
					: DEFAULT_SETTINGS.schedulerPaused,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async saveSettingsAndNotify(nextSettings: AgentClientPluginSettings) {
		this.settings = nextSettings;
		await this.saveData(this.settings);
		this.settingsStore.set(this.settings);
	}
}
