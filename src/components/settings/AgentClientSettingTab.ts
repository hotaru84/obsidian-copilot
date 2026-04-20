import { App, PluginSettingTab, Setting } from "obsidian";
import type AgentClientPlugin from "../../plugin";
import type { ChatViewLocation, WindowsNotificationMode } from "../../plugin";
import {
	CHAT_FONT_SIZE_MAX,
	CHAT_FONT_SIZE_MIN,
	parseChatFontSize,
} from "../../shared/display-settings";
import { CustomPromptsModal } from "./CustomPromptsModal";

export class AgentClientSettingTab extends PluginSettingTab {
	plugin: AgentClientPlugin;

	constructor(app: App, plugin: AgentClientPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderDocLink(containerEl);
		this.renderRuntimeSection(containerEl);
		this.renderCoreSection(containerEl);
		this.renderDisplaySection(containerEl);
		this.renderFloatingChatSection(containerEl);
		this.renderPermissionsSection(containerEl);
		this.renderExportSection(containerEl);
		this.renderCustomPromptsSection(containerEl);
		this.renderDeveloperSection(containerEl);
	}

	private renderDocLink(containerEl: HTMLElement): void {
		const docContainer = containerEl.createDiv({
			cls: "agent-client-doc-link",
		});
		docContainer.createSpan({ text: "Need help? Check out the " });
		docContainer.createEl("a", {
			text: "GitHub Copilot documentation",
			href: "https://docs.github.com/en/copilot",
		});
		docContainer.createSpan({ text: "." });
	}

	private renderRuntimeSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Runtime").setHeading();

		new Setting(containerEl)
			.setName("Remote server mode")
			.setDesc(
				"Use bundled runtime server binary or connect to an external remote runtime endpoint.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("bundled", "Bundled server")
					.addOption("external", "External server")
					.setValue(this.plugin.settings.remoteRuntime.serverMode)
					.onChange(async (value) => {
						this.plugin.settings.remoteRuntime.serverMode =
							value as "bundled" | "external";
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Server address")
			.setDesc("Websocket address for external mode.")
			.addText((text) =>
				text
					.setPlaceholder("ws://127.0.0.1:39453")
					.setValue(this.plugin.settings.remoteRuntime.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.remoteRuntime.serverUrl =
							value.trim();
						await this.plugin.saveSettings();
					}),
			);

		if (this.plugin.settings.remoteRuntime.serverMode === "bundled") {
			new Setting(containerEl)
				.setName("Bundled server port")
				.setDesc(
					"TCP port used when launching the bundled runtime server.",
				)
				.addText((text) =>
					text
						.setPlaceholder("39453")
						.setValue(
							String(
								this.plugin.settings.remoteRuntime
									.bundledServerPort,
							),
						)
						.onChange(async (value) => {
							const port = Number.parseInt(value, 10);
							if (!Number.isFinite(port) || port <= 0) {
								return;
							}
							this.plugin.settings.remoteRuntime.bundledServerPort =
								port;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Auto-start bundled server")
				.setDesc(
					"Automatically start bundled server when a remote runtime session is initialized.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.remoteRuntime
								.autoStartBundledServer,
						)
						.onChange(async (value) => {
							this.plugin.settings.remoteRuntime.autoStartBundledServer =
								value;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Bundled executable override")
				.setDesc(
					"Optional absolute path to custom runtime server executable.",
				)
				.addText((text) =>
					text
						.setPlaceholder("C:/path/to/copilot-server-go.exe")
						.setValue(
							this.plugin.settings.remoteRuntime
								.executablePathOverride,
						)
						.onChange(async (value) => {
							this.plugin.settings.remoteRuntime.executablePathOverride =
								value.trim();
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl)
			.setName("Startup timeout (ms)")
			.setDesc("Timeout for remote runtime startup checks.")
			.addText((text) =>
				text
					.setPlaceholder("15000")
					.setValue(
						String(
							this.plugin.settings.remoteRuntime.startupTimeoutMs,
						),
					)
					.onChange(async (value) => {
						const timeout = Number.parseInt(value, 10);
						if (!Number.isFinite(timeout) || timeout < 1000) {
							return;
						}
						this.plugin.settings.remoteRuntime.startupTimeoutMs =
							timeout;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Request timeout (ms)")
			.setDesc("Timeout for runtime server probes and requests.")
			.addText((text) =>
				text
					.setPlaceholder("10000")
					.setValue(
						String(
							this.plugin.settings.remoteRuntime.requestTimeoutMs,
						),
					)
					.onChange(async (value) => {
						const timeout = Number.parseInt(value, 10);
						if (!Number.isFinite(timeout) || timeout < 1000) {
							return;
						}
						this.plugin.settings.remoteRuntime.requestTimeoutMs =
							timeout;
						await this.plugin.saveSettings();
					}),
			);

		/* eslint-disable obsidianmd/ui/sentence-case */
		new Setting(containerEl)
			.setName("Enable MCP config discovery")
			.setDesc(
				"When enabled, runtime discovers MCP config files from the session config directory in addition to explicit servers below.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.remoteRuntime
							.enableConfigDiscovery,
					)
					.onChange(async (value) => {
						this.plugin.settings.remoteRuntime.enableConfigDiscovery =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("MCP servers JSON")
			.setDesc(
				"JSON object for MCP servers. Applied from the next new, resume, or fork session.",
			)
			.addTextArea((textArea) =>
				textArea
					.setPlaceholder(
						'{"example":{"type":"http","url":"https://example.com/mcp"}}',
					)
					.setValue(this.plugin.settings.remoteRuntime.mcpServersJson)
					.onChange(async (value) => {
						this.plugin.settings.remoteRuntime.mcpServersJson =
							value;
						await this.plugin.saveSettings();
					}),
			);
		/* eslint-enable obsidianmd/ui/sentence-case */
	}

	private renderCoreSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Core").setHeading();

		new Setting(containerEl)
			.setName("Send message shortcut")
			.setDesc(
				"Choose the keyboard shortcut to send messages. If using Cmd/Ctrl+Enter, you may need to remove any hotkeys assigned to it (Settings → Hotkeys).",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						"enter",
						"Enter to send, Shift+Enter for newline",
					)
					.addOption(
						"cmd-enter",
						"Cmd/Ctrl+Enter to send, Enter for newline",
					)
					.setValue(this.plugin.settings.sendMessageShortcut)
					.onChange(async (value) => {
						this.plugin.settings.sendMessageShortcut = value as
							| "enter"
							| "cmd-enter";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Chat view location")
			.setDesc("Where to open new chat views (sidebar or editor area)")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("right-tab", "Right sidebar (tab)")
					.addOption("right-split", "Right sidebar (split)")
					.addOption("editor-tab", "Editor area (tab)")
					.addOption("editor-split", "Editor area (split)")
					.setValue(this.plugin.settings.chatViewLocation)
					.onChange(async (value) => {
						this.plugin.settings.chatViewLocation =
							value as ChatViewLocation;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderDisplaySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Display").setHeading();

		new Setting(containerEl)
			.setName("Auto-mention active note")
			.setDesc(
				"Automatically include the active note in the prompt context when sending messages.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoMentionActiveNote)
					.onChange(async (value) => {
						this.plugin.settings.autoMentionActiveNote = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Font size")
			.setDesc(
				`Chat message font size in pixels (${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}). Leave empty for default.`,
			)
			.addText((text) => {
				const getCurrentDisplayValue = (): string => {
					const currentFontSize =
						this.plugin.settings.displaySettings.fontSize;
					return currentFontSize === null
						? ""
						: String(currentFontSize);
				};

				const persistChatFontSize = async (
					fontSize: number | null,
				): Promise<void> => {
					if (
						this.plugin.settings.displaySettings.fontSize ===
						fontSize
					) {
						return;
					}

					const nextSettings = {
						...this.plugin.settings,
						displaySettings: {
							...this.plugin.settings.displaySettings,
							fontSize,
						},
					};
					await this.plugin.saveSettingsAndNotify(nextSettings);
				};

				text.setPlaceholder(
					`${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}`,
				)
					.setValue(getCurrentDisplayValue())
					.onChange(async (value) => {
						if (value.trim().length === 0) {
							await persistChatFontSize(null);
							return;
						}

						const trimmedValue = value.trim();
						if (!/^-?\d+$/.test(trimmedValue)) {
							return;
						}

						const numericValue = Number.parseInt(trimmedValue, 10);
						if (
							numericValue < CHAT_FONT_SIZE_MIN ||
							numericValue > CHAT_FONT_SIZE_MAX
						) {
							return;
						}

						const parsedFontSize = parseChatFontSize(numericValue);
						if (parsedFontSize === null) {
							return;
						}

						const hasChanged =
							this.plugin.settings.displaySettings.fontSize !==
							parsedFontSize;
						if (hasChanged) {
							await persistChatFontSize(parsedFontSize);
						}
					});

				text.inputEl.addEventListener("blur", () => {
					const currentInputValue = text.getValue();
					const parsedFontSize = parseChatFontSize(currentInputValue);

					if (
						currentInputValue.trim().length > 0 &&
						parsedFontSize === null
					) {
						text.setValue(getCurrentDisplayValue());
						return;
					}

					if (parsedFontSize !== null) {
						text.setValue(String(parsedFontSize));
						const hasChanged =
							this.plugin.settings.displaySettings.fontSize !==
							parsedFontSize;
						if (hasChanged) {
							void persistChatFontSize(parsedFontSize);
						}
						return;
					}

					text.setValue("");
				});
			});

		new Setting(containerEl)
			.setName("Show emojis")
			.setDesc(
				"Display emoji icons in tool calls, thoughts, plans, and terminal blocks.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.displaySettings.showEmojis)
					.onChange(async (value) => {
						this.plugin.settings.displaySettings.showEmojis = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-collapse long diffs")
			.setDesc(
				"Automatically collapse diffs that exceed the line threshold.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.displaySettings.autoCollapseDiffs,
					)
					.onChange(async (value) => {
						this.plugin.settings.displaySettings.autoCollapseDiffs =
							value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.displaySettings.autoCollapseDiffs) {
			new Setting(containerEl)
				.setName("Collapse threshold")
				.setDesc(
					"Diffs with more lines than this will be collapsed by default.",
				)
				.addText((text) =>
					text
						.setPlaceholder("10")
						.setValue(
							String(
								this.plugin.settings.displaySettings
									.diffCollapseThreshold,
							),
						)
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num > 0) {
								this.plugin.settings.displaySettings.diffCollapseThreshold =
									num;
								await this.plugin.saveSettings();
							}
						}),
				);
		}
	}

	private renderFloatingChatSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Floating chat").setHeading();

		new Setting(containerEl)
			.setName("Show floating button")
			.setDesc(
				"Display a floating chat button that opens a draggable chat window.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFloatingButton)
					.onChange(async (value) => {
						const wasEnabled =
							this.plugin.settings.showFloatingButton;
						this.plugin.settings.showFloatingButton = value;
						await this.plugin.saveSettings();

						if (value && !wasEnabled) {
							this.plugin.openNewFloatingChat();
						} else if (!value && wasEnabled) {
							const instances =
								this.plugin.getFloatingChatInstances();
							for (const instanceId of instances) {
								this.plugin.closeFloatingChat(instanceId);
							}
						}
					}),
			);

		new Setting(containerEl)
			.setName("Floating button image")
			.setDesc(
				"URL or path to an image for the floating button. Leave empty for default icon.",
			)
			.addText((text) =>
				text
					.setPlaceholder("https://example.com/avatar.png")
					.setValue(this.plugin.settings.floatingButtonImage)
					.onChange(async (value) => {
						this.plugin.settings.floatingButtonImage = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderPermissionsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Permissions").setHeading();

		new Setting(containerEl)
			.setName("Auto-allow permissions")
			.setDesc(
				"Automatically allow all permission requests from GitHub Copilot. ⚠️ use with caution - this gives GitHub Copilot full access to your system.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoAllowPermissions)
					.onChange(async (value) => {
						this.plugin.settings.autoAllowPermissions = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Chat notifications")
			.setDesc(
				"Notify on response completion and permission requests. In background-only mode, notifications are sent only when the Obsidian window is not focused.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("disabled", "Disabled")
					.addOption("always", "Always")
					.addOption(
						"background-only",
						"Only when app is in background",
					)
					.setValue(this.plugin.settings.windowsNotificationMode)
					.onChange(async (value) => {
						this.plugin.settings.windowsNotificationMode =
							value as WindowsNotificationMode;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderExportSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Export folder")
			.setDesc("Folder where chat exports will be saved")
			.addText((text) =>
				text
					.setPlaceholder("Copilot")
					.setValue(this.plugin.settings.exportSettings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.defaultFolder =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Filename template")
			.setDesc(
				"Template for exported filenames. Use {date} for date and {time} for time",
			)
			.addText((text) =>
				text
					.setPlaceholder("copilot_{date}_{time}")
					.setValue(
						this.plugin.settings.exportSettings.filenameTemplate,
					)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.filenameTemplate =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Frontmatter tag")
			.setDesc(
				"Tag to add to exported notes. Supports nested tags (e.g., ai/copilot). Leave empty to disable.",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("ai/copilot")
					.setValue(
						this.plugin.settings.exportSettings.frontmatterTag,
					)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.frontmatterTag =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include images")
			.setDesc("Include images in exported Markdown files")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exportSettings.includeImages)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.includeImages =
							value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.exportSettings.includeImages) {
			new Setting(containerEl)
				.setName("Image location")
				.setDesc("Where to save exported images")
				.addDropdown((dropdown) =>
					dropdown
						.addOption(
							"obsidian",
							"Use Obsidian's attachment setting",
						)
						.addOption("custom", "Save to custom folder")
						.addOption(
							"base64",
							"Embed as base64 (not recommended)",
						)
						.setValue(
							this.plugin.settings.exportSettings.imageLocation,
						)
						.onChange(async (value) => {
							this.plugin.settings.exportSettings.imageLocation =
								value as "obsidian" | "custom" | "base64";
							await this.plugin.saveSettings();
							this.display();
						}),
				);

			if (
				this.plugin.settings.exportSettings.imageLocation === "custom"
			) {
				new Setting(containerEl)
					.setName("Custom image folder")
					.setDesc(
						"Folder path for exported images (relative to vault root)",
					)
					.addText((text) =>
						text
							.setPlaceholder("Copilot/images")
							.setValue(
								this.plugin.settings.exportSettings
									.imageCustomFolder,
							)
							.onChange(async (value) => {
								this.plugin.settings.exportSettings.imageCustomFolder =
									value;
								await this.plugin.saveSettings();
							}),
					);
			}
		}

		new Setting(containerEl)
			.setName("Auto-export on new chat")
			.setDesc(
				"Automatically export the current chat when starting a new chat",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings.autoExportOnNewChat,
					)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.autoExportOnNewChat =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-export on close chat")
			.setDesc(
				"Automatically export the current chat when closing the chat view",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings
							.autoExportOnCloseChat,
					)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.autoExportOnCloseChat =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Open note after export")
			.setDesc("Automatically open the exported note after exporting")
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings.openFileAfterExport,
					)
					.onChange(async (value) => {
						this.plugin.settings.exportSettings.openFileAfterExport =
							value;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderCustomPromptsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Custom prompts").setHeading();

		new Setting(containerEl)
			.setName("Auto-allow permissions in scheduled chat tabs")
			.setDesc(
				"Automatically allow permission requests in background tabs created for scheduled prompt execution. ⚠️ use with caution - this gives scheduled runs full access to your system.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings
							.autoAllowPermissionsForScheduledChats,
					)
					.onChange(async (value) => {
						this.plugin.settings.autoAllowPermissionsForScheduledChats =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Scheduled prompts")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Manage scheduled prompts, time windows, and execution history.",
			)
			.addButton((btn) =>
				btn
					.setButtonText("Open")
					.setCta()
					.onClick(() => {
						new CustomPromptsModal(this.app, this.plugin).open();
					}),
			);
	}

	private renderDeveloperSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Developer").setHeading();

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"Enable debug logging to console. Useful for development and troubleshooting.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
