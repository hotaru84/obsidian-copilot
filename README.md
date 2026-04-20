<h1 align="center">Copilot for Obsidian</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/hotaru84/obsidian-copilot/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/hotaru84/obsidian-copilot" alt="License">
  <img src="https://img.shields.io/github/v/release/hotaru84/obsidian-copilot" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/hotaru84/obsidian-copilot" alt="GitHub last commit">
</p>

<p align="center">
  <a href="README.ja.md">日本語はこちら</a>
</p>

Chat with GitHub Copilot directly in Obsidian using the built-in remote runtime SDK.

https://github.com/user-attachments/assets/1c538349-b3fb-44dd-a163-7331cbca7824

## Features

- **Note Mentions**: Reference your notes with `@notename` syntax
- **Selection Context**: Automatically send selected text as context to the agent
- **Image Attachments**: Paste or drag-and-drop images into the chat
- **Slash Commands**: Use `/` commands provided by GitHub Copilot
- **Multi-Session**: Run multiple chat sessions simultaneously in separate views
- **Broadcast Commands**: Send a message to all open chat views simultaneously
- **Floating Chat**: A persistent, collapsible chat window for quick access
- **Mode & Model Switching**: Change Copilot modes and models from the chat
- **Session History**: Resume or fork previous conversations
- **Chat Export**: Save conversations as Markdown notes in your vault
- **Scheduled Prompts**: Automate recurring messages with time-window scheduling
- **Terminal Integration**: Let Copilot execute commands and return results
- **MCP Tool Calls**: View Model Context Protocol tool usage inline in chat
- **Input History**: Navigate previous messages with ↑/↓ arrow keys
- **Auto-Allow Permissions**: Optionally bypass agent permission prompts
- **Display Customization**: Adjust font size, emoji display, and diff collapsing

## Installation

### Via BRAT (Recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Go to **Settings → BRAT → Add Beta Plugin**
3. Paste: `https://github.com/hotaru84/obsidian-copilot`
4. Enable **Copilot for Obsidian** from the plugin list

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/hotaru84/obsidian-copilot/releases)
2. Place them in `VaultFolder/.obsidian/plugins/obsidian-copilot-agent/`
3. Enable the plugin in **Settings → Community Plugins**

## Quick Start

1. Open **Settings → Copilot for Obsidian → Runtime**.
2. Choose **Bundled server** (recommended) or **External server**.
3. If needed, adjust port/URL and timeout settings.
4. Optional: configure **Enable MCP config discovery** and **MCP servers JSON**.
5. Start chatting from the ribbon icon.

**[Full Documentation](https://github.com/hotaru84/obsidian-copilot/wiki)**

## Changelog

### Bug Fixes

#### Web fetch tool calls stuck in "pending" state

**Symptom**: When an agent performs a web fetch, the tool call sometimes stays in
`pending` state indefinitely. The permission approval buttons never appear, and
cancelling the operation prints `Cancelling 1 pending permission requests` in
the console despite no UI prompt being shown.

**Root cause** (three interacting issues):

1. **Stale permission queue across prompts** — `pendingPermissionQueue` was only
   cleared by an explicit cancel, not on prompt start. If a previous prompt ended
   without resolving its permission request (e.g., agent crash / error recovery),
   the leftover entry caused the *next* `requestPermission` call to see
   `queue.length > 0` and emit `isActive: false`, hiding the approval buttons.

2. **Status regression in `tool_call_update`** — The runtime `ToolCallUpdate.status`
   field is nullable (`null` = "no change"). The adapter was treating `null` the
   same as `undefined` via `status || "pending"`, converting it to `"pending"`
   and overwriting an already-`in_progress` status.

3. **No forward-only status guard in merge logic** — `mergeToolCallContent` would
   unconditionally apply whatever status arrived, allowing regressions like
   `in_progress → pending`.

**Fix**:
- `resetCurrentMessage()` now clears stale permission queues before each new
  prompt, so a leftover queue entry can never suppress the next permission UI.
- `sessionUpdate()` handler splits `tool_call` and `tool_call_update` cases:
  updates use `status ?? undefined` so ACP `null` maps to "no change" rather
  than `"pending"`.
- `mergeToolCallContent` enforces a forward-only status order
  (`pending → in_progress → completed/failed`), preventing any regression
  regardless of what the adapter emits.

## Development

```bash
npm install
npm run dev
```

For production builds:
```bash
npm run build
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hotaru84/obsidian-copilot&type=Date)](https://www.star-history.com/#hotaru84/obsidian-copilot&Date)
