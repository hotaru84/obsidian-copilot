import { TFile, TFolder } from "obsidian";
import { getLogger } from "./logger";

// Interface for mention service to avoid circular dependency
export interface IMentionService {
	getAllFiles(): TFile[];
	getAllFolders(): TFolder[];
}

// Mention detection utilities
export interface MentionContext {
	start: number; // Start index of the @ symbol (or @folder prefix)
	end: number; // Current cursor position
	query: string; // Text after @ symbol
	type: "note" | "folder"; // Type of mention
}

// Detect @-mention at current cursor position
export function detectMention(
	text: string,
	cursorPosition: number,
): MentionContext | null {
	const logger = getLogger();
	logger.log("[DEBUG] detectMention called with:", { text, cursorPosition });

	if (cursorPosition < 0 || cursorPosition > text.length) {
		logger.log("[DEBUG] Invalid cursor position");
		return null;
	}

	// Get text up to cursor position
	const textUpToCursor = text.slice(0, cursorPosition);
	logger.log("[DEBUG] Text up to cursor:", textUpToCursor);

	// Check for @folder[[...]] pattern first
	const folderIndex = textUpToCursor.lastIndexOf("@folder");
	const atIndex = textUpToCursor.lastIndexOf("@");

	// Determine if this is a folder mention or note mention
	let isFolder = false;
	let mentionStart = atIndex;

	if (folderIndex !== -1 && folderIndex === atIndex) {
		// This is @folder pattern
		isFolder = true;
		mentionStart = folderIndex;
	}

	logger.log("[DEBUG] @ index found:", atIndex, "folder index:", folderIndex);
	if (atIndex === -1) {
		logger.log("[DEBUG] No @ symbol found");
		return null;
	}

	// Get the token after @ or @folder
	const afterPrefix = isFolder
		? textUpToCursor.slice(folderIndex + 7) // "@folder".length = 7
		: textUpToCursor.slice(atIndex + 1);
	logger.log("[DEBUG] Text after prefix:", afterPrefix);

	// Trigger on @ and allow typing query directly
	let query = "";
	let endPos = cursorPosition;

	// If already in [[...]] format, handle it (allow spaces inside brackets)
	if (afterPrefix.startsWith("[[")) {
		const closingBrackets = afterPrefix.indexOf("]]");
		if (closingBrackets === -1) {
			// Still typing inside brackets
			query = afterPrefix.slice(2); // Remove opening [[
			endPos = cursorPosition;
		} else {
			// Found closing brackets - check if cursor is after them
			const closingBracketsPos =
				mentionStart + (isFolder ? 7 : 1) + closingBrackets + 1; // +1 for second ]
			if (cursorPosition > closingBracketsPos) {
				// Cursor is after ]], no longer a mention
				logger.log(
					"[DEBUG] Cursor is after closing ]], stopping mention detection",
				);
				return null;
			}
			// Complete bracket format
			query = afterPrefix.slice(2, closingBrackets); // Between [[ and ]]
			endPos = closingBracketsPos + 1; // Include closing ]]
		}
	} else {
		// Simple @query or @folderquery format - use everything after prefix
		// But end at whitespace (space, tab, newline) for non-folder mentions
		if (!isFolder) {
			if (
				afterPrefix.includes(" ") ||
				afterPrefix.includes("\t") ||
				afterPrefix.includes("\n")
			) {
				logger.log(
					"[DEBUG] Mention ended by whitespace (simple format)",
				);
				return null;
			}
		}
		query = afterPrefix;
		endPos = cursorPosition;
	}

	const mentionContext = {
		start: mentionStart,
		end: endPos,
		query: query,
		type: isFolder ? ("folder" as const) : ("note" as const),
	};
	logger.log("[DEBUG] Mention context created:", mentionContext);
	return mentionContext;
}

// Replace mention in text with the selected note or folder
export function replaceMention(
	text: string,
	mentionContext: MentionContext,
	itemTitle: string,
): { newText: string; newCursorPos: number } {
	const before = text.slice(0, mentionContext.start);
	const after = text.slice(mentionContext.end);

	// Use @[[filename]] format for notes, @folder[[foldername]] for folders
	const replacement =
		mentionContext.type === "folder"
			? ` @folder[[${itemTitle}]] `
			: ` @[[${itemTitle}]] `;

	const newText = before + replacement + after;
	const newCursorPos = mentionContext.start + replacement.length;

	return { newText, newCursorPos };
}

// Extract all @mentions from text
export function extractMentionedNotes(
	text: string,
	noteMentionService: IMentionService,
): Array<{ noteTitle: string; file: TFile | undefined }> {
	const mentionRegex = /@\[\[([^\]]+)\]\]/g;
	const matches = Array.from(text.matchAll(mentionRegex));
	const result: Array<{ noteTitle: string; file: TFile | undefined }> = [];
	const seen = new Set<string>(); // Avoid duplicates

	for (const match of matches) {
		const noteTitle = match[1];
		if (seen.has(noteTitle)) {
			continue;
		}
		seen.add(noteTitle);

		// Find the file by basename
		const file = noteMentionService
			.getAllFiles()
			.find((f: TFile) => f.basename === noteTitle);

		result.push({ noteTitle, file });
	}

	return result;
}

// Extract all folder mentions from text
export function extractMentionedFolders(
	text: string,
	noteMentionService: IMentionService,
): Array<{ folderName: string; folder: TFolder | undefined }> {
	const folderMentionRegex = /@folder\[\[([^\]]+)\]\]/g;
	const matches = Array.from(text.matchAll(folderMentionRegex));
	const result: Array<{ folderName: string; folder: TFolder | undefined }> =
		[];
	const seen = new Set<string>(); // Avoid duplicates

	for (const match of matches) {
		const folderName = match[1];
		if (seen.has(folderName)) {
			continue;
		}
		seen.add(folderName);

		// Find the folder by name or path
		const folder = noteMentionService
			.getAllFolders()
			.find(
				(f: TFolder) => f.name === folderName || f.path === folderName,
			);

		result.push({ folderName, folder });
	}

	return result;
}
