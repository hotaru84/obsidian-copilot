import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const remoteRepoRoot = process.env.COPILOT_REMOTE_SDK_ROOT
	? path.resolve(process.env.COPILOT_REMOTE_SDK_ROOT)
	: path.resolve(repoRoot, "..", "copilot-remote-sdk");

const releaseRoot = path.join(remoteRepoRoot, "release");
const releaseManifestPath = path.join(releaseRoot, "manifest.json");
const releaseClientRoot = path.join(releaseRoot, "sdk-client");
const releaseClientDistRoot = path.join(releaseClientRoot, "dist", "src");
const releaseClientPackageJsonPath = path.join(
	releaseClientRoot,
	"package.json",
);
const releaseServerRoot = path.join(releaseRoot, "server-go");

const vendorRoot = path.join(repoRoot, "vendor", "copilot-runtime-sdk");

const currentPlatformArtifact = {
	platform: `${process.platform}-${process.arch}`,
	fileName:
		process.platform === "win32"
			? "copilot-server-go.exe"
			: "copilot-server-go",
};

function ensureDirectory(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

function assertExists(targetPath, message) {
	if (!fs.existsSync(targetPath)) {
		throw new Error(message);
	}
}

function cleanDirectory(dirPath) {
	if (fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
	}
	fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirectoryContents(sourceDir, destinationDir) {
	ensureDirectory(destinationDir);
	for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
		const sourcePath = path.join(sourceDir, entry.name);
		const destinationPath = path.join(destinationDir, entry.name);
		if (entry.isDirectory()) {
			copyDirectoryContents(sourcePath, destinationPath);
		} else if (entry.isFile()) {
			ensureDirectory(path.dirname(destinationPath));
			fs.copyFileSync(sourcePath, destinationPath);
		}
	}
}

function copyFileIfExists(sourcePath, destinationPath) {
	if (!fs.existsSync(sourcePath)) {
		return false;
	}

	ensureDirectory(path.dirname(destinationPath));
	fs.copyFileSync(sourcePath, destinationPath);
	return true;
}

assertExists(
	releaseRoot,
	`remote-sdk release not found at ${releaseRoot}. Generate release artifacts in the remote-sdk repository first.`,
);
assertExists(
	releaseManifestPath,
	`remote-sdk release manifest not found at ${releaseManifestPath}.`,
);
assertExists(
	releaseClientDistRoot,
	`remote-sdk client dist not found at ${releaseClientDistRoot}.`,
);
assertExists(
	releaseClientPackageJsonPath,
	`remote-sdk client package.json not found at ${releaseClientPackageJsonPath}.`,
);

const releaseManifest = JSON.parse(
	fs.readFileSync(releaseManifestPath, "utf8"),
);
const clientPackageJson = JSON.parse(
	fs.readFileSync(releaseClientPackageJsonPath, "utf8"),
);

cleanDirectory(vendorRoot);
copyDirectoryContents(releaseRoot, vendorRoot);

const sourcePath = path.join(
	releaseServerRoot,
	currentPlatformArtifact.fileName,
);
const copiedServerForCurrentPlatform = copyFileIfExists(
	sourcePath,
	path.join(vendorRoot, "server-go", currentPlatformArtifact.fileName),
);

console.log(`Synced remote-sdk artifacts from ${remoteRepoRoot}`);
console.log(`- release mirror -> ${vendorRoot}`);
console.log(`- manifest -> ${path.join(vendorRoot, "manifest.json")}`);
console.log(
	`- client package -> ${path.join(vendorRoot, "sdk-client", "package.json")} (${clientPackageJson.name}@${clientPackageJson.version})`,
);

if (!copiedServerForCurrentPlatform) {
	console.log(
		"- server -> current platform binary not present in release; override executable path if needed",
	);
} else {
	console.log(
		`- server -> ${path.join(vendorRoot, "server-go", currentPlatformArtifact.fileName)}`,
	);
}
console.log(
	`- release artifacts listed -> ${releaseManifest.artifacts?.length ?? 0} entry(ies)`,
);
