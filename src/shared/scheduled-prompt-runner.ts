/**
 * Scheduled Prompt Runner
 *
 * Manages time-window-based execution of custom prompts.
 * Each enabled prompt with non-empty time windows is checked every minute
 * and executed once per day when the current time falls within a time window
 * and the prompt's day-of-week matches (if specified).
 */

import { Notice } from "obsidian";
import type {
	CustomPrompt,
	PromptExecutionRecord,
	TimeWindow,
} from "../domain/models/scheduled-prompt";
import {
	isLegacyPrompt,
	isTimeWindowPrompt,
} from "../domain/models/scheduled-prompt";
import type { IChatViewContainer } from "../domain/ports/chat-view-container.port";

/** Maximum number of execution records to keep */
const MAX_HISTORY = 50;

export interface SchedulerCallbacks {
	/** Return the current list of custom prompts */
	getPrompts: () => CustomPrompt[];
	/** Return the current execution history */
	getHistory: () => PromptExecutionRecord[];
	/** Called after each execution attempt to persist the record */
	onRecord: (record: PromptExecutionRecord) => void;
	/** Called when execution state changes (start/finish) */
	onStateChange?: () => void;
	/** Return the best available chat view for sending, or null if none */
	getView: () => IChatViewContainer | null;
}

export interface CurrentExecutionInfo {
	promptId: string;
	promptName: string;
	startedAt: string;
	trigger: "scheduled" | "manual";
}

export interface NextScheduledExecutionInfo {
	promptId: string;
	promptName: string;
	runAt: string;
}

// ──────────────────────────────────────────────────────────────
// Time Utilities
// ──────────────────────────────────────────────────────────────

/**
 * Parse a time string in HH:MM format.
 * @returns Object with hours and minutes, or null if invalid
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
	if (!match) return null;
	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
	return { hours, minutes };
}

/**
 * Get the local date string in YYYY-MM-DD format.
 */
function getLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isExecutedOnDate(
	promptId: string,
	date: Date,
	history: PromptExecutionRecord[],
): boolean {
	const target = getLocalDateString(date);
	return history.some((record) => {
		if (record.promptId !== promptId || !record.success) return false;
		const recordDate = getLocalDateString(new Date(record.executedAt));
		return recordDate === target;
	});
}

/**
 * Check if the current time falls within the specified time window.
 */
function isInTimeWindow(now: Date, window: TimeWindow): boolean {
	const start = parseTime(window.startTime);
	const end = parseTime(window.endTime);
	if (!start || !end) return false;

	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const startMinutes = start.hours * 60 + start.minutes;
	const endMinutes = end.hours * 60 + end.minutes;

	return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

/**
 * Check if a prompt has been executed today.
 */
function isExecutedToday(
	promptId: string,
	history: PromptExecutionRecord[],
): boolean {
	const today = getLocalDateString(new Date());
	return history.some((record) => {
		if (record.promptId !== promptId || !record.success) return false;
		const recordDate = getLocalDateString(new Date(record.executedAt));
		return recordDate === today;
	});
}

/**
 * Check if a prompt should be executed now.
 */
function shouldRunPrompt(
	prompt: CustomPrompt,
	now: Date,
	history: PromptExecutionRecord[],
): boolean {
	// Must be enabled
	if (!prompt.enabled) return false;

	// Legacy prompts are not supported in time-window mode
	if (isLegacyPrompt(prompt)) return false;

	// Must have time windows
	if (!isTimeWindowPrompt(prompt)) return false;

	// Check if already executed today
	if (isExecutedToday(prompt.id, history)) return false;

	// Check day of week (if specified)
	if (prompt.daysOfWeek && prompt.daysOfWeek.length > 0) {
		const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
		if (!prompt.daysOfWeek.includes(dayOfWeek)) return false;
	}

	// Check if current time is in any time window
	return prompt.timeWindows!.some((window) => isInTimeWindow(now, window));
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
	private _paused = false;
	private currentExecution: CurrentExecutionInfo | null = null;
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

	/** Currently running prompt execution, if any. */
	getCurrentExecution(): CurrentExecutionInfo | null {
		return this.currentExecution;
	}

	/** Estimate the next execution time among all enabled scheduled prompts. */
	getNextScheduledExecution(
		now: Date = new Date(),
	): NextScheduledExecutionInfo | null {
		const prompts = this.callbacks.getPrompts();
		const history = this.callbacks.getHistory();

		let best: NextScheduledExecutionInfo | null = null;

		for (const prompt of prompts) {
			if (!prompt.enabled) continue;
			if (isLegacyPrompt(prompt)) continue;
			if (!isTimeWindowPrompt(prompt)) continue;

			const windows = prompt.timeWindows ?? [];
			for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
				const candidateDay = new Date(now);
				candidateDay.setDate(now.getDate() + dayOffset);

				if (prompt.daysOfWeek && prompt.daysOfWeek.length > 0) {
					if (!prompt.daysOfWeek.includes(candidateDay.getDay())) {
						continue;
					}
				}

				if (isExecutedOnDate(prompt.id, candidateDay, history)) {
					continue;
				}

				for (const window of windows) {
					const start = parseTime(window.startTime);
					const end = parseTime(window.endTime);
					if (!start || !end) continue;

					const candidate = new Date(candidateDay);
					candidate.setHours(start.hours, start.minutes, 0, 0);

					if (dayOffset === 0) {
						const nowMinutes =
							now.getHours() * 60 + now.getMinutes();
						const startMinutes = start.hours * 60 + start.minutes;
						const endMinutes = end.hours * 60 + end.minutes;

						if (
							nowMinutes >= startMinutes &&
							nowMinutes <= endMinutes
						) {
							candidate.setTime(now.getTime());
						}
					}

					if (candidate.getTime() < now.getTime()) {
						continue;
					}

					const next = {
						promptId: prompt.id,
						promptName: prompt.name,
						runAt: candidate.toISOString(),
					};

					if (!best) {
						best = next;
						continue;
					}

					if (
						new Date(next.runAt).getTime() <
						new Date(best.runAt).getTime()
					) {
						best = next;
					}
				}

				if (best && dayOffset === 0) {
					const bestTime = new Date(best.runAt).getTime();
					if (bestTime === now.getTime()) {
						return best;
					}
				}
			}
		}

		return best;
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
		await this.executePrompt(prompt, "manual");
	}

	// ──────────────────────────────────────────────────────────────
	// Internal
	// ──────────────────────────────────────────────────────────────

	private async tick(): Promise<void> {
		if (this._paused) return;

		const now = new Date();
		const prompts = this.callbacks.getPrompts();
		const history = this.callbacks.getHistory();

		// Filter prompts that should run now
		const toRun = prompts.filter((p) => shouldRunPrompt(p, now, history));

		// Execute them sequentially
		for (const prompt of toRun) {
			await this.executePrompt(prompt, "scheduled");
		}
	}

	private async executePrompt(
		prompt: CustomPrompt,
		trigger: "scheduled" | "manual",
	): Promise<void> {
		const startedAtIso = new Date().toISOString();
		this.currentExecution = {
			promptId: prompt.id,
			promptName: prompt.name,
			startedAt: startedAtIso,
			trigger,
		};
		this.callbacks.onStateChange?.();

		const record: PromptExecutionRecord = {
			id: crypto.randomUUID(),
			promptId: prompt.id,
			promptName: prompt.name,
			executedAt: startedAtIso,
			trigger,
			success: false,
		};

		try {
			const view = this.callbacks.getView();

			if (!view) {
				record.error = "No active chat view";
				new Notice(
					`[Agent Client] Scheduled prompt "${prompt.name}": No active chat view`,
					5000,
				);
				return;
			}

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
		} finally {
			record.completedAt = new Date().toISOString();
			this.callbacks.onRecord(record);
			this.currentExecution = null;
			this.callbacks.onStateChange?.();
		}
	}
}

/** Trim execution history to at most MAX_HISTORY entries (newest first). */
export function trimExecutionHistory(
	records: PromptExecutionRecord[],
): PromptExecutionRecord[] {
	if (records.length <= MAX_HISTORY) return records;
	return records.slice(records.length - MAX_HISTORY);
}
