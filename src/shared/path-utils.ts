/**
 * Extract the directory containing a command (for PATH adjustments).
 * Example: /usr/local/bin/node → /usr/local/bin
 *
 * @param command - Full path to a command
 * @returns Directory path, or null if cannot be determined
 */
export function resolveCommandDirectory(command: string): string | null {
	if (!command) {
		return null;
	}
	const lastSlash = Math.max(
		command.lastIndexOf("/"),
		command.lastIndexOf("\\"),
	);
	if (lastSlash <= 0) {
		return null;
	}
	return command.slice(0, lastSlash);
}

interface VaultAdapterWithBasePath {
	getBasePath?: () => string;
	basePath?: string;
	getFullPath?: (normalizedPath: string) => string;
}

function normalizeNonEmptyPath(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.replace(/[\\/]+$/, "") : null;
}

/**
 * Resolve the on-disk vault base path from an Obsidian vault adapter.
 * Uses duck typing because plugin runtime adapters do not always satisfy
 * instanceof FileSystemAdapter checks in bundled environments.
 *
 * @param adapter - Obsidian vault adapter instance
 * @returns Absolute vault path, or null if unavailable
 */
export function getVaultBasePath(adapter: unknown): string | null {
	if (!adapter || typeof adapter !== "object") {
		return null;
	}

	const candidate = adapter as VaultAdapterWithBasePath;

	if (typeof candidate.getBasePath === "function") {
		const basePath = normalizeNonEmptyPath(candidate.getBasePath());
		if (basePath) {
			return basePath;
		}
	}

	const basePathField = normalizeNonEmptyPath(candidate.basePath);
	if (basePathField) {
		return basePathField;
	}

	if (typeof candidate.getFullPath === "function") {
		const fullPath = normalizeNonEmptyPath(candidate.getFullPath(""));
		if (fullPath) {
			return fullPath;
		}
	}

	return null;
}

/**
 * Convert absolute path to relative path if it's under basePath.
 * Otherwise return the absolute path as-is.
 *
 * @param absolutePath - The absolute path to convert
 * @param basePath - The base path (e.g., vault path)
 * @returns Relative path if under basePath, otherwise absolute path
 */
export function toRelativePath(absolutePath: string, basePath: string): string {
	// Normalize paths (remove trailing slashes)
	const normalizedBase = basePath.replace(/\/+$/, "");
	const normalizedPath = absolutePath.replace(/\/+$/, "");

	if (normalizedPath.startsWith(normalizedBase + "/")) {
		return normalizedPath.slice(normalizedBase.length + 1);
	}
	return absolutePath;
}

/**
 * Build a file URI from an absolute path.
 * Handles both Windows and Unix paths.
 *
 * @param absolutePath - Absolute file path
 * @returns file:// URI
 *
 * @example
 * buildFileUri("/Users/user/note.md") // "file:///Users/user/note.md"
 * buildFileUri("C:\\Users\\user\\note.md") // "file:///C:/Users/user/note.md"
 */
export function buildFileUri(absolutePath: string): string {
	// Normalize backslashes to forward slashes
	const normalizedPath = absolutePath.replace(/\\/g, "/");

	// Windows path (e.g., C:/Users/...)
	if (/^[A-Za-z]:/.test(normalizedPath)) {
		return `file:///${normalizedPath}`;
	}

	// Unix path (e.g., /Users/...)
	return `file://${normalizedPath}`;
}
