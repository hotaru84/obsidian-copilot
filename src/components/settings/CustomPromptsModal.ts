import { App, Modal, Notice, Setting, TFile, setIcon } from "obsidian";
import type AgentClientPlugin from "../../plugin";
import type {
	PromptFileMeta,
	TimeWindow,
} from "../../domain/models/scheduled-prompt";
import { SAMPLE_PROMPT_TEMPLATE } from "../../shared/frontmatter-utils";

/** Days of week labels (index matches Date.getDay()) */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Convert a HH:MM regex match to total minutes.
 */
function timeMatchToMinutes(match: RegExpExecArray): number {
	return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
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

		// ── Header with pause and create buttons ──────────────────────────────
		const headerContainer = contentEl.createDiv({
			cls: "agent-client-prompts-header-container",
		});

		// Pause scheduler button (left)
		const pauseButtonEl = headerContainer.createEl("button", {
			cls: "clickable-icon",
		});

		const updatePauseIcon = () => {
			pauseButtonEl.empty();
			const isPaused = this.plugin.settings.schedulerPaused;
			setIcon(pauseButtonEl, isPaused ? "play" : "pause");
			pauseButtonEl.setAttribute(
				"aria-label",
				isPaused
					? "Resume all scheduled prompts"
					: "Pause all scheduled prompts",
			);
			pauseButtonEl.setAttribute(
				"title",
				isPaused
					? "Resume all scheduled prompts"
					: "Pause all scheduled prompts",
			);
		};
		updatePauseIcon();

		pauseButtonEl.addEventListener("click", () => {
			void (async () => {
				this.plugin.settings.schedulerPaused =
					!this.plugin.settings.schedulerPaused;
				if (this.plugin.settings.schedulerPaused) {
					this.plugin.scheduledPromptRunner.pause();
				} else {
					this.plugin.scheduledPromptRunner.resume();
				}
				updatePauseIcon();
				this.plugin.updateSchedulerStatusBar();
				await this.plugin.saveSettings();
			})();
		});

		// Create new prompt button (right)
		const createButtonEl = headerContainer.createEl("button", {
			cls: "clickable-icon",
			attr: {
				"aria-label": "Create new custom prompt",
				title: "Create new custom prompt",
			},
		});
		setIcon(createButtonEl, "plus");
		createButtonEl.addEventListener("click", () => {
			void this.createSamplePrompt();
		});

		// ── Prompts list ─────────────────────────────────────────────────────
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
			);

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

		// ── Accordion wrapper ────────────────────────────────────────────────
		const accordionEl = container.createDiv({
			cls: "agent-client-accordion-item",
		});
		if (isExpanded) accordionEl.addClass("is-open");

		// ── Header ───────────────────────────────────────────────────────────
		const headerEl = accordionEl.createDiv({
			cls: "agent-client-accordion-header",
		});

		// Chevron icon
		const chevronEl = headerEl.createDiv({
			cls: "agent-client-accordion-chevron",
		});
		setIcon(chevronEl, "chevron-right");

		// Title + description + schedule indicator
		const infoEl = headerEl.createDiv({
			cls: "agent-client-accordion-info",
		});

		const titleContainerEl = infoEl.createDiv({
			cls: "agent-client-accordion-title-container",
		});

		// Schedule indicator icon
		const hasSchedule =
			meta.timeWindows.length > 0 ||
			(meta.daysOfWeek && meta.daysOfWeek.length > 0) ||
			meta.scheduledDate;

		if (hasSchedule) {
			const scheduleIconEl = titleContainerEl.createDiv({
				cls: "agent-client-schedule-indicator",
			});
			setIcon(scheduleIconEl, "calendar");
		}

		titleContainerEl.createEl("div", {
			text: meta.title,
			cls: "agent-client-accordion-title",
		});

		if (meta.description) {
			infoEl.createEl("div", {
				text: meta.description,
				cls: "agent-client-accordion-desc",
			});
		}

		// Toggle open/close by flipping CSS class (no full re-render)
		headerEl.addEventListener("click", () => {
			const opening = this.expandedFilePath !== meta.filePath;
			// Collapse any currently open item
			if (this.expandedFilePath !== null) {
				const prev = container.querySelector<HTMLElement>(
					".agent-client-accordion-item.is-open",
				);
				if (prev) prev.removeClass("is-open");
			}
			this.expandedFilePath = opening ? meta.filePath : null;
			if (opening) accordionEl.addClass("is-open");
			else accordionEl.removeClass("is-open");
		});

		// ── Body (always in DOM, shown/hidden via CSS) ────────────────────────
		const bodyEl = accordionEl.createDiv({
			cls: "agent-client-accordion-body",
		});

		// Action buttons (visible only when expanded)
		const bodyActionsEl = bodyEl.createDiv({
			cls: "agent-client-accordion-body-actions",
		});

		const runBtn = bodyActionsEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Run now" },
		});
		setIcon(runBtn, "play");
		runBtn.addEventListener("click", () => {
			void this.plugin.scheduledPromptRunner.runNow(meta.filePath);
		});

		const editBtn = bodyActionsEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Open in editor" },
		});
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => {
			this.openInEditor(meta.filePath);
		});

		const formEl = bodyEl.createDiv({
			cls: "agent-client-prompt-form",
		});

		let editedTitle = meta.title;
		let editedDescription = meta.description ?? "";
		const editedTimeWindows: TimeWindow[] = meta.timeWindows.map((tw) => ({
			...tw,
		}));
		const editedDaysOfWeek: number[] = [...(meta.daysOfWeek ?? [])];
		let editedScheduledDate: string = meta.scheduledDate ?? "";

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

		// Scheduled date (one-time execution)
		new Setting(formEl)
			.setName("Scheduled date")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Run only on this specific date (YYYY-MM-DD). Leave empty for recurring execution.",
			)
			.addText((text) => {
				text.setValue(editedScheduledDate)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("YYYY-MM-DD")
					.onChange((v) => {
						editedScheduledDate = v.trim();
					});
				text.inputEl.type = "date";
				text.inputEl.addClass("agent-client-date-input");
			});

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
						// Validate scheduled date if provided
						if (
							editedScheduledDate &&
							!/^\d{4}-\d{2}-\d{2}$/.test(editedScheduledDate)
						) {
							new Notice(
								// eslint-disable-next-line obsidianmd/ui/sentence-case
								"Invalid date format. Use YYYY-MM-DD (e.g., 2024-03-15).",
							);
							return;
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
								fm.enabled = editedTimeWindows.length > 0;
								fm.timeWindows =
									editedTimeWindows.length > 0
										? editedTimeWindows
										: undefined;
								fm.daysOfWeek =
									editedDaysOfWeek.length > 0 &&
									editedDaysOfWeek.length < 7
										? [...editedDaysOfWeek].sort(
												(a, b) => a - b,
											)
										: undefined;
								fm.scheduledDate =
									editedScheduledDate || undefined;
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
