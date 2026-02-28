---
layout: home

hero:
  name: "Copilot for Obsidian"
  text: "GitHub Copilot in Your Vault"
  tagline: Chat with GitHub Copilot directly from your Obsidian vault
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/hiroo-obsidian/obsidian-copilot

features:
  - icon: 🤖
    title: Direct Copilot Integration
    details: Chat with GitHub Copilot in a dedicated right-side panel
  - icon: 📝
    title: Note Mentions
    details: Mention any note with @notename to include its content in your prompt
  - icon: ⚡
    title: Slash Commands
    details: Use / commands to quickly trigger Copilot actions
  - icon: 🎛️
    title: Mode & Model Selection
    details: Change AI models and Copilot modes directly from the chat
  - icon: 💻
    title: Terminal Integration
    details: Let Copilot execute commands and return results in chat
  - icon: 📸
    title: Image Support
    details: Paste or drag images into the chat for analysis
---

<div style="max-width: 800px; margin: 2rem auto;">
  <video controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <source src="/demo.mp4" type="video/mp4">
  </video>
</div>

## What is Copilot for Obsidian?

Copilot for Obsidian brings GitHub Copilot directly into your vault. Built on the [Agent Client Protocol (ACP)](https://github.com/zed-industries/agent-client-protocol), it enables seamless communication with GitHub Copilot via the command line.

### Requirements

| Item | Details |
|------|---------|
| **[Claude Code](https://github.com/anthropics/claude-code)** | Anthropic | via [Zed’s SDK adapter](https://github.com/zed-industries/claude-agent-acp) |
| **[Codex](https://github.com/openai/codex)** | OpenAI | via [Zed’s adapter](https://github.com/zed-industries/codex-acp) |
| **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** | Google | with `--experimental-acp` option |
| **Custom** | Various | [Any ACP-compatible agent](https://agentclientprotocol.com/overview/agents) (e.g., OpenCode, Qwen Code, Kiro) |

### Key Features

- **Note Mentions**: Reference your Obsidian notes in conversations with `@notename`
- **File Editing**: Let agents read and modify files with permission controls
- **Chat Export**: Save conversations for future reference
- **Terminal Integration**: Agents can execute shell commands and show results inline

Ready to get started? Check out the [Installation Guide](/getting-started/).
