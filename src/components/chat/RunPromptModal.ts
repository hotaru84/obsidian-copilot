/**
 * Modal for running a custom prompt manually.
 *
 * Presents a fuzzy-search list of prompt files loaded from the prompts
 * folder and runs the selected one immediately via ScheduledPromptRunner.
 */

import { FuzzySuggestModal, App } from "obsidian";
import type { PromptFileMeta } from "../../domain/models/scheduled-prompt";
import type { ScheduledPromptRunner } from "../../shared/scheduled-prompt-runner";

export class RunPromptModal extends FuzzySuggestModal<PromptFileMeta> {
	private prompts: PromptFileMeta[];
	private runner: ScheduledPromptRunner;

	constructor(
		app: App,
		prompts: PromptFileMeta[],
		runner: ScheduledPromptRunner,
	) {
		super(app);
		this.prompts = prompts;
		this.runner = runner;
		this.setPlaceholder("Select a prompt to run now\u2026");
	}

	getItems(): PromptFileMeta[] {
		return this.prompts;
	}

	getItemText(item: PromptFileMeta): string {
		return item.description
			? `${item.title} \u2014 ${item.description}`
			: item.title;
	}

	onChooseItem(item: PromptFileMeta): void {
		void this.runner.runNow(item.filePath);
	}
}
