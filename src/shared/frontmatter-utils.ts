/**
 * Utilities for parsing and writing YAML front-matter on prompt files.
 */

import type {
PromptFileMeta,
TimeWindow,
} from "../domain/models/scheduled-prompt";

/**
 * Parse a prompt file's front-matter (as returned by Obsidian's
 * `metadataCache.getFileCache(file)?.frontmatter`) into a `PromptFileMeta`.
 *
 * Missing or invalid fields fall back to safe defaults.
 */
export function parsePromptFrontmatter(
frontmatter: Record<string, unknown> | null | undefined,
filePath: string,
): PromptFileMeta {
const fm = frontmatter ?? {};

const title =
typeof fm.title === "string" && fm.title.trim()
? fm.title.trim()
: filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;

const description =
typeof fm.description === "string" && fm.description.trim()
? fm.description.trim()
: undefined;

const enabled = fm.enabled === false ? false : true;

const timeWindows = parseTimeWindows(fm.timeWindows);
const daysOfWeek = parseDaysOfWeek(fm.daysOfWeek);

return { title, description, enabled, timeWindows, daysOfWeek, filePath };
}

function parseTimeWindows(raw: unknown): TimeWindow[] {
if (!Array.isArray(raw)) return [];
const result: TimeWindow[] = [];
for (const item of raw) {
if (
item &&
typeof item === "object" &&
typeof (item as Record<string, unknown>).startTime === "string" &&
typeof (item as Record<string, unknown>).endTime === "string"
) {
result.push({
startTime: (item as Record<string, string>).startTime,
endTime: (item as Record<string, string>).endTime,
});
}
}
return result;
}

function parseDaysOfWeek(raw: unknown): number[] | undefined {
if (!Array.isArray(raw)) return undefined;
const nums = raw
.map((v) => Number(v))
.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
if (nums.length === 0) return undefined;
return nums;
}

/**
 * Strip the YAML front-matter block from a note's raw content,
 * returning only the body text.
 */
export function stripFrontmatter(content: string): string {
if (!content.startsWith("---")) return content;
const end = content.indexOf("\n---", 3);
if (end === -1) return content;
return content.slice(end + 4).trimStart();
}

/** Sample prompt file content used by "Create sample prompt". */
export const SAMPLE_PROMPT_TEMPLATE = `---
title: Daily Note Summary
description: Summarise today's active note and suggest next steps
enabled: true
timeWindows:
  - startTime: "08:00"
    endTime: "09:00"
daysOfWeek: [1, 2, 3, 4, 5]
---

Please summarise my recent notes and suggest concrete next steps for today.
`;
