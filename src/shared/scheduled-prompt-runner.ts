/**
 * Scheduled Prompt Runner
 *
 * Manages time-window-based execution of custom prompts loaded from
 * a vault folder.  Each enabled prompt with non-empty time windows is
 * checked every minute and executed once per day when the current time
 * falls within a time window and the prompt's day-of-week matches (if
 * specified).
 */

import { Notice } from "obsidian";
import type {
PromptFileMeta,
PromptExecutionRecord,
TimeWindow,
} from "../domain/models/scheduled-prompt";
import type { IChatViewContainer } from "../domain/ports/chat-view-container.port";

/** Maximum number of execution records to keep */
const MAX_HISTORY = 50;

export interface SchedulerCallbacks {
/**
 * Async callback that loads all prompts from the configured folder.
 * Called once per scheduler tick and for manual runs (if cache is empty).
 */
getPromptsFromFolder: () => Promise<
Array<{ meta: PromptFileMeta; body: string }>
>;
/** Return the current execution history */
getHistory: () => PromptExecutionRecord[];
/** Called after each execution attempt to persist the record */
onRecord: (record: PromptExecutionRecord) => void;
/** Called when execution state changes (start/finish) */
onStateChange?: () => void;
/**
 * Return a chat view for sending, opening one if necessary.
 * Called once per execution; may open a new sidebar view when none is
 * registered.
 */
getOrOpenView: () => Promise<IChatViewContainer | null>;
}

export interface CurrentExecutionInfo {
filePath: string;
title: string;
startedAt: string;
trigger: "scheduled" | "manual";
}

export interface NextScheduledExecutionInfo {
filePath: string;
title: string;
runAt: string;
}

/** Maximum retry attempts while waiting for the session to become ready (1 attempt/s). */
const MAX_SESSION_INIT_RETRY_ATTEMPTS = 30;

// ──────────────────────────────────────────────────────────────
// Time Utilities
// ──────────────────────────────────────────────────────────────

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
if (!match) return null;
const hours = parseInt(match[1], 10);
const minutes = parseInt(match[2], 10);
if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
return { hours, minutes };
}

function getLocalDateString(date: Date): string {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
return `${year}-${month}-${day}`;
}

function isExecutedOnDate(
filePath: string,
date: Date,
history: PromptExecutionRecord[],
): boolean {
const target = getLocalDateString(date);
return history.some((record) => {
if (record.filePath !== filePath || !record.success) return false;
return getLocalDateString(new Date(record.executedAt)) === target;
});
}

function isInTimeWindow(now: Date, window: TimeWindow): boolean {
const start = parseTime(window.startTime);
const end = parseTime(window.endTime);
if (!start || !end) return false;
const nowMinutes = now.getHours() * 60 + now.getMinutes();
const startMinutes = start.hours * 60 + start.minutes;
const endMinutes = end.hours * 60 + end.minutes;
return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function isExecutedToday(
filePath: string,
history: PromptExecutionRecord[],
): boolean {
const today = getLocalDateString(new Date());
return history.some((record) => {
if (record.filePath !== filePath || !record.success) return false;
return getLocalDateString(new Date(record.executedAt)) === today;
});
}

function shouldRunPrompt(
meta: PromptFileMeta,
now: Date,
history: PromptExecutionRecord[],
): boolean {
if (!meta.enabled) return false;
if (meta.timeWindows.length === 0) return false;
if (isExecutedToday(meta.filePath, history)) return false;
if (meta.daysOfWeek && meta.daysOfWeek.length > 0) {
if (!meta.daysOfWeek.includes(now.getDay())) return false;
}
return meta.timeWindows.some((w) => isInTimeWindow(now, w));
}

/**
 * Runs custom prompts on a schedule.
 *
 * Usage:
 *   const runner = new ScheduledPromptRunner(callbacks);
 *   runner.start();              // begin the 1-minute tick
 *   runner.stop();               // stop ticking (on plugin unload)
 *   runner.pause();              // suspend execution without stopping the tick
 *   runner.resume();             // re-enable execution
 *   runner.runNow(filePath);     // manual one-shot execution
 */
export class ScheduledPromptRunner {
private intervalId: number | null = null;
private _paused = false;
private currentExecution: CurrentExecutionInfo | null = null;
private readonly callbacks: SchedulerCallbacks;

/** Cached prompt list from the last tick (used by getNextScheduledExecution) */
private cachedPrompts: Array<{ meta: PromptFileMeta; body: string }> = [];

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

/** Returns the last cached prompts (populated after each tick). */
getCachedPrompts(): Array<{ meta: PromptFileMeta; body: string }> {
return this.cachedPrompts;
}

/** Estimate the next execution time among all enabled scheduled prompts (uses cache). */
getNextScheduledExecution(
now: Date = new Date(),
): NextScheduledExecutionInfo | null {
const history = this.callbacks.getHistory();
let best: NextScheduledExecutionInfo | null = null;

for (const { meta } of this.cachedPrompts) {
if (!meta.enabled || meta.timeWindows.length === 0) continue;

for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
const candidateDay = new Date(now);
candidateDay.setDate(now.getDate() + dayOffset);

if (meta.daysOfWeek && meta.daysOfWeek.length > 0) {
if (!meta.daysOfWeek.includes(candidateDay.getDay()))
continue;
}

if (isExecutedOnDate(meta.filePath, candidateDay, history))
continue;

for (const window of meta.timeWindows) {
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

if (candidate.getTime() < now.getTime()) continue;

const next: NextScheduledExecutionInfo = {
filePath: meta.filePath,
title: meta.title,
runAt: candidate.toISOString(),
};

if (
!best ||
new Date(next.runAt).getTime() <
new Date(best.runAt).getTime()
) {
best = next;
}
}

if (best && dayOffset === 0) {
if (new Date(best.runAt).getTime() === now.getTime())
return best;
}
}
}

return best;
}

// ──────────────────────────────────────────────────────────────
// Manual Execution
// ──────────────────────────────────────────────────────────────

/** Execute the prompt at the given vault path immediately, regardless of schedule. */
async runNow(filePath: string): Promise<void> {
// Try cached first, fall back to fresh load
let entry = this.cachedPrompts.find(
(p) => p.meta.filePath === filePath,
);
if (!entry) {
const fresh = await this.callbacks.getPromptsFromFolder();
this.cachedPrompts = fresh;
entry = fresh.find((p) => p.meta.filePath === filePath);
}
if (!entry) {
new Notice(`[Agent Client] Prompt file not found: ${filePath}`);
return;
}
await this.executePrompt(entry.meta, entry.body, "manual");
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

private async tick(): Promise<void> {
if (this._paused) return;

const prompts = await this.callbacks.getPromptsFromFolder();
this.cachedPrompts = prompts;

const now = new Date();
const history = this.callbacks.getHistory();
const toRun = prompts.filter(({ meta }) =>
shouldRunPrompt(meta, now, history),
);

for (const { meta, body } of toRun) {
await this.executePrompt(meta, body, "scheduled");
}
}

private async executePrompt(
meta: PromptFileMeta,
body: string,
trigger: "scheduled" | "manual",
): Promise<void> {
const startedAtIso = new Date().toISOString();
this.currentExecution = {
filePath: meta.filePath,
title: meta.title,
startedAt: startedAtIso,
trigger,
};
this.callbacks.onStateChange?.();

const record: PromptExecutionRecord = {
id: crypto.randomUUID(),
filePath: meta.filePath,
title: meta.title,
executedAt: startedAtIso,
trigger,
success: false,
};

try {
const view = await this.callbacks.getOrOpenView();

if (!view) {
record.error = "No chat view could be opened";
new Notice(
`[Agent Client] Scheduled prompt "${meta.title}": No chat view could be opened`,
5000,
);
return;
}

let sent = false;
for (
let attempt = 0;
attempt < MAX_SESSION_INIT_RETRY_ATTEMPTS;
attempt++
) {
sent = await view.sendTextPrompt(body);
if (sent) break;
if (attempt < MAX_SESSION_INIT_RETRY_ATTEMPTS - 1) {
await new Promise<void>((resolve) =>
window.setTimeout(resolve, 1000),
);
}
}

if (sent) {
record.success = true;
new Notice(
`[Agent Client] Scheduled prompt "${meta.title}" executed`,
3000,
);
} else {
record.error = "Session not ready";
new Notice(
`[Agent Client] Scheduled prompt "${meta.title}": Session not ready`,
5000,
);
}
} catch (error) {
record.error =
error instanceof Error ? error.message : String(error);
new Notice(
`[Agent Client] Scheduled prompt "${meta.title}" failed: ${record.error}`,
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
