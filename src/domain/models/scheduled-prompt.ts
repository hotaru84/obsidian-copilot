/**
 * Domain models for scheduled custom prompts.
 *
 * Prompts are stored as Markdown files in a designated vault folder.
 * Scheduling metadata (time windows, days of week, enabled flag) is
 * read from the file's YAML front-matter; the body text is sent to
 * the agent.
 */

/**
 * A time window for prompt execution.
 * Times are in HH:MM format (24-hour clock).
 */
export interface TimeWindow {
/** Start time in HH:MM format (e.g., "08:00") */
startTime: string;
/** End time in HH:MM format (e.g., "10:00") */
endTime: string;
}

/**
 * Metadata derived from a prompt file's YAML front-matter.
 * Also carries the vault-relative file path at runtime.
 */
export interface PromptFileMeta {
/** Display name (front-matter `title`) */
title: string;
/** Short description shown in the UI (front-matter `description`) */
description?: string;
/** Whether scheduled execution is currently active (front-matter `enabled`, default true) */
enabled: boolean;
/** Time windows when the prompt can be executed (front-matter `timeWindows`) */
timeWindows: TimeWindow[];
/** Days of week when the prompt can run (0=Sun, 6=Sat; empty = every day) */
daysOfWeek?: number[];
/** Vault-relative path to the source file – injected at runtime */
filePath: string;
}

/**
 * A single execution record for audit / history display.
 */
export interface PromptExecutionRecord {
/** Unique identifier for this record */
id: string;
/** Vault-relative path of the prompt file that was run */
filePath: string;
/** Title of the prompt at the time of execution */
title: string;
/** ISO 8601 start timestamp */
executedAt: string;
/** ISO 8601 completion timestamp */
completedAt?: string;
/** Whether the prompt was sent successfully */
success: boolean;
/** How this run was triggered */
trigger?: "scheduled" | "manual";
/** Error message if the execution failed */
error?: string;
}
