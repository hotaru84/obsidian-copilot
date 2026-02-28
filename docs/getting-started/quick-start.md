# Quick Start

Get up and running with GitHub Copilot in Obsidian in just a few minutes.

## Step 1: Prerequisites

Make sure you have:
- **GitHub Copilot subscription** (paid or trial)
- **Node.js** v16+ ([download here](https://nodejs.org))
- **GitHub account** for authentication

## Step 2: Install GitHub Copilot CLI

```bash
npm install -g @github/copilot-cli
```

## Step 3: Authenticate with GitHub

```bash
copilot auth login
```

Follow the prompts to authorize with GitHub. A browser window will open—sign in and allow access.

## Step 4: Find the Copilot CLI Path

Run one of these commands to find where Copilot is installed:

**macOS/Linux:**
```bash
which copilot
```

**Windows (PowerShell):**
```powershell
Get-Command copilot
```

Note the path (e.g., `/usr/local/bin/copilot` or `C:\Users\...\AppData\Roaming\npm\copilot.exe`)

## Step 5: Configure in Obsidian

1. Open Obsidian Settings
2. Go to **Community Plugins → Copilot for Obsidian**
3. Under **GitHub Copilot**:
   - Paste the path from Step 4 into the **CLI Path** field
   - Click **Authenticate** to test the connection

## Step 6: Start Chatting

1. Click the **robot icon** in the left ribbon, or
2. Use the keyboard shortcut (default: `Ctrl+Shift+*` / `Cmd+Shift+*`)

The chat panel opens in the right sidebar. Type a message and press Enter!

## What's Next?

- Learn about [Note Mentions](/usage/mentions) to reference your vault notes
- Explore [Slash Commands](/usage/slash-commands) for quick actions
- Set up [Session History](/usage/session-history) to resume conversations
- Configure [Floating Chat](/usage/floating-chat) for quick access

## Troubleshooting

**"Command not found: copilot"**
- Verify the CLI path in settings matches the output from Step 4

**"GitHub Copilot not authenticated"**
- Run `copilot auth login` again in your terminal
- Restart Obsidian or click "Restart agent" in the chat menu

Need more help? Check the [full setup guide](/docs/copilot-setup) or [GitHub issues](https://github.com/hiroo-obsidian/obsidian-copilot/issues).
