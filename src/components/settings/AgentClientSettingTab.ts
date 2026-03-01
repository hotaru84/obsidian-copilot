import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	Platform,
} from "obsidian";
import type AgentClientPlugin from "../../plugin";
import type { AgentEnvVar, ChatViewLocation } from "../../plugin";
import { normalizeEnvVars } from "../../shared/settings-utils";
import {
	CHAT_FONT_SIZE_MAX,
	CHAT_FONT_SIZE_MIN,
	parseChatFontSize,
} from "../../shared/display-settings";

export class AgentClientSettingTab extends PluginSettingTab {
	plugin: AgentClientPlugin;

	constructor(app: App, plugin: AgentClientPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Documentation link
		const docContainer = containerEl.createDiv({
			cls: "agent-client-doc-link",
		});
		docContainer.createSpan({ text: "Need help? Check out the " });
		docContainer.createEl("a", {
			text: "GitHub Copilot documentation",
			href: "https://docs.github.com/en/copilot/reference/acp-server",
		});
		docContainer.createSpan({ text: "." });

		// ─────────────────────────────────────────────────────────────────────
		// GitHub Copilot
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("GitHub Copilot").setHeading();

		new Setting(containerEl)
			.setName("Copilot CLI path")
			.setDesc(
				'Absolute path to GitHub Copilot CLI. Use "which copilot" (macOS/Linux) or "where copilot" (Windows) to find it. Leave empty to use "copilot" command from path.',
			)
			.addText((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder("copilot")
					.setValue(this.plugin.settings.copilot.command)
					.onChange(async (value) => {
						this.plugin.settings.copilot.command = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Authentication")
			.setDesc(
				"Before using this plugin, you must authenticate with GitHub Copilot CLI. Run: copilot auth login",
			)
			.addButton((button) => {
				button
					.setButtonText("📋 view auth setup")
					.onClick(() => {
						new Notice(
							"To authenticate GitHub Copilot CLI:\n" +
								"1. Open a terminal\n" +
								"2. Run: copilot auth login\n" +
								"3. Follow the prompts",
							10000,
						);
					});
			});

		new Setting(containerEl)
			.setName("ACP arguments")
			.setDesc(
				"Command-line arguments for GitHub Copilot CLI in ACP mode.",
			)
			.addTextArea((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder("--acp\n--stdio")
					.setValue(this.formatArgs(this.plugin.settings.copilot.args))
					.onChange(async (value) => {
						this.plugin.settings.copilot.args = this.parseArgs(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 2;
			});

		// ─────────────────────────────────────────────────────────────────────
		// Core Settings
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl)
			.setName("Node.js path")
			.setDesc(
				'Absolute path to Node.js executable. Use "which node" (macOS/Linux) or "where node" (Windows) to find it.',
			)
			.addText((text) => {
				text.setPlaceholder("Absolute path to node")
					.setValue(this.plugin.settings.nodePath)
					.onChange(async (value) => {
						this.plugin.settings.nodePath = value.trim();
						await this.plugin.saveSettings();
					});
			});

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
			.setDesc(
				"Where to open new chat views (sidebar or editor area)",
			)
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

		// ─────────────────────────────────────────────────────────────────────
		// Display Settings
		// ─────────────────────────────────────────────────────────────────────

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

		// ─────────────────────────────────────────────────────────────────────
		// Floating Chat
		// ─────────────────────────────────────────────────────────────────────

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

		// ─────────────────────────────────────────────────────────────────────
		// Permissions
		// ─────────────────────────────────────────────────────────────────────

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

		// ─────────────────────────────────────────────────────────────────────
		// Windows WSL Settings (Windows only)
		// ─────────────────────────────────────────────────────────────────────

		if (Platform.isWin) {
			new Setting(containerEl)
				.setName("Windows subsystem for Linux")
				.setHeading();

			new Setting(containerEl)
				.setName("Enable WSL mode")
				.setDesc(
					"Run GitHub Copilot inside Windows subsystem for Linux. Useful for better Windows compatibility.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.windowsWslMode)
						.onChange(async (value) => {
							this.plugin.settings.windowsWslMode = value;
							await this.plugin.saveSettings();
							this.display();
						}),
				);

			if (this.plugin.settings.windowsWslMode) {
				new Setting(containerEl)
					.setName("WSL distribution")
					.setDesc(
						"Specify WSL distribution name (leave empty for default). Example: ubuntu, debian",
					)
					.addText((text) =>
						text
							.setPlaceholder("Leave empty for default")
							.setValue(
								this.plugin.settings.windowsWslDistribution ||
									"",
							)
							.onChange(async (value) => {
								this.plugin.settings.windowsWslDistribution =
									value.trim() || undefined;
								await this.plugin.saveSettings();
							}),
					);
			}
		}

		// ─────────────────────────────────────────────────────────────────────
		// Export
		// ─────────────────────────────────────────────────────────────────────

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

		// ─────────────────────────────────────────────────────────────────────
		// Developer
		// ─────────────────────────────────────────────────────────────────────

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

	private formatArgs(args: string[]): string {
		return args.join("\n");
	}

	private parseArgs(value: string): string[] {
		return value
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	private formatEnv(env: AgentEnvVar[]): string {
		return env
			.map((entry) => `${entry.key}=${entry.value ?? ""}`)
			.join("\n");
	}

	private parseEnv(value: string): AgentEnvVar[] {
		const envVars: AgentEnvVar[] = [];

		for (const line of value.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const delimiter = trimmed.indexOf("=");
			if (delimiter === -1) {
				continue;
			}
			const key = trimmed.slice(0, delimiter).trim();
			const envValue = trimmed.slice(delimiter + 1).trim();
			if (!key) {
				continue;
			}
			envVars.push({ key, value: envValue });
		}

		return normalizeEnvVars(envVars);
	}
}
