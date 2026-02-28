<h1 align="center">Copilot for Obsidian</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/hiroo-obsidian/obsidian-copilot/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/hiroo-obsidian/obsidian-copilot" alt="License">
  <img src="https://img.shields.io/github/v/release/hiroo-obsidian/obsidian-copilot" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/hiroo-obsidian/obsidian-copilot" alt="GitHub last commit">
</p>

<p align="center">
  <a href="README.ja.md">日本語はこちら</a>
</p>

Chat with GitHub Copilot directly in Obsidian. Bring your AI assistant into your vault using the Agent Client Protocol (ACP).

Built on [Agent Client Protocol (ACP)](https://github.com/zed-industries/agent-client-protocol) by Zed.

https://github.com/user-attachments/assets/1c538349-b3fb-44dd-a163-7331cbca7824

## Features

- **Note Mentions**: Reference your notes with `@notename` syntax
- **Image Attachments**: Paste or drag-and-drop images into the chat
- **Slash Commands**: Use `/` commands provided by GitHub Copilot
- **Multi-Session**: Run multiple chat sessions simultaneously in separate views
- **Floating Chat**: A persistent, collapsible chat window for quick access
- **Mode & Model Switching**: Change Copilot modes and models from the chat
- **Session History**: Resume or fork previous conversations
- **Chat Export**: Save conversations as Markdown notes in your vault
- **Terminal Integration**: Let Copilot execute commands and return results

## Installation

### Via BRAT (Recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Go to **Settings → BRAT → Add Beta Plugin**
3. Paste: `https://github.com/hiroo-obsidian/obsidian-copilot`
4. Enable **Copilot for Obsidian** from the plugin list

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/hiroo-obsidian/obsidian-copilot/releases)
2. Place them in `VaultFolder/.obsidian/plugins/obsidian-copilot/`
3. Enable the plugin in **Settings → Community Plugins**

## Quick Start

GitHub Copilot uses the Agent Client Protocol natively, so setup is simple:

1. **Install GitHub Copilot CLI**:
   ```bash
   npm install -g @github/copilot-cli
   ```

2. **Authenticate**:
   ```bash
   copilot auth login
   ```
   Follow the browser prompts to authorize with GitHub.

3. **Find the path**:
   ```bash
   which copilot    # macOS/Linux
   where.exe copilot # Windows
   ```

4. **Configure** in **Settings → Copilot for Obsidian**:
   - **GitHub Copilot CLI path**: e.g., `/usr/local/bin/copilot` (or `C:\path\to\copilot.exe` on Windows)
   - **Node.js path**: (optional) Path to your Node.js installation if not in PATH

5. **Start chatting**: Click the robot icon in the ribbon (or use keyboard shortcut)

**[Full Documentation](https://github.com/hiroo-obsidian/obsidian-copilot/wiki)**

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

[![Star History Chart](https://api.star-history.com/svg?repos=RAIT-09/obsidian-agent-client&type=Date)](https://www.star-history.com/#RAIT-09/obsidian-agent-client&Date)
