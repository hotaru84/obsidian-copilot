# MCP Tools

AI agents can use Model Context Protocol (MCP) tools to interact with external services and perform specialized tasks.

## What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard that allows AI agents to connect to external tools and data sources.

::: tip
MCP support and configuration depend on the agent. Refer to your agent's documentation for details.
:::

## Configure MCP Servers

You can configure runtime MCP servers from **Settings → Copilot for Obsidian → Runtime**.

- **Enable MCP config discovery**: Allows runtime to discover MCP config files from `configDir`.
- **MCP servers JSON**: Sets `SessionConfig.mcpServers` directly as a JSON object.

Configuration is applied from the next `newSession`, `resumeSession`, or `forkSession` call.

Example:

```json
{
  "filesystem": {
    "type": "local",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
  },
  "my-http-mcp": {
    "type": "http",
    "url": "https://example.com/mcp"
  }
}
```

## How MCP Works

When an agent uses an MCP tool:

1. The agent decides which tool to use
2. The tool call appears in the chat
3. The tool executes and returns results
4. The agent uses the results to continue

## Viewing Tool Calls

Tool calls are displayed in the chat with:

- **Tool name**: What tool was used
- **Status**: Running, completed, or failed

## Permissions

Some MCP tool calls may require your permission before executing. When a permission request appears, select one of the available options provided by the agent.

See [Editing](/usage/editing#permission-controls) for permission settings.
