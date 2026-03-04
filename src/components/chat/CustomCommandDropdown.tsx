import * as React from "react";
const { useRef, useEffect, useCallback } = React;
import { createPortal } from "react-dom";
import { getLogger } from "../../shared/logger";
import type AgentClientPlugin from "../../plugin";
import type { IChatViewHost } from "./types";
import type { CustomCommandOption } from "../../domain/models/custom-command-option";

/**
 * Props for CustomCommandDropdown component.
 */
interface CustomCommandDropdownProps {
	/** Custom command options to display */
	options: CustomCommandOption[];

	/** Currently selected option index */
	selectedIndex: number;

	/** Callback when an option is selected */
	onSelect: (option: CustomCommandOption) => void;

	/** Callback to close the dropdown */
	onClose: () => void;

	/** Callback to navigate selection up/down */
	onNavigate?: (direction: "up" | "down") => void;

	/** Plugin instance for logging */
	plugin: AgentClientPlugin;

	/** View instance for event registration */
	view: IChatViewHost;

	/** CSS styles for positioning */
	style?: React.CSSProperties;
}

/**
 * Dropdown component for displaying custom commands from .github folder.
 *
 * Shows agent/prompt candidates with:
 * - Name and type badge (Agent/Prompt)
 * - Description from YAML frontmatter
 * - Optional hint for additional usage info
 *
 * Supports keyboard navigation and mouse selection.
 */
export function CustomCommandDropdown({
	options,
	selectedIndex,
	onSelect,
	onClose,
	onNavigate,
	plugin,
	view,
	style,
}: CustomCommandDropdownProps) {
	const dropdownRef = useRef<HTMLDivElement>(null);
	const logger = getLogger();

	logger.log("[DEBUG] CustomCommandDropdown rendering with:", {
		optionsCount: options.length,
		selectedIndex,
	});

	// Handle mouse clicks outside dropdown to close
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		view.registerDomEvent(document, "mousedown", handleClickOutside);
	}, [onClose, view]);

	// Scroll selected item into view
	useEffect(() => {
		if (!dropdownRef.current) return;
		const selectedElement = dropdownRef.current.children[selectedIndex] as
			| HTMLElement
			| undefined;
		selectedElement?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				onNavigate?.("down");
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				onNavigate?.("up");
			} else if (e.key === "Enter") {
				e.preventDefault();
				const selected = options[selectedIndex];
				if (selected) {
					onSelect(selected);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[options, selectedIndex, onSelect, onNavigate, onClose],
	);

	if (options.length === 0) {
		return null;
	}

	return createPortal(
		<div
			ref={dropdownRef}
			className="agent-client-custom-command-dropdown"
			role="listbox"
			onKeyDown={handleKeyDown}
			tabIndex={0}
			style={style}
		>
			{options.map((option, index) => {
				const isSelected = index === selectedIndex;
				const hasBorder = index < options.length - 1;
				const typeBadge = option.type === "agent" ? "Agent" : "Prompt";

				return (
					<div
						key={option.id}
						className={`agent-client-custom-command-item ${isSelected ? "agent-client-selected" : ""} ${hasBorder ? "agent-client-has-border" : ""}`}
						onClick={() => onSelect(option)}
						onMouseEnter={() => {
							// Could update selected index on hover
						}}
						role="option"
						aria-selected={isSelected}
					>
						<div className="agent-client-custom-command-item-header">
							<span className="agent-client-custom-command-item-label">
								{option.label}
							</span>
							<span
								className={`agent-client-custom-command-item-badge agent-client-badge-${option.type}`}
							>
								{typeBadge}
							</span>
						</div>
						<div className="agent-client-custom-command-item-description">
							{option.description}
						</div>
						{option.hint && (
							<div className="agent-client-custom-command-item-hint">
								{option.hint}
							</div>
						)}
					</div>
				);
			})}
		</div>,
		document.body,
	);
}
