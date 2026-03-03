import { useState, useCallback, useMemo } from "react";
import type { SlashCommand } from "../domain/models/chat-session";

export interface UseSlashCommandsReturn {
	/** Filtered slash command suggestions */
	suggestions: SlashCommand[];
	/** Currently selected index in the dropdown */
	selectedIndex: number;
	/** Whether the dropdown is open */
	isOpen: boolean;

	/**
	 * Update slash command suggestions based on current input.
	 * Slash commands only trigger when input starts with '/'.
	 */
	updateSuggestions: (input: string, cursorPosition: number) => void;

	/**
	 * Select a slash command from the dropdown.
	 * @returns Updated input text with command (e.g., "/web ")
	 */
	selectSuggestion: (input: string, command: SlashCommand) => string;

	/** Navigate the dropdown selection */
	navigate: (direction: "up" | "down") => void;

	/** Close the dropdown */
	close: () => void;
}

/**
 * Hook for managing slash command dropdown state and logic.
 *
 * @param availableCommands - Available slash commands from the agent session
 * @param localCommands - Local slash commands from .github folder
 * @param onAutoMentionToggle - Callback to enable/disable auto-mention
 *        (slash commands require auto-mention to be disabled so "/" stays at the start)
 */
export function useSlashCommands(
	availableCommands: SlashCommand[],
	localCommands: SlashCommand[],
	onAutoMentionToggle?: (disabled: boolean) => void,
): UseSlashCommandsReturn {
	const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);

	const isOpen = suggestions.length > 0;

	// Merge agent and local commands, with local commands taking precedence
	const allCommands = useMemo(() => {
		const commandMap = new Map<string, SlashCommand>();

		// Add agent commands first
		for (const cmd of availableCommands) {
			commandMap.set(cmd.name, { ...cmd, source: "agent" as const });
		}

		// Add local commands (overwrites agent commands with same name)
		for (const cmd of localCommands) {
			commandMap.set(cmd.name, cmd);
		}

		// Convert to array and sort: local commands first, then alphabetically
		return Array.from(commandMap.values()).sort((a, b) => {
			// Local commands first
			if (a.source === "local" && b.source !== "local") return -1;
			if (a.source !== "local" && b.source === "local") return 1;
			// Then alphabetically
			return a.name.localeCompare(b.name);
		});
	}, [availableCommands, localCommands]);

	const updateSuggestions = useCallback(
		(input: string, cursorPosition: number) => {
			const wasOpen = suggestions.length > 0;

			// Slash commands only trigger at the very beginning of input
			if (!input.startsWith("/")) {
				// Re-enable auto-mention only if dropdown was showing
				// (meaning it was disabled by slash command detection)
				if (wasOpen) {
					onAutoMentionToggle?.(false);
				}
				setSuggestions([]);
				setSelectedIndex(0);
				return;
			}

			// Extract query after '/'
			const textUpToCursor = input.slice(0, cursorPosition);
			const afterSlash = textUpToCursor.slice(1); // Remove leading '/'

			// If there's a space, the command is complete and user is typing arguments
			// Close dropdown but keep auto-mention disabled
			if (afterSlash.includes(" ")) {
				setSuggestions([]);
				setSelectedIndex(0);
				// Keep auto-mention disabled (slash command is still active)
				onAutoMentionToggle?.(true);
				return;
			}

			const query = afterSlash.toLowerCase();

			// Filter all commands (both agent and local)
			const filtered = allCommands.filter((cmd) =>
				cmd.name.toLowerCase().includes(query),
			);

			setSuggestions(filtered);
			setSelectedIndex(0);
			// Disable auto-mention when slash command is detected
			// (ACP requires slash commands to be at the very beginning)
			onAutoMentionToggle?.(true);
		},
		[allCommands, onAutoMentionToggle, suggestions.length],
	);

	const selectSuggestion = useCallback(
		(_input: string, command: SlashCommand): string => {
			// Return only the command text (hint will be shown as overlay in UI)
			const commandText = `/${command.name} `;

			// Close dropdown
			setSuggestions([]);
			setSelectedIndex(0);

			return commandText;
		},
		[],
	);

	const navigate = useCallback(
		(direction: "up" | "down") => {
			if (suggestions.length === 0) {
				return;
			}

			const maxIndex = suggestions.length - 1;

			setSelectedIndex((current) => {
				if (direction === "down") {
					return Math.min(current + 1, maxIndex);
				} else {
					return Math.max(current - 1, 0);
				}
			});
		},
		[suggestions.length],
	);

	const close = useCallback(() => {
		setSuggestions([]);
		setSelectedIndex(0);
	}, []);

	return {
		suggestions,
		selectedIndex,
		isOpen,
		updateSuggestions,
		selectSuggestion,
		navigate,
		close,
	};
}
