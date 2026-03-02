/**
 * Modal for running a custom prompt manually.
 *
 * Presents a fuzzy-search list of configured custom prompts and runs
 * the selected one immediately via the ScheduledPromptRunner.
 */

import { FuzzySuggestModal, App } from "obsidian";
import type { CustomPrompt } from "../../domain/models/scheduled-prompt";
import type { ScheduledPromptRunner } from "../../shared/scheduled-prompt-runner";

export class RunPromptModal extends FuzzySuggestModal<CustomPrompt> {
	private prompts: CustomPrompt[];
	private runner: ScheduledPromptRunner;

	constructor(
		app: App,
		prompts: CustomPrompt[],
		runner: ScheduledPromptRunner,
	) {
		super(app);
		this.prompts = prompts;
		this.runner = runner;
		this.setPlaceholder("Select a prompt to run now…");
	}

	getItems(): CustomPrompt[] {
		return this.prompts;
	}

	getItemText(item: CustomPrompt): string {
		return item.name;
	}

	onChooseItem(item: CustomPrompt): void {
		void this.runner.runNow(item.id);
	}
}
