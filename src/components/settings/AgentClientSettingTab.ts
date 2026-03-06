import {
	App,
	Modal,
	Notice,
	PluginSettingTab,
	Setting,
	Platform,
	TFile,
} from "obsidian";
import type AgentClientPlugin from "../../plugin";
import type { AgentEnvVar, ChatViewLocation } from "../../plugin";
import { normalizeEnvVars } from "../../shared/settings-utils";
import {
	CHAT_FONT_SIZE_MAX,
	CHAT_FONT_SIZE_MIN,
	parseChatFontSize,
} from "../../shared/display-settings";
import type {
	PromptFileMeta,
	TimeWindow,
} from "../../domain/models/scheduled-prompt";
import { SAMPLE_PROMPT_TEMPLATE } from "../../shared/frontmatter-utils";

/**
 * Helper functions for formatting custom prompt schedules
 */

/** Days of week labels (index matches Date.getDay()) */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Convert a HH:MM regex match to total minutes.
 */
function timeMatchToMinutes(match: RegExpExecArray): number {
	return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

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
				button.setButtonText("📋 view auth setup").onClick(() => {
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
					.setValue(
						this.formatArgs(this.plugin.settings.copilot.args),
					)
					.onChange(async (value) => {
						this.plugin.settings.copilot.args =
							this.parseArgs(value);
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
		// Custom Prompts (Scheduled Execution)
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Custom prompts").setHeading();

		new Setting(containerEl)
			.setName("Configure custom prompts")
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

/**
 * Standalone modal for managing custom prompts loaded from a vault folder.
 *
 * Each .md file in the configured prompts folder is treated as a prompt.
 * Scheduling metadata (time windows, days, enabled flag) lives in the file's
 * YAML front-matter; the body text is sent to the agent.
 *
 * Can be opened from:
 *  - main Settings tab ("Custom prompts → Open")
 *  - scheduler status bar menu ("Open custom prompts settings")
 */
export class CustomPromptsModal extends Modal {
	private plugin: AgentClientPlugin;
	/** filePath of the currently expanded prompt row (null = all collapsed) */
	private expandedFilePath: string | null = null;

	constructor(app: App, plugin: AgentClientPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.titleEl.setText("Custom prompts");
		void this.renderContent();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	async renderContent(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		// ── Folder settings ───────────────────────────────────────────────────
		new Setting(contentEl).setName("Prompts folder").setHeading();

		new Setting(contentEl)
			.setName("Folder path")
			.setDesc(
				"Vault-relative path to the folder that contains prompt .md files.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Prompts")
					.setValue(this.plugin.settings.promptsFolder)
					.onChange(async (value) => {
						this.plugin.settings.promptsFolder =
							value.trim() || "Prompts";
						await this.plugin.saveSettings();
					}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create sample prompt")
					.setTooltip(
						"Generate a sample .md prompt file in the folder",
					)
					.onClick(() => {
						void this.createSamplePrompt();
					}),
			);

		// ── Pause toggle ──────────────────────────────────────────────────────
		new Setting(contentEl)
			.setName("Pause scheduler")
			.setDesc(
				"Pause all scheduled prompt executions without removing the prompts.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.schedulerPaused)
					.onChange(async (value) => {
						this.plugin.settings.schedulerPaused = value;
						if (value) {
							this.plugin.scheduledPromptRunner.pause();
						} else {
							this.plugin.scheduledPromptRunner.resume();
						}
						this.plugin.updateSchedulerStatusBar();
						await this.plugin.saveSettings();
					}),
			);

		// ── Prompt file list ──────────────────────────────────────────────────
		new Setting(contentEl).setName("Prompt files").setHeading();

		const prompts = await this.plugin.loadPromptsFromFolder();

		if (prompts.length === 0) {
			contentEl.createEl("p", {
				text: `No .md files found in "${this.plugin.settings.promptsFolder}". Use "Create sample prompt" to get started.`,
				cls: "agent-client-settings-empty-hint",
			});
		} else {
			for (const { meta } of prompts) {
				this.renderPromptRow(contentEl, meta);
			}
		}

		// ── Execution history ─────────────────────────────────────────────────
		const history = this.plugin.settings.promptExecutionHistory;
		if (history.length > 0) {
			new Setting(contentEl).setName("Execution history").setHeading();
			const recent = [...history].reverse().slice(0, 10);
			const historyEl = contentEl.createDiv({
				cls: "agent-client-prompt-history",
			});
			for (const record of recent) {
				const dateStr = new Date(record.executedAt).toLocaleString();
				const statusIcon = record.success ? "✅" : "❌";
				const row = historyEl.createDiv({
					cls: "agent-client-prompt-history-row",
				});
				row.createSpan({
					text: `${statusIcon} ${record.title}`,
					cls: "agent-client-prompt-history-name",
				});
				row.createSpan({
					text: dateStr,
					cls: "agent-client-prompt-history-date",
				});
				if (record.error) {
					row.createSpan({
						text: record.error,
						cls: "agent-client-prompt-history-error",
					});
				}
			}
			new Setting(contentEl).addButton((btn) =>
				btn.setButtonText("Clear history").onClick(async () => {
					this.plugin.settings.promptExecutionHistory = [];
					await this.plugin.saveSettings();
					void this.renderContent();
				}),
			);
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Prompt row rendering
	// ──────────────────────────────────────────────────────────────────────────

	private renderPromptRow(
		container: HTMLElement,
		meta: PromptFileMeta,
	): void {
		const isExpanded = this.expandedFilePath === meta.filePath;

		// ── Summary row ──────────────────────────────────────────────────────
		const rowSetting = new Setting(container)
			.setName(meta.title)
			.setDesc(meta.description ?? "")
			.addButton((btn) =>
				btn
					.setIcon("play")
					.setTooltip("Run now")
					.onClick(() => {
						void this.plugin.scheduledPromptRunner.runNow(
							meta.filePath,
						);
					}),
			)
			.addButton((btn) =>
				btn
					.setIcon("pencil")
					.setTooltip("Open in editor")
					.onClick(() => {
						this.openInEditor(meta.filePath);
					}),
			);

		rowSetting.settingEl.addClass("agent-client-custom-prompt-item");
		rowSetting.settingEl.setAttribute("aria-expanded", String(isExpanded));

		// Click on name or description to toggle expand
		const toggle = () => {
			this.expandedFilePath = isExpanded ? null : meta.filePath;
			void this.renderContent();
		};
		rowSetting.nameEl.addEventListener("click", toggle);
		rowSetting.descEl.addEventListener("click", toggle);

		if (!isExpanded) return;

		// ── Expanded inline form ─────────────────────────────────────────────
		const formEl = container.createDiv({
			cls: "agent-client-prompt-form",
		});

		let editedTitle = meta.title;
		let editedDescription = meta.description ?? "";
		let editedEnabled = meta.enabled;
		const editedTimeWindows: TimeWindow[] = meta.timeWindows.map((tw) => ({
			...tw,
		}));
		const editedDaysOfWeek: number[] = [...(meta.daysOfWeek ?? [])];

		new Setting(formEl).setName("Title").addText((text) =>
			text.setValue(editedTitle).onChange((v) => {
				editedTitle = v.trim();
			}),
		);

		new Setting(formEl).setName("Description").addText((text) =>
			text.setValue(editedDescription).onChange((v) => {
				editedDescription = v;
			}),
		);

		new Setting(formEl).setName("Enabled").addToggle((toggle) =>
			toggle.setValue(editedEnabled).onChange((v) => {
				editedEnabled = v;
			}),
		);

		// Time windows
		const twContainer = formEl.createDiv({
			cls: "agent-client-time-windows",
		});
		const renderTw = () => {
			twContainer.empty();
			new Setting(twContainer)
				.setName("Time windows") // eslint-disable-line obsidianmd/ui/sentence-case
				.setDesc(
					"When this prompt can run. Leave empty for manual-only.",
				);
			if (editedTimeWindows.length === 0) {
				twContainer.createEl("p", {
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text: "No time windows yet. Add one below.",
					cls: "agent-client-settings-empty-hint",
				});
			} else {
				for (let i = 0; i < editedTimeWindows.length; i++) {
					const tw = editedTimeWindows[i];
					new Setting(twContainer)
						.setName(`Window ${i + 1}`)
						.addText((text) => {
							text.setValue(tw.startTime)
								.setPlaceholder("08:00")
								.onChange((v) => {
									tw.startTime = v;
								});
							text.inputEl.type = "time";
							text.inputEl.addClass("agent-client-time-input");
						})
						.addText((text) => {
							text.setValue(tw.endTime)
								.setPlaceholder("10:00")
								.onChange((v) => {
									tw.endTime = v;
								});
							text.inputEl.type = "time";
							text.inputEl.addClass("agent-client-time-input");
						})
						.addButton((btn) =>
							btn
								.setIcon("trash")
								.setTooltip("Remove")
								.onClick(() => {
									editedTimeWindows.splice(i, 1);
									renderTw();
								}),
						);
				}
			}
			new Setting(twContainer).addButton((btn) =>
				btn.setButtonText("Add time window").onClick(() => {
					editedTimeWindows.push({
						startTime: "08:00",
						endTime: "10:00",
					});
					renderTw();
				}),
			);
		};
		renderTw();

		// Days of week
		const daysSetting = new Setting(formEl)
			.setName("Days of week")
			.setDesc(
				"Select days when the prompt should run. Leave empty for every day.",
			)
			.setClass("agent-client-days-of-week");
		const daysContainer = daysSetting.settingEl.createDiv({
			cls: "agent-client-days-checkboxes",
		});
		const safeId = meta.filePath.replace(/[^a-zA-Z0-9]/g, "_");
		for (let day = 0; day < 7; day++) {
			const wrapper = daysContainer.createDiv({
				cls: "agent-client-day-checkbox",
			});
			const checkbox = wrapper.createEl("input", { type: "checkbox" });
			checkbox.id = `edit-day-${safeId}-${day}`;
			checkbox.checked = editedDaysOfWeek.includes(day);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					if (!editedDaysOfWeek.includes(day))
						editedDaysOfWeek.push(day);
				} else {
					const idx = editedDaysOfWeek.indexOf(day);
					if (idx >= 0) editedDaysOfWeek.splice(idx, 1);
				}
			});
			wrapper.createEl("label", {
				text: DAY_LABELS[day],
				attr: { for: checkbox.id },
			});
		}

		// Save / Cancel
		new Setting(formEl)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						// Validate time windows
						for (const tw of editedTimeWindows) {
							const sm = /^(\d{1,2}):(\d{2})$/.exec(tw.startTime);
							const em = /^(\d{1,2}):(\d{2})$/.exec(tw.endTime);
							if (!sm || !em) {
								new Notice(
									// eslint-disable-next-line obsidianmd/ui/sentence-case
									"Invalid time format. Use HH:MM (e.g., 08:00).",
								);
								return;
							}
							if (
								timeMatchToMinutes(sm) >= timeMatchToMinutes(em)
							) {
								new Notice(
									"Start time must be before end time.",
								);
								return;
							}
						}
						// Write back to the file's YAML front-matter
						const file =
							this.plugin.app.vault.getAbstractFileByPath(
								meta.filePath,
							);
						if (!(file instanceof TFile)) {
							new Notice(
								`[Agent Client] File not found: ${meta.filePath}`,
							);
							return;
						}
						await this.plugin.app.fileManager.processFrontMatter(
							file,
							(fm: Record<string, unknown>) => {
								fm.title = editedTitle || meta.title;
								fm.description =
									editedDescription.trim() || undefined;
								fm.enabled = editedEnabled;
								fm.timeWindows =
									editedTimeWindows.length > 0
										? editedTimeWindows.map((tw) => ({
												...tw,
											}))
										: undefined;
								fm.daysOfWeek =
									editedDaysOfWeek.length > 0 &&
									editedDaysOfWeek.length < 7
										? [...editedDaysOfWeek].sort(
												(a, b) => a - b,
											)
										: undefined;
							},
						);
						this.plugin.updateSchedulerStatusBar();
						this.expandedFilePath = null;
						void this.renderContent();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.expandedFilePath = null;
					void this.renderContent();
				}),
			);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Helpers
	// ──────────────────────────────────────────────────────────────────────────

	private openInEditor(filePath: string): void {
		const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice(`[Agent Client] File not found: ${filePath}`);
			return;
		}
		void this.plugin.app.workspace.openLinkText(filePath, "", false);
		this.close();
	}

	private async createSamplePrompt(): Promise<void> {
		const folderPath = this.plugin.settings.promptsFolder || "Prompts";

		// Ensure the folder exists
		const existingFolder =
			this.plugin.app.vault.getAbstractFileByPath(folderPath);
		if (!existingFolder) {
			try {
				await this.plugin.app.vault.createFolder(folderPath);
			} catch {
				// created concurrently – ignore
			}
		}

		// Generate a unique filename
		const baseName = "Daily Note Summary";
		let filePath = `${folderPath}/${baseName}.md`;
		let counter = 1;
		while (this.plugin.app.vault.getAbstractFileByPath(filePath)) {
			filePath = `${folderPath}/${baseName} ${counter}.md`;
			counter++;
		}

		const file = await this.plugin.app.vault.create(
			filePath,
			SAMPLE_PROMPT_TEMPLATE,
		);
		new Notice(`[Agent Client] Created: ${filePath}`);
		void this.plugin.app.workspace.openLinkText(file.path, "", false);
		this.close();
	}
}
