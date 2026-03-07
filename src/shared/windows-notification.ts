import { Platform } from "obsidian";
import type { Logger } from "./logger";

export type ChatNotificationMode = "disabled" | "always" | "background-only";
export type ChatNotificationEventType =
	| "response-complete"
	| "permission-request";

interface NotificationPayload {
	title: string;
	body: string;
}

interface NotifyWindowsChatEventArgs {
	mode: ChatNotificationMode;
	eventType: ChatNotificationEventType;
	conversationTitle: string;
	logger?: Logger;
}

const EVENT_LABELS: Record<ChatNotificationEventType, string> = {
	"response-complete": "応答完了",
	"permission-request": "権限承認",
};

function normalizeTitle(value: string): string {
	const firstLine = value.split("\n")[0]?.trim();
	return firstLine || "Copilot chat";
}

function getIsWindowFocused(): boolean {
	if (typeof document === "undefined") {
		return true;
	}
	return document.hasFocus();
}

interface ElectronWindowLike {
	show?: () => void;
	restore?: () => void;
	focus?: () => void;
	isMinimized?: () => boolean;
}

interface WindowWithRequire extends Window {
	require?: (moduleName: string) => unknown;
}

function tryElectronFocus(logger?: Logger): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	const electronWindow = window as WindowWithRequire;
	if (typeof electronWindow.require !== "function") {
		return false;
	}

	const focusWithWindow = (targetWindow: ElectronWindowLike | undefined) => {
		if (!targetWindow) {
			return false;
		}
		if (targetWindow.isMinimized?.()) {
			targetWindow.restore?.();
		}
		targetWindow.show?.();
		targetWindow.focus?.();
		return true;
	};

	try {
		const electronModule = electronWindow.require("electron") as {
			remote?: {
				getCurrentWindow?: () => ElectronWindowLike;
			};
		};
		if (focusWithWindow(electronModule.remote?.getCurrentWindow?.())) {
			return true;
		}
	} catch (error) {
		logger?.log(
			"[windows-notification] electron.remote focus path unavailable",
			error,
		);
	}

	try {
		const remoteModule = electronWindow.require("@electron/remote") as {
			getCurrentWindow?: () => ElectronWindowLike;
		};
		if (focusWithWindow(remoteModule.getCurrentWindow?.())) {
			return true;
		}
	} catch (error) {
		logger?.log(
			"[windows-notification] @electron/remote focus path unavailable",
			error,
		);
	}

	return false;
}

function tryObsidianUriFocus(logger?: Logger): void {
	if (typeof window === "undefined" || typeof window.open !== "function") {
		return;
	}

	try {
		// Ask the OS protocol handler to activate the Obsidian app window.
		window.open("obsidian://open");
	} catch (error) {
		logger?.log(
			"[windows-notification] obsidian://open focus fallback failed",
			error,
		);
	}
}

function bringObsidianToForeground(logger?: Logger): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		if (tryElectronFocus(logger)) {
			return;
		}

		window.focus();
		window.top?.focus?.();
		window.parent?.focus?.();

		if (!document.hasFocus()) {
			tryObsidianUriFocus(logger);
		}
	} catch (error) {
		logger?.warn(
			"[windows-notification] Failed to focus Obsidian window",
			error,
		);
		tryObsidianUriFocus(logger);
	}
}

function showNotificationWithFocus(
	payload: NotificationPayload,
	logger?: Logger,
): void {
	const notification = new Notification(payload.title, {
		body: payload.body,
	});

	notification.onclick = (event) => {
		event.preventDefault();
		bringObsidianToForeground(logger);
		notification.close();
	};
}

export function shouldSendWindowsChatNotification(
	mode: ChatNotificationMode,
	isWindowFocused: boolean,
): boolean {
	if (mode === "disabled") {
		return false;
	}
	if (mode === "always") {
		return true;
	}
	return !isWindowFocused;
}

export function buildChatNotificationPayload(
	eventType: ChatNotificationEventType,
	conversationTitle: string,
): NotificationPayload {
	const eventLabel = EVENT_LABELS[eventType];
	const normalizedTitle = normalizeTitle(conversationTitle);
	return {
		title: `Copilot (${eventLabel})`,
		body: `${normalizedTitle}\n ${eventLabel}`,
	};
}

export function notifyWindowsChatEvent(args: NotifyWindowsChatEventArgs): void {
	if (!Platform.isDesktopApp || !Platform.isWin) {
		return;
	}

	if (!shouldSendWindowsChatNotification(args.mode, getIsWindowFocused())) {
		return;
	}

	if (typeof Notification === "undefined") {
		args.logger?.log(
			"[windows-notification] Notification API is unavailable",
		);
		return;
	}

	if (Notification.permission === "denied") {
		args.logger?.log(
			"[windows-notification] Notification permission is denied",
		);
		return;
	}

	if (Notification.permission === "default") {
		if (typeof Notification.requestPermission === "function") {
			void Notification.requestPermission()
				.then((permission) => {
					if (permission !== "granted") {
						args.logger?.log(
							"[windows-notification] Notification permission was not granted",
						);
						return;
					}

					const payload = buildChatNotificationPayload(
						args.eventType,
						args.conversationTitle,
					);

					try {
						showNotificationWithFocus(payload, args.logger);
					} catch (error) {
						args.logger?.warn(
							"[windows-notification] Failed to show notification",
							error,
						);
					}
				})
				.catch((error) => {
					args.logger?.warn(
						"[windows-notification] Failed to request notification permission",
						error,
					);
				});
		}
		return;
	}

	const payload = buildChatNotificationPayload(
		args.eventType,
		args.conversationTitle,
	);

	try {
		showNotificationWithFocus(payload, args.logger);
	} catch (error) {
		args.logger?.warn(
			"[windows-notification] Failed to show notification",
			error,
		);
	}
}
