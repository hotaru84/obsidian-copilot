import { existsSync, readdirSync, statSync, watch, type FSWatcher } from "fs";
import { basename, dirname, normalize, resolve } from "path";

interface WatchState {
	watcher: FSWatcher;
	knownFiles: Set<string>;
}

export interface ExternalFileObserverCallbacks {
	onFileCreated: (watchPath: string, filePath: string) => void;
	onError?: (watchPath: string, error: unknown) => void;
}

/**
 * Watches one or more external directories and emits only direct-child file create events.
 */
export class ExternalFileObserver {
	private readonly callbacks: ExternalFileObserverCallbacks;
	private readonly states = new Map<string, WatchState>();
	private readonly debounceKeys = new Map<string, number>();

	constructor(callbacks: ExternalFileObserverCallbacks) {
		this.callbacks = callbacks;
	}

	start(paths: string[]): void {
		this.stop();
		for (const rawPath of paths) {
			const watchPath = normalizeWatchPath(rawPath);
			if (!watchPath) continue;
			if (!existsSync(watchPath)) continue;
			this.startSinglePath(watchPath);
		}
	}

	stop(): void {
		for (const state of this.states.values()) {
			state.watcher.close();
		}
		this.states.clear();
		this.debounceKeys.clear();
	}

	private startSinglePath(watchPath: string): void {
		try {
			const knownFiles = listDirectFiles(watchPath);
			const watcher = watch(watchPath, (_eventType, fileName) => {
				const base = typeof fileName === "string" ? fileName : "";
				if (!base) return;
				const fullPath = resolve(watchPath, base);
				if (dirname(fullPath) !== watchPath) return;
				const key = `${watchPath}::${base}`;
				if (this.debounceKeys.has(key)) return;
				const timer = window.setTimeout(() => {
					this.debounceKeys.delete(key);
					this.handleChange(watchPath, fullPath);
				}, 120);
				this.debounceKeys.set(key, timer);
			});

			watcher.on("error", (error) => {
				this.callbacks.onError?.(watchPath, error);
			});

			this.states.set(watchPath, { watcher, knownFiles });
		} catch (error) {
			this.callbacks.onError?.(watchPath, error);
		}
	}

	private handleChange(watchPath: string, filePath: string): void {
		const state = this.states.get(watchPath);
		if (!state) return;
		const name = basename(filePath);
		if (!name) return;
		if (state.knownFiles.has(name)) return;
		try {
			const stats = statSync(filePath);
			if (!stats.isFile()) return;
			state.knownFiles.add(name);
			this.callbacks.onFileCreated(watchPath, filePath);
		} catch {
			// File may have been removed immediately. Ignore transient errors.
		}
	}
}

function normalizeWatchPath(rawPath: string): string | null {
	const trimmed = rawPath.trim();
	if (trimmed.length === 0) return null;
	return normalize(resolve(trimmed));
}

function listDirectFiles(path: string): Set<string> {
	const files = new Set<string>();
	for (const entry of readdirSync(path)) {
		const fullPath = resolve(path, entry);
		try {
			const stats = statSync(fullPath);
			if (stats.isFile()) {
				files.add(entry);
			}
		} catch {
			// Ignore files that disappear during scan.
		}
	}
	return files;
}
