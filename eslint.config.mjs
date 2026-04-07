import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import { DEFAULT_ACRONYMS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		ignores: [
			"node_modules/",
			"main.js",
			"obsidian-copilot-agent/",
			"docs/",
			"vendor/",
		],
	},
	...obsidianmd.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			// Preserve existing rules
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			// Add project-specific brands and acronyms for sentence-case rule
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					enforceCamelCaseLower: true,
					brands: [
						...DEFAULT_BRANDS,
						"GitHub Copilot",
						"Agent Client",
					],
					acronyms: [...DEFAULT_ACRONYMS, "ACP", "WSL"],
				},
			],
		},
	},
	{
		files: ["**/*.mjs", "**/*.js"],
		languageOptions: {
			globals: {
				console: "readonly",
				process: "readonly",
			},
		},
	},
]);
