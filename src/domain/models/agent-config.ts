/**
 * Domain Models for Agent Configuration
 *
 * These types represent agent settings and configuration,
 * independent of the plugin infrastructure. They define
 * the core concepts of agent identity, capabilities, and
 * connection parameters.
 */

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment variable for agent process.
 *
 * Used to pass configuration and credentials to agent processes
 * via environment variables (e.g., API keys, paths, feature flags).
 */
export interface AgentEnvVar {
	/** Environment variable name (e.g., "ANTHROPIC_API_KEY") */
	key: string;

	/** Environment variable value */
	value: string;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Base configuration for the GitHub Copilot agent.
 *
 * Defines the properties needed to launch and communicate
 * with GitHub Copilot CLI via the Agent Client Protocol.
 */
export interface BaseAgentSettings {
	/** Unique identifier for this agent (fixed as "copilot") */
	id: string;

	/** Human-readable display name shown in UI */
	displayName: string;

	/** Command to execute (full path to copilot CLI or "copilot") */
	command: string;

	/** Command-line arguments (typically ["--acp", "--stdio"]) */
	args: string[];

	/** Environment variables for the agent process */
	env: AgentEnvVar[];
}

/**
 * Configuration for GitHub Copilot CLI agent.
 *
 * GitHub Copilot CLI natively supports ACP via `copilot --acp --stdio`.
 * Authentication must be completed beforehand using `copilot auth login`.
 */
export type CopilotAgentSettings = BaseAgentSettings;
