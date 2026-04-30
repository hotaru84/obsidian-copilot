import { execSync } from "child_process";
import { Platform } from "obsidian";

/**
 * Cache for the full Windows PATH to avoid repeated registry queries.
 */
let cachedFullPath: string | null = null;

/**
 * Get the full Windows PATH environment variable from the registry.
 *
 * Electron apps launched from shortcuts don't inherit the full user PATH.
 * This function queries both system and user PATH from the registry
 * and combines them to get the complete PATH.
 *
 * @returns The full PATH string, or null if unable to retrieve
 */
export function getFullWindowsPath(): string | null {
	if (!Platform.isWin) {
		return null;
	}

	if (cachedFullPath !== null) {
		return cachedFullPath;
	}

	const paths: string[] = [];

	// Get user PATH from registry
	try {
		const userPath = execSync('reg query "HKCU\\Environment" /v Path', {
			encoding: "utf8",
			windowsHide: true,
		});
		const userPathValue = parseRegQueryOutput(userPath);
		if (userPathValue) {
			paths.push(userPathValue);
		}
	} catch {
		// User path might not be set
	}

	// Get system PATH from registry
	try {
		const systemPath = execSync(
			'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path',
			{ encoding: "utf8", windowsHide: true },
		);
		const systemPathValue = parseRegQueryOutput(systemPath);
		if (systemPathValue) {
			paths.push(systemPathValue);
		}
	} catch {
		// System path is usually available, but we continue to user path if it fails
	}

	if (paths.length === 0) {
		return null;
	}

	cachedFullPath = paths.join(";");
	return cachedFullPath;
}

/**
 * Parse the output of `reg query` command to extract the PATH value.
 */
function parseRegQueryOutput(output: string): string | null {
	// Registry output format:
	// HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
	//     Path    REG_EXPAND_SZ    C:\Windows\system32;C:\Windows;...
	const lines = output.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		// Look for lines containing "Path" and "REG_"
		if (trimmed.toLowerCase().startsWith("path")) {
			// Split by REG_SZ or REG_EXPAND_SZ and take the value part
			const match = trimmed.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
			if (match) {
				return match[1].trim();
			}
		}
	}
	return null;
}

/**
 * Get enhanced environment variables for Windows.
 *
 * This merges the current process.env with the full PATH from registry,
 * ensuring that executables like python, node, etc. can be found.
 *
 * @param baseEnv - The base environment variables to enhance
 * @returns Enhanced environment variables with full PATH
 */
export function getEnhancedWindowsEnv(
	baseEnv: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	if (!Platform.isWin) {
		return baseEnv;
	}

	const fullPath = getFullWindowsPath();
	if (!fullPath) {
		return baseEnv;
	}

	// Merge the full PATH with any existing PATH modifications
	const existingPath = baseEnv.PATH || "";
	const existingPaths = existingPath.split(";").filter((p) => p.length > 0);
	const fullPaths = fullPath.split(";").filter((p) => p.length > 0);

	// Combine: keep existing modifications first, then add paths from registry
	// that aren't already present
	const combinedPaths = [...existingPaths];
	for (const p of fullPaths) {
		if (!combinedPaths.some((ep) => ep.toLowerCase() === p.toLowerCase())) {
			combinedPaths.push(p);
		}
	}

	return {
		...baseEnv,
		PATH: combinedPaths.join(";"),
	};
}

/**
 * Clear the cached PATH (useful for testing or when PATH might have changed).
 */
export function clearWindowsPathCache(): void {
	cachedFullPath = null;
}
