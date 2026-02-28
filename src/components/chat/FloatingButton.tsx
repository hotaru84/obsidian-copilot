import * as React from "react";
const { useState, useRef, useEffect, useCallback, useMemo } = React;
import { createRoot, type Root } from "react-dom/client";

import { setIcon } from "obsidian";
import type AgentClientPlugin from "../../plugin";
import { useSettings } from "../../hooks/useSettings";

// Fixed button size constant
export const FLOATING_BUTTON_SIZE = 48;

interface VaultAdapterWithResourcePath {
	getResourcePath?: (path: string) => string;
}

// ============================================================
// FloatingButtonContainer Class
// ============================================================

/**
 * Container that manages the floating button React component lifecycle.
 * Independent from any floating chat view instance.
 */
export class FloatingButtonContainer {
	private root: Root | null = null;
	private containerEl: HTMLElement;

	constructor(private plugin: AgentClientPlugin) {
		this.containerEl = document.body.createDiv({
			cls: "agent-client-floating-button-root",
		});
	}

	mount(): void {
		this.root = createRoot(this.containerEl);
		this.root.render(<FloatingButtonComponent plugin={this.plugin} />);
	}

	unmount(): void {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		this.containerEl.remove();
	}
}

// ============================================================
// FloatingButtonComponent
// ============================================================

interface FloatingButtonProps {
	plugin: AgentClientPlugin;
}

function FloatingButtonComponent({ plugin }: FloatingButtonProps) {
	const settings = useSettings(plugin);

	const [showInstanceMenu, setShowInstanceMenu] = useState(false);
	const instanceMenuRef = useRef<HTMLDivElement>(null);

	// Button / menu size constants
	const MENU_MIN_WIDTH = 220;

	// Dragging state
	const [relativePosRef, setRelativePosRef] = useState<{ right: number; bottom: number } | null>(
		() => {
			if (!settings.floatingButtonPosition) return null;
			return {
				right: settings.floatingButtonPosition.right,
				bottom: settings.floatingButtonPosition.bottom,
			};
		},
	);
	const [isDragging, setIsDragging] = useState(false);
	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});
	const dragOffset = useRef({ x: 0, y: 0 });
	const dragStartPos = useRef({ x: 0, y: 0 });
	const wasDragged = useRef(false);

	// Floating button image source
	const floatingButtonImageSrc = useMemo(() => {
		const img = settings.floatingButtonImage;
		if (!img) return null;
		if (
			img.startsWith("http://") ||
			img.startsWith("https://") ||
			img.startsWith("data:")
		) {
			return img;
		}
		return (
			plugin.app.vault.adapter as VaultAdapterWithResourcePath
		).getResourcePath?.(img);
	}, [settings.floatingButtonImage, plugin.app.vault.adapter]);

	// Build display labels with duplicate numbering
	const allInstances = plugin.getFloatingChatInstances();

	const instanceLabels = useMemo(() => {
		const views = plugin.viewRegistry.getByType("floating");
		const entries = views.map((v) => ({
			viewId: v.viewId,
			label: v.getDisplayName(),
		}));
		const countMap = new Map<string, number>();
		for (const e of entries) {
			countMap.set(e.label, (countMap.get(e.label) ?? 0) + 1);
		}
		const indexMap = new Map<string, number>();
		return entries.map((e) => {
			if ((countMap.get(e.label) ?? 0) > 1) {
				const idx = (indexMap.get(e.label) ?? 0) + 1;
				indexMap.set(e.label, idx);
				return {
					viewId: e.viewId,
					label: idx === 1 ? e.label : `${e.label} ${idx}`,
				};
			}
			return e;
		});
	}, [plugin.viewRegistry, allInstances]);

	// Calculate absolute button position from relative position
	const absoluteButtonPos = useMemo(() => {
		const right = relativePosRef?.right ?? 40;
		const bottom = relativePosRef?.bottom ?? 30;
		return {
			x: windowSize.width - right - FLOATING_BUTTON_SIZE,
			y: windowSize.height - bottom - FLOATING_BUTTON_SIZE,
			right,
			bottom,
		};
	}, [relativePosRef, windowSize.width, windowSize.height]);

	// ============================================================
	// Dragging Logic
	// ============================================================
	const DRAG_THRESHOLD = 5;

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			setIsDragging(true);
			wasDragged.current = false;
			dragStartPos.current = { x: e.clientX, y: e.clientY };
			dragOffset.current = {
				x: e.clientX - absoluteButtonPos.x,
				y: e.clientY - absoluteButtonPos.y,
			};
			e.preventDefault();
		},
		[absoluteButtonPos],
	);

	useEffect(() => {
		if (!isDragging) return;

		const onMouseMove = (e: MouseEvent) => {
			const dx = e.clientX - dragStartPos.current.x;
			const dy = e.clientY - dragStartPos.current.y;
			if (
				!wasDragged.current &&
				Math.abs(dx) < DRAG_THRESHOLD &&
				Math.abs(dy) < DRAG_THRESHOLD
			) {
				return;
			}
			wasDragged.current = true;

			const newX = e.clientX - dragOffset.current.x;
			const newY = e.clientY - dragOffset.current.y;

			// Clamp to viewport
			const clampedX = Math.max(0, Math.min(newX, window.innerWidth - FLOATING_BUTTON_SIZE));
			const clampedY = Math.max(0, Math.min(newY, window.innerHeight - FLOATING_BUTTON_SIZE));

			// Convert back to relative position (right, bottom)
			const newRight = Math.max(0, window.innerWidth - clampedX - FLOATING_BUTTON_SIZE);
			const newBottom = Math.max(0, window.innerHeight - clampedY - FLOATING_BUTTON_SIZE);

			setRelativePosRef({ right: newRight, bottom: newBottom });

			// Emit custom event to notify chat views
			window.dispatchEvent(
				new CustomEvent("agent-client:floating-button-moved", {
					detail: {
						absoluteX: clampedX,
						absoluteY: clampedY,
						relativeRight: newRight,
						relativeBottom: newBottom,
					},
				}),
			);
		};

		const onMouseUp = () => {
			setIsDragging(false);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [isDragging]);

	// Save relative position to settings (debounced)
	useEffect(() => {
		if (!relativePosRef) return;
		const timer = setTimeout(() => {
			if (
				!settings.floatingButtonPosition ||
				relativePosRef.right !== settings.floatingButtonPosition.right ||
				relativePosRef.bottom !== settings.floatingButtonPosition.bottom
			) {
				void plugin.saveSettingsAndNotify({
					...plugin.settings,
					floatingButtonPosition: relativePosRef,
				});
			}
		}, 500);
		return () => clearTimeout(timer);
	}, [relativePosRef, plugin, settings.floatingButtonPosition]);

	// Update button position when window resizes (to maintain relative position)
	useEffect(() => {
		const handleWindowResize = () => {
			// Update window size state for position recalculation
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
			// Position is automatically recalculated via useMemo
			// Emit event to notify chat views of new button position
			if (relativePosRef) {
				const absX = window.innerWidth - relativePosRef.right - FLOATING_BUTTON_SIZE;
				const absY = window.innerHeight - relativePosRef.bottom - FLOATING_BUTTON_SIZE;
				window.dispatchEvent(
					new CustomEvent("agent-client:floating-button-moved", {
						detail: {
							absoluteX: absX,
							absoluteY: absY,
							relativeRight: relativePosRef.right,
							relativeBottom: relativePosRef.bottom,
						},
					}),
				);
			}
		};
		window.addEventListener("resize", handleWindowResize);
		return () => {
			window.removeEventListener("resize", handleWindowResize);
		};
	}, [relativePosRef]);

	// ============================================================
	// Button Click Logic

	// Button click handler
	const handleButtonClick = useCallback(() => {
		const instances = plugin.getFloatingChatInstances();
		if (instances.length === 0) {
			// No instances, create one and expand
			plugin.openNewFloatingChat(true);
		} else if (instances.length === 1) {
			// Single instance, toggle expand/collapse
			plugin.toggleFloatingChat(instances[0]);
		} else {
			// Multiple instances, show menu
			setShowInstanceMenu(true);
		}
	}, [plugin]);

	// Close instance menu on outside click
	useEffect(() => {
		if (!showInstanceMenu) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (
				instanceMenuRef.current &&
				!instanceMenuRef.current.contains(event.target as Node)
			) {
				setShowInstanceMenu(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showInstanceMenu]);

	if (!settings.showFloatingButton) return null;

	const buttonClassName = [
		"agent-client-floating-button",
		floatingButtonImageSrc ? "has-custom-image" : "",
		isDragging ? "is-dragging" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<div
				className={buttonClassName}
				onMouseDown={handleMouseDown}
				onMouseUp={() => {
					if (!wasDragged.current) {
						handleButtonClick();
					}
				}}
				style={{
					left: absoluteButtonPos.x,
					top: absoluteButtonPos.y,
					right: "auto",
					bottom: "auto",
				}}
			>
				{floatingButtonImageSrc ? (
					<img src={floatingButtonImageSrc} alt="Open chat" />
				) : (
					<div
						className="agent-client-floating-button-fallback"
						ref={(el) => {
							if (el) setIcon(el, "bot-message-square");
						}}
					/>
				)}
			</div>
			{showInstanceMenu && (
				<div
					ref={instanceMenuRef}
					className="agent-client-floating-instance-menu"
					style={{
						bottom: window.innerHeight - absoluteButtonPos.y + 10,
						...(absoluteButtonPos.x + MENU_MIN_WIDTH > window.innerWidth
							? {
									right:
										window.innerWidth -
										(absoluteButtonPos.x + FLOATING_BUTTON_SIZE),
										left: "auto",
										top: "auto",
								  }
							: {
									left: absoluteButtonPos.x,
									right: "auto",
									top: "auto",
							  }),
					}}
				>
					<div className="agent-client-floating-instance-menu-header">
						Select session to open
					</div>
					{instanceLabels.map(({ viewId: id, label }) => (
						<div
							key={id}
							className="agent-client-floating-instance-menu-item"
							onClick={() => {
								plugin.expandFloatingChat(id);
								plugin.viewRegistry.setFocused(id);
								setShowInstanceMenu(false);
							}}
						>
							<span className="agent-client-floating-instance-menu-label">
								{label}
							</span>
							{instanceLabels.length > 1 && (
								<button
									className="agent-client-floating-instance-menu-close"
									onClick={(e) => {
										e.stopPropagation();
										plugin.closeFloatingChat(id);
										if (instanceLabels.length <= 2) {
											setShowInstanceMenu(false);
										}
									}}
									title="Close session"
								>
									×
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</>
	);
}
