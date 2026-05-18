<img src="docs/logo-momiji.png" width="60" alt="Momiji IDE" />

# Momiji IDE 🍁

> **AI-native IDE platform, powered by Kitsune AI**

A desktop code editor built for everyone — from first-time coders to seasoned developers. Ships with **Kitsune AI** as a built-in coding assistant that can read, write, and reason about your entire project.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-orange)](https://github.com/momiji-ide/momiji-ide/releases)
[![Version](https://img.shields.io/badge/version-1.2.0-f97316)](https://github.com/momiji-ide/momiji-ide/releases)

---

## What makes it different

Most editors are built for developers who already know what they're doing. Momiji tries to meet people wherever they are — with a visual block editor for beginners, a full Monaco-powered code editor for pros, and an AI layer that actually *does* things instead of just suggesting them.

Kitsune AI isn't just a chat window. Give it a task and it'll explore your project, read the relevant files, write the code, and tell you what it changed. Like having a senior dev who never sleeps.

---

## Features

### 🦊 Kitsune AI

- Chat with **Claude, Gemini, GPT, Groq, DeepSeek, Mistral, OpenRouter, or Ollama** — streaming
- **7 built-in agents** — Code Reviewer, Test Writer, Doc Writer, Security Scanner, Refactor Pro, Bug Hunter, + General
- **Custom Agent Manager** — create your own agents with custom system prompts, roles, and tool access
- **Project Memory** — write project context once (`.momiji/kitsune-memory.md`), auto-included in every prompt
- **Auto tech-stack detection** — Kitsune reads `package.json`, `go.mod`, `Cargo.toml`, etc. automatically
- **Agent mode** — give it a task, it autonomously reads/writes files with tool calls until done
- **Inline AI completions** — Copilot-style ghost text as you type (toggle with toolbar)
- Paste screenshots directly into chat — Kitsune sees and understands your UI/errors
- `⚡ Apply to Editor` — shows a diff before touching your files
- Context window bar so you know exactly how much runway you have

### 🖊️ Editor

- Monaco editor (same engine as VS Code) with warm Momiji dark/light theme
- **PDF Viewer** — open `.pdf` files natively in editor tabs
- **Hex Viewer** — binary file inspector with magic byte detection (25+ formats)
- **Image Viewer** — PNG, JPG, GIF, SVG, WebP with zoom controls and checkerboard bg
- Split editor, tab management, minimap, IntelliSense
- **Git Blame** — inline per-line annotations with author, date, and commit hash
- Inline Python linting, Go to Definition, Rename Symbol, Find All References
- Markdown split preview, syntax highlighting for 30+ languages
- Inline color picker — click any `#hex` / `rgb()` / `hsl()` value to edit live
- Auto-save, format on save, bracket colorization

### 🔀 Git

- Stage, unstage, commit, push, pull — all from the sidebar
- Branch switcher with one-click create
- Inline diff viewer per file
- AI-generated commit messages from your staged diff

### 🔍 Command Palette

- `Ctrl+P` — fuzzy file search with recent files
- `> command` — run any IDE action by name
- Keyboard-first navigation throughout

### 🛠️ Playground & Tools

- **Canvas Playground** — 10 interactive JS animation templates (particles, gravity, Game of Life...)
- **Regex Playground** — live match highlighting, named groups, quick reference
- **Code Screenshot** — export beautiful code images with gradient backgrounds
- **HTTP Client** — REST client with history, collections, and env variables
- **SQLite Browser** — run queries, browse tables without leaving the IDE
- **TODO Scanner** — finds every `TODO/FIXME/HACK` across the whole project

### 🧩 For Beginners

- Block Editor with Beginner / Intermediate / Advanced toolboxes (Blockly)
- Visual Flow Editor for node-graph programming
- Onboarding wizard on first launch
- Template Gallery — scaffold common project types instantly

### 📦 Everything Else

- Package Manager — npm, pip, cargo, go + npm scripts runner
- Snippet Manager — save and reuse code fragments
- Extensions panel — 8 themes (Dracula, Tokyo Night, Nord, One Dark...) + integrations
- Time-Travel Debugger — step through code execution history
- Symbol Outline — jump to any function/class/variable, tracks cursor
- Toast notifications with auto-dismiss
- 9 UI languages

---

## AI Providers

| Provider | Free tier | Model |
|---|---|---|
| 🟠 Google Gemini | ✅ Free | `gemini-3.1-flash-lite` |
| 🟢 Groq | ✅ Free | `llama-3.3-70b-versatile` |
| 🟤 OpenRouter | ✅ Free models | `meta-llama/llama-3.3-70b-instruct:free` |
| 🔵 Anthropic Claude | ❌ BYOK | `claude-sonnet-4-5` |
| 🟡 OpenAI GPT | ❌ BYOK | `gpt-4o-mini` |
| 🟣 DeepSeek | ❌ BYOK | `deepseek-chat` |
| ⚪ Mistral AI | ❌ BYOK | `mistral-small-latest` |
| 🏠 Ollama | ✅ Local | `qwen2.5-coder:7b` |

Open Settings → AI & API Keys, paste your key, enable the provider. Keys stay on your machine — never sent to Momiji servers.

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

Grab the latest installer from [Releases](https://github.com/momiji-ide/momiji-ide/releases).

- **Windows** — `.exe` (NSIS installer)
- **macOS** — `.dmg`
- **Linux** — `.AppImage`

### Build from source

You'll need Node.js 20+ and npm.

```bash
git clone https://github.com/momiji-ide/momiji-ide.git
cd momiji-ide
npm install
npm run dev
```

To build a distributable:

```bash
npm run dist
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+P` | Command palette |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save all |
| `Ctrl+W` | Close tab |
| `Ctrl+B` | Toggle sidebar |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Shift+P` | Canvas Playground |
| `Ctrl+Shift+R` | Regex Playground |
| `Ctrl+Shift+X` | Code Screenshot |
| `Ctrl+Shift+D` | Time-Travel Debugger |
| `F5` | Run file |
| `F12` | Go to definition |

---

## Project Memory

Momiji saves a per-project context file at `.momiji/kitsune-memory.md`. Write your stack, conventions, and preferences there — Kitsune reads it automatically with every message.

```
Stack: React 18 + FastAPI + PostgreSQL
Style: functional, no classes, strict TypeScript
Avoid: lodash, moment.js
API base: http://localhost:8000
```

---

## Contributing

Issues and PRs welcome. If you're adding something big, open an issue first.

---

## License

MIT © Momiji IDE contributors
