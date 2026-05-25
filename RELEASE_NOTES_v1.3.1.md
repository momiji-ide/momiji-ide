# Momiji IDE v1.3.1 🍁

> Polish release — new templates, inline run output, and Kitsune teaching you better. Plus critical fixes.

## ⚠️ Important for v1.2.x users

**Auto-update from v1.2.x to v1.3.1 will not work.** Earlier builds shipped without proper update metadata, so your installed app can't see this release.

👉 **One-time fix:** download v1.3.1 manually from the [website](https://momiji-ide.github.io/momiji-ide) or this Releases page. Your settings, projects, and AI provider keys all carry over — no reconfiguration needed.

After this one manual install, every future update (v1.3.2, v1.4, etc.) will land automatically.

---

## What's new

### 📋 Templates for Flow Editor (finally!)
Click the **📋 Templates** button in the Flow toolbar. Four ready-to-run examples:

- **🎮 Player Movement** — variables, input check, position update
- **⚡ FizzBuzz** — classic loop with nested conditions
- **📊 Grade Calculator** — multi-branch condition chain
- **🔢 Fibonacci Sequence** — loop that accumulates the sequence

Each loads as a fully-connected node graph with color-coded edges (green = true branch, red = false branch, teal = loop body).

### 📋 Four new advanced templates in Block Editor
Brings the total to **9 templates**, expanding past the beginner set:

- **🌡️ Temp Converter** — Celsius → Fahrenheit formula, pure math chain
- **🎲 Dice Roll Game** — random + variable + if/else win/lose
- **⚡ FizzBuzz** — for loop with nested if/else mutators
- **📋 List Operations** — create a list, get length and first item

### ▶ Inline run output — no more hunting for the bottom panel
Both Block and Flow editors now show **run output directly inside the editor**.

- **Flow Editor:** new Code/Output tab in the right-side panel. Auto-switches to Output when you click ▶ Run.
- **Block Editor:** output panel appears below the Monaco code editor on run start.

Color-coded: stdout (white), stderr (red), system messages (italic gray). Live elapsed timer. Status dot in the tab (yellow = running, green = success, red = error).

### 🤖 AGENTS.md — handover guide for AI coding agents
New file at the project root documents architectural invariants, design system, conventions, and gotchas for any AI coding agent working in this repo (Claude Code, Cursor, Copilot, Antigravity, etc.). Includes:

- Hard rules (color system, store keys, event names — don't break these)
- The 7-step release procedure (avoid the v1.3.1 auto-update bug we hit)
- Anti-patterns table with real bugs and their fixes
- Change log audit trail

---

## Fixes

### 🐛 Block Editor blank-screen crash (CRITICAL)
Blockly's default JavaScript generator emits `window.alert(...)` for the `text_print` block. This **crashed every run** with `ReferenceError: window is not defined` because the runtime is Node.js, not a browser. Fixed by overriding `text_print`, `text_prompt_ext`, and `text_prompt` generators with Node-safe equivalents (`console.log`, `process.stdout.write`).

### 🐛 Templates briefly used wrong Blockly input name
Internal generator override used `'VALUE'` (incorrect) instead of `'TEXT'` (correct per Blockly 12.x source). Every block change re-threw the same error, blanking the editor. Fixed and wrapped all overrides in `try/catch` so a future typo can't blank-screen the whole component.

### 🐛 Auto-update detection (the reason for the v1.2 migration notice above)
CI workflow was uploading installers but not the `latest.yml` metadata files that `electron-updater` needs to detect new versions. Workflow now uploads `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, and `.blockmap` files alongside installers.

---

## Under the hood

- 5 new commits since v1.3.0: templates, inline output, Blockly fix, CI fix, AGENTS.md
- AGENTS.md is now part of the repo — try-catch hardened generator overrides, structured changelog
- CI release procedure now documented end-to-end so future bumps don't lose update metadata

---

## Download

- **Windows:** [Momiji-IDE-Setup-1.3.1.exe](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.1/Momiji-IDE-Setup-1.3.1.exe)
- **macOS (Apple Silicon):** [Momiji-IDE-1.3.1-arm64.dmg](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.1/Momiji-IDE-1.3.1-arm64.dmg)
- **macOS (Intel):** [Momiji-IDE-1.3.1-x64.dmg](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.1/Momiji-IDE-1.3.1-x64.dmg)
- **Linux:** [Momiji-IDE-1.3.1.AppImage](https://github.com/momiji-ide/momiji-ide/releases/download/v1.3.1/Momiji-IDE-1.3.1.AppImage)

---

🦊 Thanks for using Momiji IDE. Issues / feedback: [GitHub Issues](https://github.com/momiji-ide/momiji-ide/issues).
