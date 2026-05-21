# Momiji IDE v1.3.0 🍁

> The biggest update yet. Phase 2 feature set — the features that make Momiji genuinely unique.

## What's new

### ⟳ Block ↔ Code Bi-directional Sync
The "magic moment" feature. Drag a block → JavaScript appears. Edit the JavaScript → the block updates automatically.

Three sync modes (cycle with the toolbar button):
- **⟳ Live** — blocks control the code output in real time
- **✏️ Edit** — type freely in code, then click `↑ Sync to Blocks` when ready
- **⟳ Auto-sync** — code changes automatically parse back to blocks (350ms debounce)

Built a zero-dependency recursive descent JS parser from scratch that covers variables, for/while loops, if/else, arithmetic, comparisons, logic, and function definitions — the complete subset that Blockly itself generates. Includes a coverage metric so you know when advanced patterns were skipped.

### 🦊 Kitsune Avatar — Reactive Emotional States
A small Kitsune character in the bottom of the ActivityBar that reacts to your code state:

| State | Trigger | Behavior |
|---|---|---|
| 😵 Error | Monaco error markers | Wiggles. Click to open Problems panel. |
| 🎉 Success | Code runs with exit code 0 | Jumps. Auto-returns to idle after 4s. |
| 🤔 Thinking | AI processing / code running | Wiggle with purple glow |
| 💡 Proactive | Idle for 10+ minutes | Cyan glow. Click to send a tip to Kitsune. |

Hover for mood tooltip. Wired to Monaco error events, process exit events, and AI request state.

### 🎬 Algorithm Animator
Step-through visualization of code execution, in the Debug panel (🎬 Animator tab):
- Click **Analyze Active File** to capture step frames from any open file
- **Variable tracker** — shows all `let`/`const`/`var` values at each step
- **Array visualizer** — animated bar chart for numeric arrays, box view for mixed
- **Loop detection** — auto-generates step frames for `for` loops
- **Playback controls** — Play/Pause, Step fwd/back, Skip to start/end
- **Speed slider** — Fast / Normal / Slow
- Active line highlight (orange left border) synced to current step

### 🗺️ Coding Quests + XP System
New tab inside the TODO panel (🗺️ Quests):
- **14 quests** across 4 tracks: Game Dev 🎮, Web 🌐, Python 🐍, General ⚙️
- **Level system** — Baby Coder → Code Apprentice → Builder → Developer → Architect → Grand Master
- **"Check My Code"** — auto-verifies your active editor file against quest success pattern
- **"Ask Kitsune"** — sends a context-aware hint to the AI panel
- XP progress bar with animated fill, persistent across sessions
- Quest completions logged to `.momiji/kitsune-memory.md`
- Avatar reacts to quest results (success = jump, fail = error state)

## Other improvements
- All UI accent colors unified to orange (`--accent-mauve`) — no more random cyan/blue highlights
- New Kitsune logo (`iconkitsune.png`) across ActivityBar, Onboarding, and About dialog
- ActivityBar icon hover/active states now use orange glow
- Onboarding button gradients updated to orange
- Custom OpenAI-compatible API endpoint support (Settings → AI)
- Kill terminal button (⊘ Ctrl+C) keeps tab open
- Voice-to-Code text fallback mode

## Downloads

| Platform | File |
|---|---|
| Windows | `Momiji-IDE-Setup-1.3.0.exe` |
| macOS (Apple Silicon) | `Momiji-IDE-1.3.0-arm64.dmg` |
| macOS (Intel) | `Momiji-IDE-1.3.0-x64.dmg` |
| Linux | `Momiji-IDE-1.3.0.AppImage` |

---

**Full changelog:** https://github.com/momiji-ide/momiji-ide/commits/main
