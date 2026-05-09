/**
 * Modal for running a custom prompt manually.
 *
 * Presents a fuzzy-search list of prompt files loaded from the prompts
 * folder and runs the selected one immediately via ScheduledPromptRunner.
 */

import { FuzzySuggestModal, App } from "obsidian";
import type { PromptFileMeta } from "../../domain/models/scheduled-prompt";
import type AgentClientPlugin from "../../plugin";
import { selectDailyNoteDate } from "./DailyNoteDateModal";

export class RunPromptModal extends FuzzySuggestModal<PromptFileMeta> {
	private prompts: PromptFileMeta[];
	private plugin: AgentClientPlugin;

	constructor(
		app: App,
		prompts: PromptFileMeta[],
		plugin: AgentClientPlugin,
	) {
		super(app);
		this.prompts = prompts;
		this.plugin = plugin;
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
		void (async () => {
			const date = await selectDailyNoteDate(this.app);
			if (!date) return;
			await this.plugin.runPromptNowWithDailyNoteDate(
				item.filePath,
				date,
			);
		})();
	}
}
