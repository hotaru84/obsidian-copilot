import * as path from "path";
import type AgentClientPlugin from "../plugin";
import { getVaultBasePath } from "./path-utils";

export const DEFAULT_REMOTE_SERVER_PORT = 39453;

export const REMOTE_SDK_VENDOR_ROOT = path.join(
	"vendor",
	"copilot-runtime-sdk",
);

export const REMOTE_SDK_CLIENT_ROOT = path.join(
	REMOTE_SDK_VENDOR_ROOT,
	"sdk-client",
	"dist",
	"src",
);

export const REMOTE_SDK_BIN_ROOT = path.join(
	REMOTE_SDK_VENDOR_ROOT,
	"server-go",
);

export const REMOTE_SDK_METADATA_PATH = path.join(
	REMOTE_SDK_VENDOR_ROOT,
	"manifest.json",
);

function resolvePluginInstallRoot(plugin: AgentClientPlugin): string | null {
	const basePath = getVaultBasePath(plugin.app.vault.adapter);
	if (!basePath) {
		return null;
	}

	return path.join(
		basePath,
		plugin.app.vault.configDir,
		"plugins",
		plugin.manifest.id,
	);
}

function getBundledBinaryName(platform: NodeJS.Platform): string {
	return platform === "win32" ? "copilot-server-go.exe" : "copilot-server-go";
}

export function buildBundledRemoteServerUrl(port: number): string {
	return `ws://127.0.0.1:${port}`;
}

export function resolveBundledRemoteServerPath(
	plugin: AgentClientPlugin,
	platform: NodeJS.Platform = process.platform,
): string | null {
	const pluginRoot = resolvePluginInstallRoot(plugin);
	if (!pluginRoot) {
		return null;
	}

	return path.join(pluginRoot, "server-go", getBundledBinaryName(platform));
}

export function resolveVendoredMetadataPath(
	plugin: AgentClientPlugin,
): string | null {
	const pluginRoot = resolvePluginInstallRoot(plugin);
	if (!pluginRoot) {
		return null;
	}

	return path.join(pluginRoot, REMOTE_SDK_METADATA_PATH);
}
