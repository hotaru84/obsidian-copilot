import { App, Notice } from "obsidian";
import type {
	PromptConditionConfigFile,
	PromptEventCondition,
	PromptExecutionCondition,
	PromptPeriodicCondition,
	TimeWindow,
} from "../domain/models/scheduled-prompt";

export const PROMPT_CONDITION_CONFIG_VERSION = 1;

function isTime(value: string): boolean {
	return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeTimeWindows(raw: unknown): TimeWindow[] {
	if (!Array.isArray(raw)) return [];
	const windows: TimeWindow[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const startTime = (item as Record<string, unknown>).startTime;
		const endTime = (item as Record<string, unknown>).endTime;
		if (typeof startTime !== "string" || typeof endTime !== "string") {
			continue;
		}
		if (!isTime(startTime) || !isTime(endTime)) continue;
		if (startTime >= endTime) continue;
		windows.push({ startTime, endTime });
		if (windows.length >= 3) break;
	}
	return windows;
}

function normalizeDaysOfWeek(raw: unknown): number[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const unique = new Set<number>();
	for (const item of raw) {
		const n = Number(item);
		if (Number.isInteger(n) && n >= 0 && n <= 6) {
			unique.add(n);
		}
	}
	if (unique.size === 0 || unique.size === 7) return undefined;
	return Array.from(unique).sort((a, b) => a - b);
}

function normalizeScheduledDate(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const trimmed = raw.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return undefined;
	if (date.toISOString().slice(0, 10) !== trimmed) return undefined;
	return trimmed;
}

function normalizePeriodic(
	raw: Record<string, unknown>,
): PromptPeriodicCondition {
	const timeWindows = normalizeTimeWindows(raw.timeWindows);
	const enabled =
		typeof raw.enabled === "boolean" ? raw.enabled : timeWindows.length > 0;
	return {
		mode: "periodic",
		enabled,
		timeWindows,
		daysOfWeek: normalizeDaysOfWeek(raw.daysOfWeek),
		scheduledDate: normalizeScheduledDate(raw.scheduledDate),
	};
}

function normalizeEvent(raw: Record<string, unknown>): PromptEventCondition {
	const eventType =
		raw.eventType === "external-file-created"
			? "external-file-created"
			: "daily-note-created";
	const externalWatchPath =
		eventType === "external-file-created" &&
		typeof raw.externalWatchPath === "string"
			? raw.externalWatchPath.trim()
			: undefined;
	return {
		mode: "event",
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
		eventType,
		externalWatchPath,
	};
}

export function normalizePromptCondition(
	raw: unknown,
): PromptExecutionCondition {
	if (!raw || typeof raw !== "object") {
		return { mode: "manual" };
	}
	const record = raw as Record<string, unknown>;
	if (record.mode === "periodic") {
		return normalizePeriodic(record);
	}
	if (record.mode === "event") {
		return normalizeEvent(record);
	}
	return { mode: "manual" };
}

export function createEmptyPromptConditionConfig(): PromptConditionConfigFile {
	return {
		version: PROMPT_CONDITION_CONFIG_VERSION,
		prompts: {},
	};
}

export function normalizePromptConditionConfig(
	raw: unknown,
): PromptConditionConfigFile {
	if (!raw || typeof raw !== "object") {
		return createEmptyPromptConditionConfig();
	}
	const record = raw as Record<string, unknown>;
	const promptsRaw = record.prompts;
	const prompts: Record<string, PromptExecutionCondition> = {};
	if (promptsRaw && typeof promptsRaw === "object") {
		for (const [filePath, condition] of Object.entries(
			promptsRaw as Record<string, unknown>,
		)) {
			if (typeof filePath !== "string" || filePath.trim().length === 0) {
				continue;
			}
			prompts[filePath] = normalizePromptCondition(condition);
		}
	}
	return {
		version: PROMPT_CONDITION_CONFIG_VERSION,
		prompts,
	};
}

export async function loadPromptConditionConfig(
	app: App,
	configPath: string,
): Promise<PromptConditionConfigFile> {
	try {
		const exists = await app.vault.adapter.exists(configPath);
		if (!exists) {
			return createEmptyPromptConditionConfig();
		}
		const content = await app.vault.adapter.read(configPath);
		const parsed = JSON.parse(content) as unknown;
		return normalizePromptConditionConfig(parsed);
	} catch {
		new Notice(
			`[Agent Client] Failed to parse prompt condition config: ${configPath}`,
			5000,
		);
		return createEmptyPromptConditionConfig();
	}
}

export async function savePromptConditionConfig(
	app: App,
	configPath: string,
	config: PromptConditionConfigFile,
): Promise<void> {
	const normalized = normalizePromptConditionConfig(config);
	const content = `${JSON.stringify(normalized, null, 2)}\n`;

	const folderPath = configPath.includes("/")
		? configPath.slice(0, configPath.lastIndexOf("/"))
		: "";
	if (folderPath) {
		await ensureFolder(app, folderPath);
	}

	await app.vault.adapter.write(configPath, content);
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const normalized = folderPath.replace(/\\/g, "/").replace(/\/+$/g, "");
	if (!normalized) return;
	const parts = normalized.split("/").filter((part) => part.length > 0);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		try {
			const exists = await app.vault.adapter.exists(current);
			if (!exists) {
				await app.vault.adapter.mkdir(current);
			}
		} catch {
			// Ignore: folder may have been created concurrently.
		}
	}
}
