import * as React from "react";
const { useState, useRef, useEffect, useCallback, useMemo } = React;
import { createRoot, type Root } from "react-dom/client";
import { Notice } from "obsidian";

import type AgentClientPlugin from "../../plugin";
import type {
	IChatViewContainer,
	ChatViewType,
	ChatInputState,
} from "../../domain/ports/chat-view-container.port";
import type { IChatViewHost } from "./types";
import type { ImagePromptContent } from "../../domain/models/prompt-content";

// Component imports
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";

// Hooks imports
import { useChatController } from "../../hooks/useChatController";

import { clampPosition } from "../../shared/floating-utils";
import { FLOATING_BUTTON_SIZE } from "./FloatingButton";

// Type definitions for Obsidian internal APIs
interface AppWithSettings {
	setting: {
		open: () => void;
		openTabById: (id: string) => void;
	};
}

// ============================================================
// Type Definitions
// ============================================================

/**
 * Callbacks for FloatingViewContainer to access React component state.
 * These enable the container to implement IChatViewContainer by delegating
 * to the React component's state and handlers.
 */
interface FloatingViewCallbacks {
	getDisplayName: () => string;
	getInputState: () => ChatInputState | null;
	setInputState: (state: ChatInputState) => void;
	canSend: () => boolean;
	sendMessage: () => Promise<boolean>;
	sendTextPrompt: (text: string) => Promise<boolean>;
	cancelOperation: () => Promise<void>;
	focus: () => void;
	hasFocus: () => boolean;
	isExpanded: () => boolean;
	expand: () => void;
	collapse: () => void;
}

/**
 * Tracked listener for cleanup on unmount.
 * Uses union type to match IChatViewHost's overloaded registerDomEvent signatures.
 *
 * Note: options is not tracked because current usage sites do not use options.
 * If future code uses options (e.g., { capture: true }), the cleanup will not
 * work correctly. This is acceptable as current usage does not require options.
 */
interface RegisteredListener {
	target: Window | Document | HTMLElement;
	type: string;
	callback: EventListenerOrEventListenerObject;
}

// ============================================================
// FloatingViewContainer Class
// ============================================================

/**
 * Wrapper class that implements IChatViewContainer for floating chat views.
 * Manages the React component lifecycle and provides the interface for
 * unified view management via ChatViewRegistry.
 */
export class FloatingViewContainer implements IChatViewContainer {
	readonly viewType: ChatViewType = "floating";
	readonly viewId: string;

	private plugin: AgentClientPlugin;
	private root: Root | null = null;
	private containerEl: HTMLElement;
	private callbacks: FloatingViewCallbacks | null = null;

	constructor(plugin: AgentClientPlugin, instanceId: string) {
		this.plugin = plugin;
		// viewId format: "floating-chat-{instanceId}" to match useChatController's adapter key
		this.viewId = `floating-chat-${instanceId}`;
		this.containerEl = document.body.createDiv({
			cls: "agent-client-floating-view-root",
		});
	}

	/**
	 * Mount the React component and register with the plugin.
	 */
	mount(
		initialExpanded: boolean,
		initialPosition?: { x: number; y: number },
	): void {
		this.root = createRoot(this.containerEl);
		this.root.render(
			<FloatingChatComponent
				plugin={this.plugin}
				viewId={this.viewId}
				initialExpanded={initialExpanded}
				initialPosition={initialPosition}
				onRegisterCallbacks={(cbs) => {
					this.callbacks = cbs;
				}}
			/>,
		);

		// Register with plugin's view registry
		this.plugin.viewRegistry.register(this);
	}

	/**
	 * Unmount the React component and unregister from the plugin.
	 */
	unmount(): void {
		this.plugin.viewRegistry.unregister(this.viewId);

		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		this.containerEl.remove();
	}

	// ============================================================
	// IChatViewContainer Implementation
	// ============================================================

	getDisplayName(): string {
		return this.callbacks?.getDisplayName() ?? "Chat";
	}

	onActivate(): void {
		this.containerEl.classList.add("is-focused");
	}

	onDeactivate(): void {
		this.containerEl.classList.remove("is-focused");
	}

	focus(): void {
		// Expand if collapsed, then focus
		this.callbacks?.focus();
	}

	hasFocus(): boolean {
		return this.callbacks?.hasFocus() ?? false;
	}

	expand(): void {
		this.callbacks?.expand();
	}

	collapse(): void {
		this.callbacks?.collapse();
	}

	isExpanded(): boolean {
		return this.callbacks?.isExpanded() ?? false;
	}

	getInputState(): ChatInputState | null {
		return this.callbacks?.getInputState() ?? null;
	}

	setInputState(state: ChatInputState): void {
		this.callbacks?.setInputState(state);
	}

	canSend(): boolean {
		return this.callbacks?.canSend() ?? false;
	}

	async sendMessage(): Promise<boolean> {
		return (await this.callbacks?.sendMessage()) ?? false;
	}

	async sendTextPrompt(text: string): Promise<boolean> {
		return (await this.callbacks?.sendTextPrompt(text)) ?? false;
	}

	async cancelOperation(): Promise<void> {
		await this.callbacks?.cancelOperation();
	}

	async close(): Promise<void> {
		this.unmount();
	}

	getContainerEl(): HTMLElement {
		return this.containerEl;
	}
}

// ============================================================
// FloatingChatComponent
// ============================================================

interface FloatingChatComponentProps {
	plugin: AgentClientPlugin;
	viewId: string; // Full viewId passed from FloatingViewContainer
	initialExpanded?: boolean;
	initialPosition?: { x: number; y: number };
	onRegisterCallbacks?: (callbacks: FloatingViewCallbacks) => void;
}

function FloatingChatComponent({
	plugin,
	viewId,
	initialExpanded = false,
	initialPosition,
	onRegisterCallbacks,
}: FloatingChatComponentProps) {
	// ============================================================
	// Chat Controller Hook (Centralized Logic)
	// ============================================================
	const controller = useChatController({
		plugin,
		viewId, // Use viewId prop directly (already in "floating-chat-{id}" format)
		workingDirectory: undefined, // Let hook determine from vault
	});

	const {
		acpAdapter,
		settings,
		session,
		isSessionReady,
		messages,
		isSending,
		permission,
		mentions,
		autoMention,
		slashCommands,
		sessionHistory,
		activeAgentLabel,
		availableAgents,
		errorInfo,
		handleSendMessage,
		handleStopGeneration,
		handleNewChat,
		handleExportChat,
		handleSwitchAgent,
		handleRestartAgent,
		handleClearError,
		handleOpenHistory,
		handleSetMode,
		handleSetModel,
		handleSetRemoteAgent,
		inputValue,
		setInputValue,
		attachedImages,
		setAttachedImages,
		restoredMessage,
		handleRestoredMessageConsumed,
	} = controller;

	// ============================================================
	// UI State (View-Specific)
	// ============================================================
	const [isExpanded, setIsExpanded] = useState(initialExpanded);
	const [size, setSize] = useState(settings.floatingWindowSize);
	const [buttonPosition, setButtonPosition] = useState(() => {
		const pos = settings.floatingButtonPosition || {
			right: 40,
			bottom: 30,
		};
		return {
			x: window.innerWidth - pos.right - FLOATING_BUTTON_SIZE,
			y: window.innerHeight - pos.bottom - FLOATING_BUTTON_SIZE,
		};
	});
	const CHAT_BUTTON_MARGIN = 16;
	const [position, setPosition] = useState(() => {
		// If initialPosition is provided (when opening new window with offset)
		if (initialPosition) {
			return clampPosition(
				initialPosition.x,
				initialPosition.y,
				settings.floatingWindowSize.width,
				settings.floatingWindowSize.height,
			);
		}

		// Default: position above button, right-aligned to button
		const defaultX =
			buttonPosition.x +
			FLOATING_BUTTON_SIZE -
			settings.floatingWindowSize.width;
		const defaultY =
			buttonPosition.y -
			settings.floatingWindowSize.height -
			CHAT_BUTTON_MARGIN;

		return clampPosition(
			defaultX,
			defaultY,
			settings.floatingWindowSize.width,
			settings.floatingWindowSize.height,
		);
	});
	const containerRef = useRef<HTMLDivElement>(null);
	const resizeStateRef = useRef<{
		edge: "left" | "top";
		startMouseX: number;
		startMouseY: number;
		startWidth: number;
		startHeight: number;
	} | null>(null);
	const MIN_WIDTH = 300;
	const MIN_HEIGHT = 460;

	const acpClientRef = useRef(acpAdapter);

	// Track registered listeners for cleanup
	const registeredListenersRef = useRef<RegisteredListener[]>([]);

	// IChatViewHost implementation with listener tracking
	// Type assertion is used because the implementation handles all overload cases uniformly
	const viewHost: IChatViewHost = useMemo(
		() => ({
			app: plugin.app,
			registerDomEvent: ((
				target: Window | Document | HTMLElement,
				type: string,
				callback: EventListenerOrEventListenerObject,
			) => {
				target.addEventListener(type, callback);
				// Track for cleanup on unmount
				// Note: options is not tracked (see RegisteredListener comment)
				registeredListenersRef.current.push({ target, type, callback });
			}) as IChatViewHost["registerDomEvent"],
		}),
		[plugin.app],
	);

	// Cleanup registered listeners on unmount
	useEffect(() => {
		return () => {
			for (const {
				target,
				type,
				callback,
			} of registeredListenersRef.current) {
				target.removeEventListener(type, callback);
			}
			registeredListenersRef.current = [];
		};
	}, []);

	// Handlers for window management
	const handleOpenNewFloatingChat = useCallback(() => {
		// Open new window with 30px offset from current position, clamped to viewport
		plugin.openNewFloatingChat(
			true,
			clampPosition(
				position.x - 30,
				position.y - 30,
				size.width,
				size.height,
			),
		);
	}, [plugin, position.x, position.y, size.width, size.height]);

	const handleCloseWindow = useCallback(() => {
		setIsExpanded(false);
	}, []);

	const handleOpenSettings = useCallback(() => {
		const appWithSettings = plugin.app as unknown as AppWithSettings;
		appWithSettings.setting.open();
		appWithSettings.setting.openTabById(plugin.manifest.id);
	}, [plugin]);

	// Listen for expand requests
	useEffect(() => {
		const handleExpandRequest = (
			event: CustomEvent<{ viewId: string }>,
		) => {
			if (event.detail.viewId === viewId) {
				setIsExpanded(true);
			}
		};

		window.addEventListener(
			"agent-client:expand-floating-chat" as never,
			handleExpandRequest as EventListener,
		);
		return () => {
			window.removeEventListener(
				"agent-client:expand-floating-chat" as never,
				handleExpandRequest as EventListener,
			);
		};
	}, [viewId]);

	// Listen for button position updates
	useEffect(() => {
		const handleButtonMoved = (event: Event) => {
			const customEvent = event as CustomEvent<{
				absoluteX: number;
				absoluteY: number;
				relativeRight: number;
				relativeBottom: number;
			}>;
			setButtonPosition({
				x: customEvent.detail.absoluteX,
				y: customEvent.detail.absoluteY,
			});
		};

		window.addEventListener(
			"agent-client:floating-button-moved",
			handleButtonMoved,
		);
		return () => {
			window.removeEventListener(
				"agent-client:floating-button-moved",
				handleButtonMoved,
			);
		};
	}, []);

	// Update chat position when button moves
	useEffect(() => {
		// Position chat above button, right-aligned to button
		const newX = buttonPosition.x + FLOATING_BUTTON_SIZE - size.width;
		const newY = buttonPosition.y - size.height - CHAT_BUTTON_MARGIN;

		const clampedPos = clampPosition(newX, newY, size.width, size.height);

		setPosition(clampedPos);
	}, [buttonPosition, size.width, size.height, CHAT_BUTTON_MARGIN]);

	const handleLeftResizeStart = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			resizeStateRef.current = {
				edge: "left",
				startMouseX: event.clientX,
				startMouseY: event.clientY,
				startWidth: size.width,
				startHeight: size.height,
			};
		},
		[size.width, size.height],
	);

	const handleTopResizeStart = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			resizeStateRef.current = {
				edge: "top",
				startMouseX: event.clientX,
				startMouseY: event.clientY,
				startWidth: size.width,
				startHeight: size.height,
			};
		},
		[size.width, size.height],
	);

	useEffect(() => {
		const handleMouseMove = (event: MouseEvent) => {
			const resizeState = resizeStateRef.current;
			if (!resizeState) return;

			if (resizeState.edge === "left") {
				const deltaX = event.clientX - resizeState.startMouseX;
				const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - 40);
				const nextWidth = Math.min(
					maxWidth,
					Math.max(MIN_WIDTH, resizeState.startWidth - deltaX),
				);
				setSize((prev) => ({ ...prev, width: nextWidth }));
				return;
			}

			const deltaY = event.clientY - resizeState.startMouseY;
			const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 40);
			const nextHeight = Math.min(
				maxHeight,
				Math.max(MIN_HEIGHT, resizeState.startHeight - deltaY),
			);
			setSize((prev) => ({ ...prev, height: nextHeight }));
		};

		const handleMouseUp = () => {
			resizeStateRef.current = null;
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, []);

	// Sync manual resizing with state
	useEffect(() => {
		if (!isExpanded || !containerRef.current) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				// Only update if significantly different to avoid loops
				if (
					Math.abs(width - size.width) > 5 ||
					Math.abs(height - size.height) > 5
				) {
					setSize({ width, height });
				}
			}
		});

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [isExpanded, size.width, size.height]);

	// Save size to settings
	useEffect(() => {
		const saveSize = async () => {
			if (
				size.width !== settings.floatingWindowSize.width ||
				size.height !== settings.floatingWindowSize.height
			) {
				await plugin.saveSettingsAndNotify({
					...plugin.settings,
					floatingWindowSize: size,
				});
			}
		};

		const timer = setTimeout(() => {
			void saveSize();
		}, 500); // Debounce save
		return () => clearTimeout(timer);
	}, [size, plugin, settings.floatingWindowSize]);

	// Position is now relative to button, no need to save to settings

	// ============================================================
	// Callback Registration for IChatViewContainer
	// ============================================================
	// Register callbacks for FloatingViewContainer to access React component state
	// These must match ChatView's sendMessageForBroadcast/canSendForBroadcast functionality
	useEffect(() => {
		if (onRegisterCallbacks) {
			onRegisterCallbacks({
				getDisplayName: () => activeAgentLabel,
				getInputState: () => ({
					text: inputValue,
					images: attachedImages,
				}),
				setInputState: (state) => {
					setInputValue(state.text);
					setAttachedImages(state.images);
				},
				// Match ChatView.canSendForBroadcast exactly
				canSend: () => {
					const hasContent =
						inputValue.trim() !== "" || attachedImages.length > 0;
					return (
						hasContent &&
						isSessionReady &&
						!sessionHistory.loading &&
						!isSending
					);
				},
				// Match ChatView.sendMessageForBroadcast exactly
				sendMessage: async () => {
					// Allow sending if there's text OR images
					if (!inputValue.trim() && attachedImages.length === 0) {
						return false;
					}
					if (!isSessionReady || sessionHistory.loading) {
						return false;
					}
					if (isSending) {
						return false;
					}

					// Convert attached images to ImagePromptContent format
					const imagesToSend: ImagePromptContent[] =
						attachedImages.map((img) => ({
							type: "image",
							data: img.data,
							mimeType: img.mimeType,
						}));

					// Clear input before sending
					const messageToSend = inputValue.trim();
					setInputValue("");
					setAttachedImages([]);

					await handleSendMessage(
						messageToSend,
						imagesToSend.length > 0 ? imagesToSend : undefined,
					);
					return true;
				},
				// Send arbitrary text directly (for scheduled prompts)
				sendTextPrompt: async (text: string) => {
					if (
						!isSessionReady ||
						sessionHistory.loading ||
						isSending
					) {
						return false;
					}
					await handleSendMessage(text);
					return true;
				},
				cancelOperation: handleStopGeneration,
				// Focus with auto-expand
				focus: () => {
					// Expand if collapsed
					if (!isExpanded) {
						setIsExpanded(true);
					}
					// Focus after next render (expansion may need a frame)
					requestAnimationFrame(() => {
						const textarea = containerRef.current?.querySelector(
							"textarea.agent-client-chat-input-textarea",
						);
						if (textarea instanceof HTMLTextAreaElement) {
							textarea.focus();
						}
					});
				},
				hasFocus: () =>
					isExpanded &&
					(containerRef.current?.contains(document.activeElement) ??
						false),
				isExpanded: () => isExpanded,
				expand: () => {
					setIsExpanded(true);
				},
				collapse: () => {
					setIsExpanded(false);
				},
			});
		}
	}, [
		onRegisterCallbacks,
		activeAgentLabel,
		inputValue,
		attachedImages,
		isSessionReady,
		isSending,
		sessionHistory.loading,
		isExpanded,
		handleSendMessage,
		handleStopGeneration,
	]);

	// ============================================================
	// Workspace Events (Hotkeys) - same as ChatView.ChatComponent
	// ============================================================

	// 1. Toggle auto-mention
	useEffect(() => {
		const workspace = plugin.app.workspace;
		type CustomEventCallback = (targetViewId?: string) => void;

		const eventRef = (
			workspace as unknown as {
				on: (
					name: string,
					callback: CustomEventCallback,
				) => ReturnType<typeof workspace.on>;
			}
		).on("agent-client:toggle-auto-mention", (targetViewId?: string) => {
			if (targetViewId && targetViewId !== viewId) return;
			autoMention.toggle();
		});

		return () => {
			workspace.offref(eventRef);
		};
	}, [plugin.app.workspace, autoMention.toggle, viewId]);

	// 2. New chat requested (from "New chat with [Agent]" command)
	useEffect(() => {
		const workspace = plugin.app.workspace;

		const eventRef = (
			workspace as unknown as {
				on: (
					name: string,
					callback: (agentId?: string) => void,
				) => ReturnType<typeof workspace.on>;
			}
		).on("agent-client:new-chat-requested", (agentId?: string) => {
			// Only respond if we are the last active view
			if (
				plugin.lastActiveChatViewId &&
				plugin.lastActiveChatViewId !== viewId
			) {
				return;
			}
			void handleNewChat(agentId);
		});

		return () => {
			workspace.offref(eventRef);
		};
	}, [
		plugin.app.workspace,
		plugin.lastActiveChatViewId,
		handleNewChat,
		viewId,
	]);

	// 3. Permission commands
	useEffect(() => {
		const workspace = plugin.app.workspace;
		type CustomEventCallback = (targetViewId?: string) => void;

		const approveRef = (
			workspace as unknown as {
				on: (
					name: string,
					callback: CustomEventCallback,
				) => ReturnType<typeof workspace.on>;
			}
		).on(
			"agent-client:approve-active-permission",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				void (async () => {
					const success = await permission.approveActivePermission();
					if (!success) {
						new Notice(
							"[Agent Client] no active permission request",
						);
					}
				})();
			},
		);

		const rejectRef = (
			workspace as unknown as {
				on: (
					name: string,
					callback: CustomEventCallback,
				) => ReturnType<typeof workspace.on>;
			}
		).on(
			"agent-client:reject-active-permission",
			(targetViewId?: string) => {
				if (targetViewId && targetViewId !== viewId) return;
				void (async () => {
					const success = await permission.rejectActivePermission();
					if (!success) {
						new Notice(
							"[Agent Client] no active permission request",
						);
					}
				})();
			},
		);

		const cancelRef = (
			workspace as unknown as {
				on: (
					name: string,
					callback: CustomEventCallback,
				) => ReturnType<typeof workspace.on>;
			}
		).on("agent-client:cancel-message", (targetViewId?: string) => {
			if (targetViewId && targetViewId !== viewId) return;
			void handleStopGeneration();
		});

		return () => {
			workspace.offref(approveRef);
			workspace.offref(rejectRef);
			workspace.offref(cancelRef);
		};
	}, [
		plugin.app.workspace,
		permission.approveActivePermission,
		permission.rejectActivePermission,
		handleStopGeneration,
		viewId,
	]);

	// ============================================================
	// Focus Tracking (same as ChatView)
	// ============================================================
	useEffect(() => {
		const handleFocus = () => {
			plugin.setLastActiveChatViewId(viewId);
		};

		const container = containerRef.current;
		if (!container) return;

		container.addEventListener("focus", handleFocus, true);
		container.addEventListener("click", handleFocus);

		// Set as active on mount
		plugin.setLastActiveChatViewId(viewId);

		return () => {
			container.removeEventListener("focus", handleFocus, true);
			container.removeEventListener("click", handleFocus);
		};
	}, [plugin, viewId, isExpanded]);

	// ============================================================
	// Render
	// ============================================================
	if (!isExpanded) return null;

	return (
		<div
			ref={containerRef}
			className="agent-client-floating-window"
			style={{
				left: position.x,
				top: position.y,
				width: size.width,
				height: size.height,
			}}
		>
			<div
				className="agent-client-floating-resize-handle agent-client-floating-resize-handle-left"
				onMouseDown={handleLeftResizeStart}
			/>
			<div
				className="agent-client-floating-resize-handle agent-client-floating-resize-handle-top"
				onMouseDown={handleTopResizeStart}
			/>

			<div className="agent-client-floating-content">
				<div className="agent-client-floating-messages-container">
					<ChatMessages
						messages={messages}
						isSending={isSending}
						isSessionReady={isSessionReady}
						isRestoringSession={sessionHistory.loading}
						agentLabel={activeAgentLabel}
						plugin={plugin}
						view={viewHost}
						acpClient={acpClientRef.current}
						onApprovePermission={permission.approvePermission}
					/>
				</div>

				<ChatInput
					isSending={isSending}
					isSessionReady={isSessionReady}
					isRestoringSession={sessionHistory.loading}
					agentLabel={activeAgentLabel}
					availableCommands={session.availableCommands || []}
					autoMentionEnabled={settings.autoMentionActiveNote}
					restoredMessage={restoredMessage}
					mentions={mentions}
					slashCommands={slashCommands}
					autoMention={autoMention}
					plugin={plugin}
					view={viewHost}
					onSendMessage={handleSendMessage}
					onStopGeneration={handleStopGeneration}
					onRestoredMessageConsumed={handleRestoredMessageConsumed}
					modes={session.modes}
					onModeChange={(modeId) => void handleSetMode(modeId)}
					models={session.models}
					onModelChange={(modelId) => void handleSetModel(modelId)}
					remoteAgents={session.remoteAgents}
					onRemoteAgentChange={(agentId) =>
						void handleSetRemoteAgent(agentId)
					}
					supportsImages={session.promptCapabilities?.image ?? false}
					agentId={session.agentId}
					inputValue={inputValue}
					onInputChange={setInputValue}
					attachedImages={attachedImages}
					onAttachedImagesChange={setAttachedImages}
					errorInfo={errorInfo}
					onClearError={handleClearError}
					messages={messages}
					// Tool menu props
					availableAgents={availableAgents}
					currentAgentId={session.agentId}
					hasHistoryCapability={sessionHistory.canShowSessionHistory}
					onNewChat={() => void handleNewChat()}
					onNewChatInNewTab={handleOpenNewFloatingChat}
					onOpenHistory={() => void handleOpenHistory()}
					onExportChat={() => void handleExportChat()}
					onSwitchAgent={(agentId) => void handleSwitchAgent(agentId)}
					onRestartAgent={() => void handleRestartAgent()}
					onOpenSettings={handleOpenSettings}
					onCloseWindow={handleCloseWindow}
				/>
			</div>
		</div>
	);
}
/**
 * Create a new floating chat view.
 * @param plugin - The plugin instance
 * @param instanceId - The instance ID (e.g., "0", "1", "2")
 * @param initialExpanded - Whether to start expanded
 * @returns The FloatingViewContainer instance
 */
export function createFloatingChat(
	plugin: AgentClientPlugin,
	instanceId: string,
	initialExpanded = false,
	initialPosition?: { x: number; y: number },
): FloatingViewContainer {
	const container = new FloatingViewContainer(plugin, instanceId);
	container.mount(initialExpanded, initialPosition);
	return container;
}
