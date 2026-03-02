import { useState, useCallback } from "react";
import type {
	NoteMetadata,
	FolderMetadata,
	IVaultAccess,
} from "../domain/ports/vault-access.port";
import {
	detectMention,
	replaceMention,
	type MentionContext,
} from "../shared/mention-utils";
import type AgentClientPlugin from "../plugin";

export type MentionSuggestion = NoteMetadata | FolderMetadata;

export interface UseMentionsReturn {
	/** Note/Folder suggestions matching the current mention query */
	suggestions: MentionSuggestion[];
	/** Currently selected index in the dropdown */
	selectedIndex: number;
	/** Whether the dropdown is open */
	isOpen: boolean;
	/** Current mention context (query, position, etc.) */
	context: MentionContext | null;

	/**
	 * Update mention suggestions based on current input.
	 * Detects @-mentions and searches for matching notes or folders.
	 */
	updateSuggestions: (input: string, cursorPosition: number) => Promise<void>;

	/**
	 * Select a note or folder from the dropdown.
	 * @returns Updated input text with mention replaced (e.g., "@[[note name]]" or "@folder[[folder name]]")
	 */
	selectSuggestion: (input: string, suggestion: MentionSuggestion) => string;

	/** Navigate the dropdown selection */
	navigate: (direction: "up" | "down") => void;

	/** Close the dropdown */
	close: () => void;
}

/**
 * Hook for managing mention dropdown state and logic.
 *
 * Handles @-mention detection, note/folder searching, and dropdown interaction.
 * Uses detectMention/replaceMention utilities for parsing.
 *
 * @param vaultAccess - Vault access port for note/folder searching
 * @param plugin - Plugin instance for settings and configuration
 */
export function useMentions(
	vaultAccess: IVaultAccess,
	plugin: AgentClientPlugin,
): UseMentionsReturn {
	const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [context, setContext] = useState<MentionContext | null>(null);

	const isOpen = suggestions.length > 0 && context !== null;

	const updateSuggestions = useCallback(
		async (input: string, cursorPosition: number) => {
			const ctx = detectMention(input, cursorPosition);

			if (!ctx) {
				setSuggestions([]);
				setSelectedIndex(0);
				setContext(null);

				return;
			}

			// Search based on mention type
			const results =
				ctx.type === "folder"
					? await vaultAccess.searchFolders(ctx.query)
					: await vaultAccess.searchNotes(ctx.query);
			setSuggestions(results);
			setSelectedIndex(0);
			setContext(ctx);
		},
		[vaultAccess, plugin],
	);

	const selectSuggestion = useCallback(
		(input: string, suggestion: MentionSuggestion): string => {
			if (!context) {
				return input;
			}

			const itemName =
				"name" in suggestion && "extension" in suggestion
					? suggestion.name // NoteMetadata has basename as name
					: suggestion.name; // FolderMetadata also has name

			const { newText } = replaceMention(input, context, itemName);

			setSuggestions([]);
			setSelectedIndex(0);
			setContext(null);

			return newText;
		},
		[context],
	);

	const navigate = useCallback(
		(direction: "up" | "down") => {
			if (!isOpen) return;

			const maxIndex = suggestions.length - 1;
			setSelectedIndex((prev) => {
				if (direction === "down") {
					return Math.min(prev + 1, maxIndex);
				} else {
					return Math.max(prev - 1, 0);
				}
			});
		},
		[isOpen, suggestions.length],
	);

	const close = useCallback(() => {
		setSuggestions([]);
		setSelectedIndex(0);
		setContext(null);
	}, []);

	return {
		suggestions,
		selectedIndex,
		isOpen,
		context,
		updateSuggestions,
		selectSuggestion,
		navigate,
		close,
	};
}
