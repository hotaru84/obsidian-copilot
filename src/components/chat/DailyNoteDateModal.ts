import { App, Modal, Notice, Setting } from "obsidian";

function getLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

class DailyNoteDateModal extends Modal {
	private readonly initialDate: string;
	private readonly onSubmit: (date: string) => void;
	private dateValue: string;

	constructor(
		app: App,
		initialDate: string,
		onSubmit: (date: string) => void,
	) {
		super(app);
		this.initialDate = initialDate;
		this.onSubmit = onSubmit;
		this.dateValue = initialDate;
	}

	onOpen(): void {
		this.titleEl.setText("Select daily note date");
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName("Daily note date")
			.setDesc("Select the daily note date to include as prompt context.")
			.addText((text) => {
				text.setValue(this.initialDate).onChange((value) => {
					this.dateValue = value.trim();
				});
				text.inputEl.type = "date";
				text.inputEl.addClass("agent-client-date-input");
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Run")
					.setCta()
					.onClick(() => {
						if (!/^\d{4}-\d{2}-\d{2}$/.test(this.dateValue)) {
							new Notice("Invalid date format. Use YYYY-MM-DD.");
							return;
						}
						this.onSubmit(this.dateValue);
						this.close();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export async function selectDailyNoteDate(app: App): Promise<string | null> {
	const initialDate = getLocalDateString(new Date());
	return new Promise((resolve) => {
		let settled = false;
		const modal = new DailyNoteDateModal(app, initialDate, (date) => {
			settled = true;
			resolve(date);
		});

		const originalOnClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalOnClose();
			if (!settled) {
				settled = true;
				resolve(null);
			}
		};

		modal.open();
	});
}
