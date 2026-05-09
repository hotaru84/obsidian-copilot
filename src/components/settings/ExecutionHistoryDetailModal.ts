import { Modal, App } from "obsidian";
import type { PromptExecutionRecord } from "../../domain/models/scheduled-prompt";

const TRIGGER_LABELS: Record<string, string> = {
	scheduled: "Scheduled",
	manual: "Manual",
	"event:daily-note-created": "Daily Note Created Event",
	"event:external-file-created": "External File Created Event",
};

/**
 * Modal to display detailed information about a scheduled prompt execution record.
 */
export class ExecutionHistoryDetailModal extends Modal {
	private record: PromptExecutionRecord;

	constructor(app: App, record: PromptExecutionRecord) {
		super(app);
		this.record = record;
	}

	onOpen(): void {
		this.titleEl.setText("History detail");
		this.renderContent();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// ════════════════════════════════════════════════════════════════
		// Basic Info Section
		// ════════════════════════════════════════════════════════════════

		const infoSection = contentEl.createDiv("history-detail-section");
		infoSection.createEl("h3", { text: "Basic info" });

		// Title
		const titleRow = infoSection.createDiv("history-detail-row");
		titleRow.createDiv("history-detail-label").setText("Prompt:");
		titleRow.createDiv("history-detail-value").setText(this.record.title);

		// File path
		const pathRow = infoSection.createDiv("history-detail-row");
		pathRow.createDiv("history-detail-label").setText("File:");
		const pathValue = pathRow.createDiv("history-detail-value");
		pathValue.setText(this.record.filePath);
		pathValue.addClass("monospace");

		// Trigger type
		const triggerRow = infoSection.createDiv("history-detail-row");
		triggerRow.createDiv("history-detail-label").setText("Trigger:");
		const triggerLabel = this.record.trigger
			? TRIGGER_LABELS[this.record.trigger] || this.record.trigger
			: "Unknown";
		triggerRow.createDiv("history-detail-value").setText(triggerLabel);

		// Status
		const statusRow = infoSection.createDiv("history-detail-row");
		statusRow.createDiv("history-detail-label").setText("Status:");
		const statusValue = statusRow.createDiv("history-detail-value");
		const isSuccess = this.record.success === true && !this.record.error;
		if (isSuccess) {
			statusValue.setText("Success");
			statusValue.addClass("success");
		} else {
			statusValue.setText("Failure");
			statusValue.addClass("error");
		}

		// ════════════════════════════════════════════════════════════════
		// Timing Section
		// ════════════════════════════════════════════════════════════════

		const timingSection = contentEl.createDiv("history-detail-section");
		timingSection.createEl("h3", { text: "Timing" });

		// Start time
		const startRow = timingSection.createDiv("history-detail-row");
		startRow.createDiv("history-detail-label").setText("Start:");
		const startTime = new Date(this.record.executedAt);
		const startFormatted = this.formatDateTime(startTime);
		startRow.createDiv("history-detail-value").setText(startFormatted);

		// Duration
		if (this.record.completedAt) {
			const durationRow = timingSection.createDiv("history-detail-row");
			durationRow.createDiv("history-detail-label").setText("Duration:");
			const endTime = new Date(this.record.completedAt);
			const duration = endTime.getTime() - startTime.getTime();
			const durationText = this.formatDuration(duration);
			durationRow.createDiv("history-detail-value").setText(durationText);

			// Completion time (optional, detailed)
			const endRow = timingSection.createDiv("history-detail-row");
			endRow.createDiv("history-detail-label").setText("Fininsh:");
			const endFormatted = this.formatDateTime(endTime);
			endRow.createDiv("history-detail-value").setText(endFormatted);
		}

		// ════════════════════════════════════════════════════════════════
		// Context Section (if available)
		// ════════════════════════════════════════════════════════════════

		if (this.record.contextText) {
			const contextSection = contentEl.createDiv(
				"history-detail-section",
			);
			contextSection.createEl("h3", { text: "Context" });

			const contextValue = contextSection.createDiv(
				"history-detail-text-box",
			);
			contextValue.setText(this.record.contextText);
			contextValue.addClass("monospace");
		}

		// ════════════════════════════════════════════════════════════════
		// Response Section (if available)
		// ════════════════════════════════════════════════════════════════

		if (this.record.responseText) {
			const responseSection = contentEl.createDiv(
				"history-detail-section",
			);
			responseSection.createEl("h3", { text: "Agent response" });

			const responseValue = responseSection.createDiv(
				"history-detail-text-box",
			);
			responseValue.setText(this.record.responseText);
			responseValue.addClass("monospace");
		}

		// ════════════════════════════════════════════════════════════════
		// Error Section (if failed)
		// ════════════════════════════════════════════════════════════════

		if (!this.record.success && this.record.error) {
			const errorSection = contentEl.createDiv(
				"history-detail-section error",
			);
			errorSection.createEl("h3", { text: "Error" });

			const errorValue = errorSection.createDiv("history-detail-error");
			errorValue.setText(this.record.error);
		}

		// ════════════════════════════════════════════════════════════════
		// Close Button
		// ════════════════════════════════════════════════════════════════

		const buttonRow = contentEl.createDiv("history-detail-button-row");
		const closeButton = buttonRow.createEl("button", { text: "Close" });
		closeButton.addEventListener("click", () => this.close());
	}

	private formatDateTime(date: Date): string {
		return date.toLocaleString("ja-JP", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	private formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}
}
