export type RemoteServerMode = "bundled" | "external";

export interface RemoteRuntimeSettings {
	serverMode: RemoteServerMode;
	serverUrl: string;
	bundledServerPort: number;
	autoStartBundledServer: boolean;
	executablePathOverride: string;
	startupTimeoutMs: number;
	requestTimeoutMs: number;
}
