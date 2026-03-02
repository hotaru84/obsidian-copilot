/**
 * Domain models for scheduled custom prompts.
 *
 * Custom prompts can be executed manually or on a repeating interval schedule.
 */

/**
 * A named custom prompt with an optional execution schedule.
 */
export interface CustomPrompt {
	/** Unique identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Prompt text to send to the agent */
	content: string;
	/** Repeat interval in minutes (0 = disabled / manual-only) */
	intervalMinutes: number;
	/** Whether scheduled execution is currently active */
	enabled: boolean;
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
	/** ISO 8601 timestamp */
	executedAt: string;
	/** Whether the prompt was sent successfully */
	success: boolean;
	/** Error message if the execution failed */
	error?: string;
}
