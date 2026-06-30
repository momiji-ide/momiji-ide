<img src="docs/logo-momiji.png" width="60" alt="Momiji IDE" />

# Momiji IDE 🍁

> **The AI-native creative studio where anyone can build games, apps, and tools — from their first block to production-ready code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-orange)](https://github.com/momiji-ide/momiji-ide/releases)
[![Version](https://img.shields.io/badge/version-1.3.3-f97316)](https://github.com/momiji-ide/momiji-ide/releases)
[![Stars](https://img.shields.io/github/stars/momiji-ide/momiji-ide?color=f97316)](https://github.com/momiji-ide/momiji-ide/stargazers)

[**Download**](https://github.com/momiji-ide/momiji-ide/releases) · [**Website**](https://momiji-ide.github.io/momiji-ide) · [**Report a bug**](https://github.com/momiji-ide/momiji-ide/issues)

---

## Screenshots

<p align="center">
  <img src="docs/MomijiKitsune2.png" alt="Momiji IDE — AI-native IDE platform powered by Kitsune AI" width="800" />
</p>

<p align="center">
  <img src="docs/kitsune-normal.png" alt="Kitsune AI — normal" height="160" />
  <img src="docs/kitsune-happy.png" alt="Kitsune AI — happy" height="160" />
  <img src="docs/kitsune-confuse.png" alt="Kitsune AI — confused" height="160" />
</p>

<p align="center"><i>The Kitsune avatar reacts to your code in real time — happy on a clean run, confused on errors.</i></p>

---

## What makes Momiji different

Most IDEs are built for developers who already know what they're doing. Momiji meets people wherever they are.

- A **beginner** drags a "repeat" block → sees real JavaScript appear instantly → edits the code → blocks update automatically. That's the magic moment.
- A **developer** gets Kitsune AI with 8 provider choices, 7 built-in agents, project memory, inline completions, and full Monaco power.
- A **game dev** gets quests, visual flow editor, canvas playground, and an AI that speaks Unity/Godot/Blender analogies.

Not competing with VS Code. Competing in a new arena — the **beginner→pro progression platform**.

---

## What's new in v1.3.3

### 🦊 Kitsune AI — Full Coding Agent
- **Composer Mode** — multi-file diff review after agentic edits (Accept All / Revert All / per-file)
- **Ctrl+K Inline Edit** — select code, press Ctrl+K, describe the change, AI edits in-place
- **@file Mentions** — type `@filename` in chat to auto-attach file content as context
- **Terminal AI** — Kitsune can run shell commands (`npm install`, `git status`, etc.)
- **Slash Commands** — `/review`, `/test`, `/security`, `/docs`, `/refactor`, `/debug`, `/plan`, `/explain`
- **Activity Tab** — watch every tool call in real time as Kitsune works
- **Inline Diff** — green gutter markers in the editor for AI-changed lines
- **Live Processing Stats** — token count, throughput, tool calls, files changed — all live

### 🆕 New Free AI Providers
- **SambaNova** — Llama 3.3 70B, DeepSeek R1, QwQ 32B (ultra fast, free)
- **Cerebras** — Llama 3.3 70B (~2000 tok/s), Llama 4 Scout (free)
- **Gemma 4 31B** — via Google API (free)

### 🛠️ New Tools
- **CSV/TSV Viewer** — color-coded columns, sortable headers, row filter
- **Usage Analytics** — Claude-Code-style dashboard (Overview/Models tabs, heatmap)

### 🎨 UI Overhaul
- Minimalist model selector (Cursor-style compact dropdown)
- IDE-native chat style with role labels, no bubbles
- Prominent retry/rewind buttons on error messages
- Pixel Kitsune avatar with mood animations

---

## Core Features

### 🦊 Kitsune AI

- Chat with **Claude, Gemini, GPT, Groq, SambaNova, Cerebras, DeepSeek, Mistral, OpenRouter, or Ollama** — 11+ providers
- **Agentic mode** — reads, writes, searches, and creates files autonomously (up to 20 tool-call iterations)
- **Slash commands** — `/review`, `/test`, `/security`, `/docs`, `/refactor`, `/debug`, `/plan`, `/explain`
- **Activity tab** — watch every tool call in real time as Kitsune works
- **3 Explanation Personas** — Beginner (warm, analogies), Developer (direct, technical), Creative (visual, game-dev context)
- **Project Memory** — write context once (`.momiji/kitsune-memory.md`), auto-included in every prompt
- **Error Explanation** — "Ask Kitsune" on any error in Problems panel → plain-language fix
- **Pending write approval** — review each file change or enable auto-approve for hands-free
- Paste screenshots directly into chat — vision support across all providers
- Inline AI completions — Copilot-style ghost text (toggleable)
- `⚡ Apply to Editor` — shows a diff before touching files
- **Usage analytics** — Claude-Code-style dashboard with token stats, heatmap, model breakdown

### 🖊️ Editor

- Monaco editor (VS Code engine) — IntelliSense, 50+ languages, warm Momiji theme
- **CSV/TSV Viewer** — color-coded columns, sortable headers, row filter
- **Hex Viewer** — binary file inspector with magic byte detection (25+ formats)
- **PDF Viewer** — open `.pdf` natively in editor tabs
- **Image Viewer** — PNG, JPG, GIF, SVG, WebP with zoom controls
- **Git Blame** — inline per-line annotations with author, date, commit hash
- Split editor, minimap, IntelliSense, Go to Definition, Rename Symbol
- Inline color picker — click any `#hex` / `rgb()` / `hsl()` value to edit live
- Markdown split preview, Voice-to-Code (speech → code insertion)
- Auto-save, format on save, bracket colorization

### 🧩 For Beginners & Creative Devs

- **Block Editor** — Blockly with Beginner/Pro/Expert toolboxes + **bi-directional code sync**
- **STEM Robot Simulator** — 2D/3D line-following robot with sensors, obstacles, 5 arena presets
- **Visual Flow Editor** — node-graph programming with React Flow
- **Algorithm Animator** — watch your code execute step by step with data visualization
- **Coding Quests + XP** — gamified learning challenges with Kitsune hints
- Onboarding wizard with AI setup in 60 seconds
- Template Gallery — scaffold common project types instantly

### 🔀 Git

- Stage, unstage, commit, push, pull — sidebar
- Branch switcher with one-click create
- Inline diff viewer per file
- AI-generated commit messages from staged diff

### 🛠️ Developer Tools

- **HTTP Client** — REST client with history, collections, env variables
- **SQLite Browser** — run queries, browse tables without leaving the IDE
- **Canvas Playground** — 10 interactive JS animation templates
- **Shader Playground** — GLSL editor with live preview
- **Regex Playground** — live match highlighting, named groups
- **Color Palette Studio** — generate and export color schemes
- **Easing Visualizer** — preview CSS/animation easing curves
- **Sprite Sheet Slicer** — slice spritesheets with JSON/CSS export
- **Time-Travel Debugger** — step through JavaScript execution history
- **Package Manager** — npm, pip, cargo, go + npm scripts runner
- **TODO Scanner** — finds every `TODO/FIXME/HACK` across the project
- **Code Screenshot** — export beautiful code images with gradient backgrounds
- **Snippet Manager**, **Symbol Outline**, **Command Palette** (`Ctrl+P`)

---

## AI Providers

| Provider | Free tier | Default model |
|---|---|---|
| 🟠 Google Gemini | ✅ Free | `gemini-3.5-flash` |
| ⚡ Groq | ✅ Free | `llama-3.3-70b-versatile` |
| 🔶 SambaNova | ✅ Free | `Meta-Llama-3.3-70B-Instruct` |
| 🧠 Cerebras | ✅ Free | `llama-3.3-70b` (~2000 tok/s) |
| 🌐 OpenRouter | ✅ Free models | `meta-llama/llama-3.3-70b-instruct:free` |
| 🟣 Anthropic Claude | BYOK | `claude-sonnet-4-6` |
| 🟢 OpenAI GPT | BYOK | `gpt-5-mini` |
| 🔵 DeepSeek | BYOK | `deepseek-chat` |
| ⚪ Mistral AI | BYOK | `mistral-small-latest` |
| 🏠 Ollama | ✅ Local | `qwen2.5-coder:7b` |
| ⚙️ Custom | Any | OpenAI-compatible endpoint |

Open **Settings → AI & API Keys**, paste your key, enable the provider. Keys stay on your machine — never sent to Momiji servers.

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

---

## Getting started

### Download

Grab the latest installer from [**Releases →**](https://github.com/momiji-ide/momiji-ide/releases)

| Platform | File |
|---|---|
| Windows | [`Momiji-IDE-Setup-1.3.3.exe`](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.3/Momiji-IDE-Setup-1.3.3.exe) |
| macOS (Apple Silicon) | [`Momiji-IDE-1.3.3-arm64.dmg`](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.3/Momiji-IDE-1.3.3-arm64.dmg) |
| macOS (Intel) | [`Momiji-IDE-1.3.3-x64.dmg`](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.3/Momiji-IDE-1.3.3-x64.dmg) |
| Linux | [`Momiji-IDE-1.3.3.AppImage`](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.3/Momiji-IDE-1.3.3.AppImage) |

### Build from source

Requires Node.js 20+.

```bash
git clone https://github.com/momiji-ide/momiji-ide.git
cd momiji-ide
npm install
npm run dev       # dev mode with hot reload
npm run dist      # build distributable
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+P` | Command palette / file search |
| `Ctrl+S` | Save |
| `Ctrl+W` | Close tab |
| `Ctrl+B` | Toggle sidebar |
| `` Ctrl+` `` | Toggle terminal |
| `F5` | Run file |
| `F12` | Go to definition |
| `Ctrl+Shift+D` | Time-Travel Debugger |
| `Ctrl+Shift+X` | Code Screenshot |

---

## Project Memory

Momiji saves per-project context at `.momiji/kitsune-memory.md`. Write your stack, conventions, and anything Kitsune should always know — it's included automatically in every AI request.

```markdown
# My Project

## Stack
React 18 + FastAPI + PostgreSQL

## Conventions
- Functional only, no classes
- Strict TypeScript
- Tailwind for styling

## Kitsune, remember:
- API runs on localhost:8000
- Don't use lodash
- I'm a beginner, explain everything step by step
```

---

## Contributing

Issues and PRs are welcome. If you're adding something big, open an issue first so we can discuss.

---

## License

MIT © 2025 Momiji IDE · Haikal Hakim Baiqunni
