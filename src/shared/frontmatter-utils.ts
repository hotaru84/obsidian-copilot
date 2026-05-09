/**
 * Utilities for parsing and writing YAML front-matter on prompt files.
 */

import type { PromptFileMeta } from "../domain/models/scheduled-prompt";

/**
 * Parse prompt display metadata from front-matter.
 * Execution conditions are loaded from a separate JSON config file.
 */
export function parsePromptFrontmatter(
	frontmatter: Record<string, unknown> | null | undefined,
	filePath: string,
): PromptFileMeta {
	const fm = frontmatter ?? {};

	const title =
		typeof fm.title === "string" && fm.title.trim()
			? fm.title.trim()
			: (filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath);

	const description =
		typeof fm.description === "string" && fm.description.trim()
			? fm.description.trim()
			: undefined;

	return {
		title,
		description,
		filePath,
		condition: { mode: "manual" },
		enabled: false,
		timeWindows: [],
	};
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
---

Please summarise my recent notes and suggest concrete next steps for today.
`;
