import { TFile, TAbstractFile, TFolder, FileSystemAdapter } from "obsidian";
import { join, basename } from "path";
import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import type AgentClientPlugin from "../../plugin";
import type { SlashCommand } from "../../domain/models/chat-session";
import { getLogger, Logger } from "../../shared/logger";

/**
 * Service for discovering and managing slash commands from .github folder.
 *
 * Scans `.github/agents/*.md` and `.github/prompts/*.md` files in the vault
 * and converts them to SlashCommand objects based on their frontmatter metadata.
 *
 * Expected frontmatter format:
 * ```yaml
 * ---
 * description: "Command description"
 * hint: "Optional hint text"
 * ---
 * ```
 *
 * File name becomes the command name (without .md extension and .agent/.prompt suffixes).
 * Examples:
 * - `.github/agents/my-task.agent.md` → `/my-task`
 * - `.github/prompts/template.prompt.md` → `/template`
 * - `.github/agents/simple.md` → `/simple`
 */
export class GitHubCommandService {
	private commands: SlashCommand[] = [];
	private plugin: AgentClientPlugin;
	private logger: Logger;
	private eventRefs: ReturnType<typeof this.plugin.app.vault.on>[] = [];

	constructor(plugin: AgentClientPlugin) {
		this.plugin = plugin;
		this.logger = getLogger();
		// Initialize commands asynchronously (fire-and-forget pattern)
		this.rebuildCommands().catch((error) => {
			this.logger.error(
				"[GitHubCommandService] Initialization error:",
				error,
			);
		});

		// Listen for vault changes to keep commands up to date
		this.eventRefs.push(
			this.plugin.app.vault.on("create", (file) => {
				if (this.isGitHubCommandFile(file)) {
					this.rebuildCommands().catch((error) => {
						this.logger.error(
							"[GitHubCommandService] Error on create:",
							error,
						);
					});
				}
			}),
		);
		this.eventRefs.push(
			this.plugin.app.vault.on("delete", (file) => {
				if (this.isGitHubCommandFile(file)) {
					this.rebuildCommands().catch((error) => {
						this.logger.error(
							"[GitHubCommandService] Error on delete:",
							error,
						);
					});
				}
			}),
		);
		this.eventRefs.push(
			this.plugin.app.vault.on("rename", (file) => {
				if (this.isGitHubCommandFile(file)) {
					this.rebuildCommands().catch((error) => {
						this.logger.error(
							"[GitHubCommandService] Error on rename:",
							error,
						);
					});
				}
			}),
		);
		this.eventRefs.push(
			this.plugin.app.vault.on("modify", (file) => {
				if (this.isGitHubCommandFile(file)) {
					this.rebuildCommands().catch((error) => {
						this.logger.error(
							"[GitHubCommandService] Error on modify:",
							error,
						);
					});
				}
			}),
		);
	}

	/**
	 * Clean up event listeners. Call this when the service is no longer needed.
	 */
	destroy(): void {
		for (const ref of this.eventRefs) {
			this.plugin.app.vault.offref(ref);
		}
		this.eventRefs = [];
	}

	/**
	 * Get all available local slash commands.
	 */
	getCommands(): SlashCommand[] {
		return this.commands;
	}

	/**
	 * Check if a file is a GitHub command file (.github/agents/*.md or .github/prompts/*.md)
	 */
	private isGitHubCommandFile(file: TFile | TAbstractFile): file is TFile {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return false;
		}

		const path = file.path;
		return (
			path.startsWith(".github/agents/") ||
			path.startsWith(".github/prompts/")
		);
	}

	/**
	 * Rebuild the command list by scanning .github/agents/ and .github/prompts/
	 */
	private async rebuildCommands(): Promise<void> {
		try {
			const githubFiles: Array<{ path: string; content: string }> = [];

			// Get vault base path (where .github folder should be)
			const adapter = this.plugin.app.vault.adapter;
			if (!(adapter instanceof FileSystemAdapter)) {
				this.logger.log(
					"[GitHubCommandService] Not running on FileSystemAdapter, skipping .github scan",
				);
				this.commands = [];
				return;
			}

			const vaultPath = adapter.getBasePath();
			const githubPath = join(vaultPath, ".github");

			this.logger.log(
				`[GitHubCommandService] Scanning for commands in: ${githubPath}`,
			);

			// Scan .github/agents/
			await this.scanCommandFolder(
				join(githubPath, "agents"),
				githubFiles,
			);

			// Scan .github/prompts/
			await this.scanCommandFolder(
				join(githubPath, "prompts"),
				githubFiles,
			);

			// Convert to SlashCommand objects
			this.commands = await Promise.all(
				githubFiles
					.map((file) => this.fileToCommand(file))
					.filter(
						(cmd): cmd is Promise<SlashCommand | null> =>
							cmd !== null,
					),
			).then((results) =>
				results.filter((cmd): cmd is SlashCommand => cmd !== null),
			);

			this.logger.log(
				`[GitHubCommandService] Discovered ${this.commands.length} local commands from .github folder`,
			);
			if (this.commands.length > 0) {
				this.logger.log(
					"[GitHubCommandService] Commands:",
					this.commands.map((c) => c.name),
				);
			}
		} catch (error) {
			this.logger.error(
				"[GitHubCommandService] Error rebuilding commands:",
				error,
			);
			this.commands = [];
		}
	}

	/**
	 * Scan a folder for markdown command files
	 */
	private async scanCommandFolder(
		folderPath: string,
		files: Array<{ path: string; content: string }>,
	): Promise<void> {
		try {
			if (!existsSync(folderPath)) {
				this.logger.log(
					`[GitHubCommandService] Folder not found: ${folderPath}`,
				);
				return;
			}

			const entries = await readdir(folderPath, { withFileTypes: true });
			this.logger.log(
				`[GitHubCommandService] Found ${entries.length} items in ${folderPath}`,
			);

			for (const entry of entries) {
				if (!entry.isFile() || !entry.name.endsWith(".md")) {
					continue;
				}

				const filePath = join(folderPath, entry.name);
				try {
					const content = await readFile(filePath, "utf-8");
					files.push({ path: filePath, content });
					this.logger.log(
						`[GitHubCommandService] Loaded: ${entry.name}`,
					);
				} catch (error) {
					this.logger.error(
						`[GitHubCommandService] Failed to read: ${filePath}`,
						error,
					);
				}
			}
		} catch (error) {
			this.logger.error(
				`[GitHubCommandService] Error scanning folder ${folderPath}:`,
				error,
			);
		}
	}

	/**
	 * Convert a markdown file to a SlashCommand by reading its frontmatter.
	 */
	private async fileToCommand(file: {
		path: string;
		content: string;
	}): Promise<SlashCommand | null> {
		try {
			// Extract command name from file name (without extension and suffixes)
			const fileName = basename(file.path);
			const commandName = fileName
				.replace(/\.(?:agent|prompt)\.md$/, "") // Remove .agent.md or .prompt.md
				.replace(/\.md$/, ""); // Remove .md if not already removed

			// Parse frontmatter from markdown content
			const frontmatterMatch = file.content.match(
				/^---\s*\n([\s\S]*?)\n---/,
			);

			let description = `Command from ${commandName}`;
			let hint: string | null = null;

			if (frontmatterMatch && frontmatterMatch[1]) {
				const frontmatter = frontmatterMatch[1];

				// Extract description from YAML
				const descMatch = frontmatter.match(
					/^description:\s*["']?(.+?)["']?\s*$/m,
				);
				if (descMatch) {
					description = descMatch[1];
				}

				// Extract hint from YAML
				const hintMatch = frontmatter.match(
					/^hint:\s*["']?(.+?)["']?\s*$/m,
				);
				if (hintMatch) {
					hint = hintMatch[1];
				}
			}

			return {
				name: commandName,
				description,
				hint,
				source: "local",
			};
		} catch (error) {
			this.logger.error(
				`[GitHubCommandService] Failed to parse command from ${file.path}:`,
				error,
			);
			return null;
		}
	}
}
