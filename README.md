# Parallax IDE

A desktop code editor built for everyone — from first-time coders to seasoned developers. Ships with **Kitsune AI** as a built-in coding assistant that can read, write, and reason about your entire project.

> Code from every angle.

---

## What makes it different

Most editors are built for developers who already know what they're doing. Parallax tries to meet people wherever they are — with a visual block editor for beginners, a full Monaco-powered code editor for pros, and an AI layer that actually does things instead of just suggesting them.

Kitsune AI isn't just a chat window. Give it a task and it'll explore your project, read the relevant files, write the code, and tell you what it changed. Like having a junior dev who never sleeps.

---

## Features

**Editor**
- Monaco editor (same engine as VS Code) with Catppuccin theme
- Split editor, tab management, minimap, IntelliSense
- Inline Python linting, Go to Definition, Rename Symbol
- Markdown preview, syntax highlighting for 30+ languages
- Auto-save, format on save, bracket colorization

**Kitsune AI**
- Chat with Claude, Gemini, or GPT — streaming responses
- Paste screenshots directly into chat for visual analysis
- `⚡ Apply to Editor` — shows a diff before touching your files
- **Agent mode** — give it a task, it reads/writes files autonomously
- Context window bar so you know how much runway you have left
- AI-generated commit messages from your staged diff

**Git**
- Stage, unstage, commit, push, pull — all from the sidebar
- Branch switcher with one-click create
- Inline diff viewer per file

**Playground & Tools**
- Canvas Playground — 10 interactive JS animation templates (particles, gravity sim, Game of Life...)
- Regex Playground — live match highlighting, capture groups, quick reference
- Code Screenshot — export beautiful code images with gradient backgrounds
- TODO/FIXME scanner — finds every task comment across the whole project

**For beginners**
- Block Editor with Beginner / Intermediate / Advanced toolboxes (Blockly)
- Visual Flow Editor for node-graph programming
- Onboarding wizard on first launch

**Everything else**
- HTTP Client with history and environment variables
- SQLite Browser — run queries, browse tables
- Package Manager — npm, pip, cargo, go + npm scripts runner
- Time-Travel Debugger — step through code execution history
- Template Gallery — scaffold common project types
- Snippet Manager
- Extensions panel — themes (Dracula, Tokyo Night, Nord, One Dark...) + tool integrations
- 9 UI languages

---

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron 31 |
| UI | React 18 + TypeScript |
| Editor | Monaco Editor |
| State | Zustand with persist |
| Block coding | Blockly |
| Flow editor | React Flow |
| Terminal | xterm.js + node-pty |
| Build | electron-vite + electron-builder |
| Updates | electron-updater |

---

## Getting started

### Download

Grab the latest installer from [Releases](https://github.com/parallax-ide/parallax-ide/releases).

- **Windows** — `.exe` (NSIS installer)
- **macOS** — `.dmg`
- **Linux** — `.AppImage`

### Build from source

You'll need Node.js 20+ and npm.

```bash
git clone https://github.com/parallax-ide/parallax-ide.git
cd parallax-ide
npm install
npm run dev
```

To build a distributable:

```bash
npm run dist
```

---

## Kitsune AI setup

Parallax works with any of these providers — you bring your own key:

| Provider | Get a key | Free tier |
|---|---|---|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | ✅ Yes |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/keys) | ❌ Paid |
| OpenAI GPT | [platform.openai.com](https://platform.openai.com/api-keys) | ❌ Paid |

Open Settings → AI & API Keys, paste your key, enable the provider. Keys stay on your machine.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+P` | Command palette |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save all |
| `Ctrl+B` | Toggle sidebar |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Shift+P` | Canvas Playground |
| `Ctrl+Shift+R` | Regex Playground |
| `Ctrl+Shift+X` | Code Screenshot |
| `Ctrl+Shift+D` | Time-Travel Debugger |
| `F5` | Run file |
| `F12` | Go to definition |

---

## Contributing

Issues and PRs welcome. If you're adding something big, open an issue first so we can talk through it.

---

## License

MIT
