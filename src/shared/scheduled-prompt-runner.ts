/**
 * Scheduled Prompt Runner
 *
 * Manages periodic execution of custom prompts.
 * Each enabled prompt with a non-zero interval is checked every minute
 * and executed when its interval has elapsed since the last run.
 */

import { Notice } from "obsidian";
import type {
	CustomPrompt,
	PromptExecutionRecord,
} from "../domain/models/scheduled-prompt";
import type { IChatViewContainer } from "../domain/ports/chat-view-container.port";

/** Maximum number of execution records to keep */
const MAX_HISTORY = 50;

export interface SchedulerCallbacks {
	/** Return the current list of custom prompts */
	getPrompts: () => CustomPrompt[];
	/** Called after each execution attempt to persist the record */
	onRecord: (record: PromptExecutionRecord) => void;
	/** Return the best available chat view for sending, or null if none */
	getView: () => IChatViewContainer | null;
}

/**
 * Runs custom prompts on a schedule.
 *
 * Usage:
 *   const runner = new ScheduledPromptRunner(callbacks);
 *   runner.start();   // begin the 1-minute tick
 *   runner.stop();    // stop ticking (on plugin unload)
 *   runner.pause();   // suspend execution without stopping the tick
 *   runner.resume();  // re-enable execution
 *   runner.runNow(id); // manual one-shot execution
 */
export class ScheduledPromptRunner {
	private intervalId: number | null = null;
	private lastRunTimes = new Map<string, number>();
	private _paused = false;
	private readonly callbacks: SchedulerCallbacks;

	constructor(callbacks: SchedulerCallbacks) {
		this.callbacks = callbacks;
	}

	// ──────────────────────────────────────────────────────────────
	// Lifecycle
	// ──────────────────────────────────────────────────────────────

	/** Start the 1-minute scheduler tick. Idempotent. */
	start(): void {
		if (this.intervalId !== null) return;
		this.intervalId = window.setInterval(() => void this.tick(), 60_000);
	}

	/** Stop the scheduler tick permanently (call on plugin unload). */
	stop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/** Suspend scheduled execution without stopping the tick. */
	pause(): void {
		this._paused = true;
	}

	/** Resume suspended execution. */
	resume(): void {
		this._paused = false;
	}

	/** Whether the scheduler is actively executing prompts (running and not paused). */
	get isActive(): boolean {
		return this.intervalId !== null && !this._paused;
	}

	/** Whether execution has been suspended via pause(). */
	get isPaused(): boolean {
		return this._paused;
	}

	// ──────────────────────────────────────────────────────────────
	// Manual Execution
	// ──────────────────────────────────────────────────────────────

	/** Execute a specific prompt immediately, regardless of its schedule. */
	async runNow(promptId: string): Promise<void> {
		const prompt = this.callbacks
			.getPrompts()
			.find((p) => p.id === promptId);
		if (!prompt) {
			new Notice(`[Agent Client] Prompt not found: ${promptId}`);
			return;
		}
		await this.executePrompt(prompt);
	}

	// ──────────────────────────────────────────────────────────────
	// Internal
	// ──────────────────────────────────────────────────────────────

	private async tick(): Promise<void> {
		if (this._paused) return;

		const now = Date.now();
		const prompts = this.callbacks
			.getPrompts()
			.filter((p) => p.enabled && p.intervalMinutes > 0);

		for (const prompt of prompts) {
			const lastRun = this.lastRunTimes.get(prompt.id) ?? 0;
			const intervalMs = prompt.intervalMinutes * 60_000;
			if (now - lastRun >= intervalMs) {
				await this.executePrompt(prompt);
				this.lastRunTimes.set(prompt.id, Date.now());
			}
		}
	}

	private async executePrompt(prompt: CustomPrompt): Promise<void> {
		const record: PromptExecutionRecord = {
			id: crypto.randomUUID(),
			promptId: prompt.id,
			promptName: prompt.name,
			executedAt: new Date().toISOString(),
			success: false,
		};

		const view = this.callbacks.getView();

		if (!view) {
			record.error = "No active chat view";
			new Notice(
				`[Agent Client] Scheduled prompt "${prompt.name}": No active chat view`,
				5000,
			);
			this.callbacks.onRecord(record);
			return;
		}

		try {
			const sent = await view.sendTextPrompt(prompt.content);
			if (sent) {
				record.success = true;
				new Notice(
					`[Agent Client] Scheduled prompt "${prompt.name}" executed`,
					3000,
				);
			} else {
				record.error = "Session not ready";
				new Notice(
					`[Agent Client] Scheduled prompt "${prompt.name}": Session not ready`,
					5000,
				);
			}
		} catch (error) {
			record.error =
				error instanceof Error ? error.message : String(error);
			new Notice(
				`[Agent Client] Scheduled prompt "${prompt.name}" failed: ${record.error}`,
				5000,
			);
		}

		this.callbacks.onRecord(record);
	}
}

/** Trim execution history to at most MAX_HISTORY entries (newest first). */
export function trimExecutionHistory(
	records: PromptExecutionRecord[],
): PromptExecutionRecord[] {
	if (records.length <= MAX_HISTORY) return records;
	return records.slice(records.length - MAX_HISTORY);
}
