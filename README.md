<h1 align="center">Copilot for Obsidian</h1>

Chat with GitHub Copilot directly in Obsidian using the built-in remote runtime SDK.

## Features

- **Note Mentions**: Reference your notes with `@notename` syntax
- **Selection Context**: Automatically send selected text as context to the agent
- **Image Attachments**: Paste or drag-and-drop images into the chat
- **Slash Commands**: Use `/` commands from GitHub Copilot and local custom prompts
- **Multi-Session**: Run multiple chat sessions simultaneously in separate views
- **Broadcast Commands**: Send a message to all open chat views simultaneously
- **Floating Chat**: A persistent, collapsible chat window for quick access
- **Mode & Model Switching**: Change Copilot modes and models from the chat
- **Session History**: Resume or fork previous conversations
- **Chat Export**: Save conversations as Markdown notes in your vault
- **Custom Prompts & Scheduling**: Run local prompt files on demand or by schedule
- **Terminal Integration**: Let Copilot execute commands and return results
- **MCP Tool Calls**: View Model Context Protocol tool usage inline in chat
- **Input History**: Navigate previous messages with ↑/↓ arrow keys
- **Auto-Allow Permissions**: Optionally bypass agent permission prompts
- **Display Customization**: Adjust font size, emoji display, and diff collapsing

## Installation

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

## Custom Prompts

Custom prompts are Markdown files in your vault (default folder: `Prompts`) that can be executed manually, via slash command, by periodic schedule, or by file events.

- **Slash command registration**: Prompt files are automatically registered as local slash commands (for example, `/daily-note-summary`) based on prompt title/file name.
- **Quick one-shot execution**: Running a custom prompt slash command executes the prompt body immediately through the same runner used by manual execution.
- **Condition config file**: Execution conditions are managed in a vault JSON file (default: `Prompts/.copilot-prompts.json`), not in prompt front-matter.
- **Exclusive modes**: Each prompt can be `manual`, `periodic`, or `event` (periodic/event are exclusive).
- **Periodic scheduling**: Configure `timeWindows` (max 3), optional `daysOfWeek`, and optional `scheduledDate` (`YYYY-MM-DD`).
- **Event scheduling (daily note)**: Run when a new daily note is created, with the created daily note content injected as prompt context.
- **Event scheduling (external path)**: Run when a new direct-child file is created in a configured external directory (vault outside).
- **Background execution**: Automatic runs are executed in dedicated background chat tabs so they do not interrupt your active tab.
- **Manual run options**: Run from command palette (`Run custom prompt`) or from the Custom Prompts settings modal (`Run now`).
- **Pause/Resume control**: Pause or resume automatic prompt runs globally.
- **Execution queue and history**: Runs are queued safely and recent execution history is tracked in settings/status menu.
- **Per-scheduled-tab permission behavior**: Optionally auto-allow permission requests only for background tabs created for automatic runs.
- **Built-in sample template**: Create a sample prompt file quickly, then configure conditions in the settings modal.

Condition config example (`Prompts/.copilot-prompts.json`):

```json
{
  "version": 1,
  "prompts": {
    "Prompts/Daily Note Summary.md": {
      "mode": "periodic",
      "enabled": true,
      "timeWindows": [
        { "startTime": "08:00", "endTime": "09:00" }
      ],
      "daysOfWeek": [1, 2, 3, 4, 5]
    },
    "Prompts/Ingest External Inbox.md": {
      "mode": "event",
      "enabled": true,
      "eventType": "external-file-created",
      "externalWatchPath": "C:/tmp/inbox"
    }
  }
}
```

## Development

* TODO * : this repository depends on below repository and need to how to merge it into this repository for building. (https://github.com/hotaru84/copilot-remote-sdk)

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

