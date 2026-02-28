# GitHub Copilot Setup Guide

This guide walks you through setting up GitHub Copilot with Obsidian.

## Prerequisites

- **GitHub Copilot Subscription**: You need an active GitHub Copilot subscription
- **GitHub Account**: Required to authenticate with GitHub
- **Node.js**: Required for GitHub Copilot CLI (v16 or later recommended)

## Installation Steps

### 1. Install GitHub Copilot CLI

GitHub Copilot CLI is distributed via npm:

```bash
npm install -g @github/copilot-cli
```

If you don't have Node.js installed, [download it here](https://nodejs.org/).

### 2. Authenticate with GitHub

Run the login command:

```bash
copilot auth login
```

You'll be prompted to:
1. Open a link in your browser
2. Authorize the GitHub CLI to access your account
3. Return to the terminal (automatic return)

After successful authentication, you can close the terminal window.

### 3. Verify Installation

Test that Copilot CLI is working:

```bash
copilot --version  # Check version
copilot --acp enable  # Enable ACP mode (optional)
```

### 4. Find Your Copilot CLI Path

Depending on your operating system:

**macOS/Linux:**
```bash
which copilot
```

**Windows (PowerShell):**
```bash
Get-Command copilot
```

This will output something like:
- macOS: `/usr/local/bin/copilot`
- Windows: `C:\Users\YourName\AppData\Roaming\npm\copilot.exe`

### 5. Configure in Obsidian

1. Open Obsidian Settings
2. Go to **Community Plugins → Copilot for Obsidian**
3. In the **GitHub Copilot** section:
   - **CLI Path**: Paste the path from step 4
   - **Authentication**: Click "Authenticate" to verify your setup
4. Optionally configure:
   - **Node.js Path**: If your Node.js isn't in the system PATH
   - **Other Settings**: Font size, mentions, floating chat, etc.

### 6. Create Your First Chat

1. Click the **robot icon** in the ribbon (left sidebar)
2. A new chat view will open
3. Type your first message and hit Enter or Cmd+Enter

## Troubleshooting

### "Command not found: copilot"

**Solution**: Verify the CLI path in settings matches your actual `which copilot` output.

### "GitHub Copilot not authenticated"

**Solution**:
1. Open a terminal and run:
   ```bash
   copilot auth login
   ```
2. Complete the authentication flow
3. Restart Obsidian or click "Restart agent" in the chat menu

### "Failed to create session"

**Solution**:
1. Check that GitHub Copilot CLI is installed (`npm list -g @github/copilot-cli`)
2. Verify your CLI path in settings
3. Check that you're authenticated (`copilot --version` should work)
4. Enable Debug Mode in settings to see detailed error messages

### Settings are saved but not applied

**Solution**: Click "Restart agent" in the chat menu or create a new chat view.

## Using GitHub Copilot in Obsidian

### Chat Features

- **@mentions**: Reference your vault notes with `@notename`
- **Images**: Paste or drag images into the chat
- **Slash Commands**: Use agent commands like `/help`, `/codeReview`, etc.
- **Session History**: Resume or fork previous conversations
- **Export**: Save conversations as Markdown notes

### Keyboard Shortcuts

- **Open Chat**: Default: `Ctrl+Shift+*` (Windows/Linux) or `Cmd+Shift+*` (macOS)
- **Send Message**: `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (macOS)
- **Stop Generation**: `Escape`

## Advanced Configuration

### Network/Proxy Settings

If you're behind a proxy, you may need to configure Node.js environment variables:

```bash
# macOS/Linux
export https_proxy=http://proxy.example.com:8080
export http_proxy=http://proxy.example.com:8080

# Windows (PowerShell)
$env:https_proxy="http://proxy.example.com:8080"
$env:http_proxy="http://proxy.example.com:8080"
```

### WSL on Windows

If running Obsidian on Windows with WSL:

1. Install GitHub Copilot CLI inside your WSL distribution
2. In Obsidian settings:
   - Enable **Windows WSL Mode**
   - Select your distribution
   - Set the Copilot CLI path to the WSL path (e.g., `/usr/local/bin/copilot`)

### Custom Working Directory

By default, chats use the vault root as the working directory. This can be changed in:
- **Settings → Copilot for Obsidian → Chat View Location**

## Learn More

- [Copilot for Obsidian GitHub](https://github.com/hiroo-obsidian/obsidian-copilot)
- [GitHub Copilot CLI Docs](https://cli.github.com/)
- [Agent Client Protocol (ACP)](https://github.com/zed-industries/agent-client-protocol)
