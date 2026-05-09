/**
 * Domain models for custom prompts and execution conditions.
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

/** Supported event trigger types for prompt execution. */
export type PromptEventType = "daily-note-created" | "external-file-created";

/** Runtime trigger source persisted to execution history. */
export type PromptExecutionTrigger =
	| "scheduled"
	| "manual"
	| `event:${PromptEventType}`;

/** Periodic (time-based) execution condition. */
export interface PromptPeriodicCondition {
	mode: "periodic";
	enabled: boolean;
	timeWindows: TimeWindow[];
	daysOfWeek?: number[];
	scheduledDate?: string;
}

/** Event-driven execution condition. */
export interface PromptEventCondition {
	mode: "event";
	enabled: boolean;
	eventType: PromptEventType;
	/** Required only when eventType is external-file-created. */
	externalWatchPath?: string;
}

/** Explicit manual-only mode (no automatic execution). */
export interface PromptManualCondition {
	mode: "manual";
	enabled?: boolean;
}

/**
 * Per-prompt execution condition.
 * periodic と event は排他。manual は自動実行なし。
 */
export type PromptExecutionCondition =
	| PromptPeriodicCondition
	| PromptEventCondition
	| PromptManualCondition;

/** Prompt metadata loaded from a prompt markdown file and condition config. */
export interface PromptFileMeta {
	/** Display name */
	title: string;
	/** Optional short description */
	description?: string;
	/** Vault-relative path to the source file */
	filePath: string;
	/** Execution condition from config file. */
	condition: PromptExecutionCondition;
	/** Compatibility field for legacy UI/logic. */
	enabled: boolean;
	/** Compatibility field for periodic configuration. */
	timeWindows: TimeWindow[];
	/** Compatibility field for periodic configuration. */
	daysOfWeek?: number[];
	/** Compatibility field for periodic configuration. */
	scheduledDate?: string;
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
	trigger?: PromptExecutionTrigger;
	/** Error message if the execution failed */
	error?: string;
	/** Context text passed to the agent (for event-triggered runs) */
	contextText?: string;
	/** Agent response (truncated to conserve storage, null if not captured) */
	responseText?: string | null;
}

export interface PromptConditionConfigFile {
	version: 1;
	prompts: Record<string, PromptExecutionCondition>;
}
