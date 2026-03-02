/**
 * Domain models for scheduled custom prompts.
 *
 * Custom prompts can be executed manually or within specified time windows.
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
 * A named custom prompt with an optional execution schedule.
 *
 * New format uses time windows and days of week.
 * Legacy format uses intervalMinutes (kept for backward compatibility).
 */
export interface CustomPrompt {
	/** Unique identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Prompt text to send to the agent */
	content: string;
	/** Whether scheduled execution is currently active */
	enabled: boolean;

	// New format fields
	/** Time windows when the prompt can be executed (empty = manual-only) */
	timeWindows?: TimeWindow[];
	/** Days of week (0=Sunday, 6=Saturday, empty = every day) */
	daysOfWeek?: number[];

	// Legacy format field (deprecated)
	/** @deprecated Use timeWindows instead. Repeat interval in minutes (0 = disabled / manual-only) */
	intervalMinutes?: number;
}

/**
 * A single execution record for audit / history display.
 */
export interface PromptExecutionRecord {
	/** Unique identifier for this record */
	id: string;
	/** ID of the prompt that was run */
	promptId: string;
	/** Name of the prompt at the time of execution */
	promptName: string;
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

/**
 * Type guard to check if a prompt uses the legacy interval-based format.
 */
export function isLegacyPrompt(prompt: CustomPrompt): boolean {
	return (
		prompt.intervalMinutes !== undefined &&
		(!prompt.timeWindows || prompt.timeWindows.length === 0)
	);
}

/**
 * Type guard to check if a prompt uses the new time-window format.
 */
export function isTimeWindowPrompt(prompt: CustomPrompt): boolean {
	return prompt.timeWindows !== undefined && prompt.timeWindows.length > 0;
}
