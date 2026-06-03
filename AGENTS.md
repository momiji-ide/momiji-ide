# AGENTS.md — Momiji IDE Handover for AI Coding Agents

> **Read this entire file before making ANY changes.** It captures hard-won architectural decisions, conventions, and traps from months of development. Following it keeps the codebase coherent; ignoring it will silently break things in ways that are hard to debug.

This document is for any AI coding agent (Antigravity, Claude Code, Cursor, Copilot, etc.) working in this repo.

---

## 0. About this project

**Momiji IDE** is an Electron-based desktop code editor with a built-in AI assistant called **Kitsune** 🦊. It is owned and maintained by a solo developer. Current version: **v1.3.1**.

It's not a generic VS Code clone — it has three opinionated "creative coding" surfaces that share state:

- **Code Editor** (Monaco) — the main code surface.
- **Block Editor** (Blockly) — visual block coding with bidirectional sync to JS/Python text code. Default mode is `code-primary`.
- **Flow Editor** (React Flow) — node-graph visual programming that generates JS/Python.

Plus: Kitsune AI (multi-provider), Algorithm Animator, Quest/learning system, Creative Hub playground, license-gated Pro tier.

---

## 1. HARD RULES — Do Not Break These

These have caused real bugs or business problems. Treat them as invariants.

### 1.1 Privacy / GitHub hygiene

**Never commit, push, or even reference these files in PRs:**

| Path | Why |
|---|---|
| `Improvement From Claude AI/` | Private internal docs |
| `MOMIJI_CONTEXT_FOR_CLAUDE_CODE.md` | Internal AI context, must stay local |
| `PRODUCT_HUNT_LAUNCH_KIT.md` | Pre-launch marketing material |
| `kitsune_animation_demo.html` | Scratch file |
| `KitsuneSpritebreak*` | Old asset experiments |
| Any local `from claudeAI.zip` or similar internal handover archives | Must stay local |
| Anything containing real API keys | Keys are user-supplied and local-only |

The `.gitignore` already lists these — **do not remove them**. If you create a new "scratch" or "notes" file, add it to `.gitignore` first.

### 1.2 The color system is ORANGE, not blue

The CSS variable `--accent-mauve` is `#f97316` (orange). It is the **primary brand color**. This is intentional and was a deliberate migration from blue. Do not "fix" this thinking it's a typo.

- **Never** introduce hardcoded color hex values in components. Always use `var(--xxx)`.
- **Never** reintroduce `var(--accent-blue)` as the primary color.
- Gradients: the brand gradient is orange (`#f97316` → `#ea580c`), not the old `#00CFFF/#7C3AED`.

### 1.3 Blockly JavaScript generator overrides (critical bug zone)

Blockly's default `text_print` generator emits `window.alert(...)` — which **crashes in Node.js** with `ReferenceError: window is not defined`. The code in `BlockEditor.tsx` overrides three generators at module level (lines ~10–41):

```ts
;(javascriptGenerator as any).forBlock['text_print']        = ...console.log(...)
;(javascriptGenerator as any).forBlock['text_prompt_ext']   = ...process.stdout stub
;(javascriptGenerator as any).forBlock['text_prompt']       = ...process.stdout stub
```

**Do not remove these overrides.** If you add support for any other Blockly block that uses `window.*` APIs, override it too. Always wrap the override body in `try/catch` — a thrown error here blanks the entire editor screen.

The correct input name for `text_print` is **`'TEXT'`**, not `'VALUE'`. Confirmed from Blockly 12.x source.

### 1.4 Zustand store key & persistence

The Zustand store is persisted to localStorage under the key `'momiji-store'`. **Do not rename this key** — existing users will lose their settings, recent folders, license keys, and AI provider configs.

When you add a new persisted field:
1. Add it to the `AppStore` interface
2. Add the default to the initial state
3. Add it to `partialize` in the persist config (otherwise it won't survive a reload)
4. If the field replaces a deprecated one, add migration logic in `merge`

The model migration map (`DEPRECATED_MODELS` in `appStore.ts`) is how stale AI model names get upgraded on load — extend it when you deprecate a model, don't just delete the old one.

### 1.5 The `'runner-main'` processId convention

There is one shared "main runner" process across the whole app, identified by the string literal `'runner-main'`. The Output panel, Flow Editor, Block Editor, and the main run button all coordinate through this ID.

If you introduce a second runner, **give it a different processId** and make sure the OutputPanel either listens to both or is duplicated. Do not silently change `'runner-main'` to something else — you'll break the run feedback loop in every editor.

### 1.6 Cross-component communication: window CustomEvents

This app uses `window.dispatchEvent(new CustomEvent(...))` for cross-tree communication instead of prop drilling or a separate event bus. The event names below are part of the public contract — **do not rename without auditing every listener**:

| Event | Purpose |
|---|---|
| `runner:start` | A code-runner is starting. Detail: `{ processId, command, args, cwd, label, fileName }` |
| `runner:exit` | Runner finished. Detail: `{ code }` |
| `bottomPanel:switchTab` | Switch BottomPanel to a specific tab. Detail: `{ tab: 'terminal'\|'output'\|...' }` |
| `editor:markers` | Monaco markers changed (used by Problems panel + Kitsune avatar) |
| `editor:jumpToLine` | Jump active editor to a line. Detail: `{ line }` |
| `flow:updateNode` | Update a Flow node's data field. Detail: `{ id, patch }` |
| `kitsune:avatar` | Tell the avatar widget to change state |

Always add the matching `removeEventListener` in the effect cleanup. Memory leaks here are silent.

### 1.7 License tier is the monetization gate

The fields `licenseKey`, `licenseTier` (`'free' | 'pro' | 'studio'`), `licenseExpiry` in the Zustand store gate Pro features. Activation calls Lemon Squeezy directly from the renderer (no backend server). Checkout URL is hardcoded:

```
https://momiji-ide.lemonsqueezy.com/checkout/buy/495febcd-8f43-44cc-9fab-7cd2896874a5
```

The `ModelSelector` and `LicensePanel` read `licenseTier` to decide what to lock. **Do not** add a feature gate without going through this field — never check, say, `process.env` or a hardcoded boolean.

---

## 2. Tech Stack (exact versions)

- **Electron** 31.x (`electron-vite` 2.x for build, `electron-builder` for packaging)
- **React** 18.3, **TypeScript** 5.5, **Vite** 5.3
- **Tailwind CSS** 3.4 + CSS variables (see §3)
- **Monaco Editor** 0.50 via `@monaco-editor/react` 4.6
- **Blockly** 12.5 (block editor)
- **React Flow** via `@xyflow/react` 12.10 (flow editor)
- **Zustand** 4.5 with `persist` middleware
- **xterm.js** 6.0 (terminal)
- **node-pty** 0.10 (PTY backend for terminal)

Three processes: `src/main/` (Electron main), `src/preload/` (IPC bridge — exposes `window.api`), `src/renderer/` (React UI).

Scripts: `npm run dev` (electron-vite dev), `npm run build`, `npm run dist` (full installer build).

---

## 3. Design System

### 3.1 CSS variables

All colors come from CSS variables defined in `src/renderer/src/index.css` (or equivalent). The canonical names:

| Variable | Meaning |
|---|---|
| `--accent-mauve` | **Primary brand color (ORANGE `#f97316`)** — used for active states, highlights, CTAs |
| `--accent-green` | Success / run-button green |
| `--accent-red` | Errors, destructive actions, stop |
| `--accent-yellow` | Warnings, running indicators |
| `--bg-base` | Deepest background |
| `--bg-mantle` | Toolbars, headers (slightly lighter) |
| `--bg-crust` | Output/code background (darker than base) |
| `--bg-surface0`, `--bg-surface1`, `--bg-surface2` | Progressive surface layers for buttons, hovers |
| `--text`, `--text-muted`, `--text-subtle` | Text hierarchy |
| `--border` | All borders |

**Always** use `var(--xxx)`. **Never** hardcode `#89b4fa`, `#f97316`, etc. inside JSX — even if it matches a variable today. Theme switching (`'dark'` vs `'light'`) flips the variables; hardcoded values break it.

### 3.2 Typography & layout

- Body font is the system default; code/mono uses `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`.
- `settings.fontSize` (default 14) and `settings.fontFamily` are user-configurable from the Settings panel — **always** read them via `useAppStore` when rendering code, never hardcode.
- Tailwind utility classes are used heavily for layout. Inline `style={{ background: 'var(--xxx)' }}` is used for theme-driven colors (Tailwind doesn't know about the CSS variables).

### 3.3 Component patterns

- Functional components with hooks only. No class components.
- Toast feedback for every user action — `import { toast } from '../../utils/toast'` and call `toast.success/info/warning/error(...)`. Don't use `alert()`, `confirm()`, or `prompt()`.
- Icon convention: emoji in UI is encouraged (the app has a friendly, mascot-driven personality). Logo is `🦊` (fox). Run is `▶`. Stop is `■`. Templates is `📋`. Settings is `⚙️`.
- Buttons use `var(--accent-mauve)` for primary actions, `var(--bg-surface0)` for secondary, `var(--accent-green)` for Run, `var(--accent-red)` for Stop.

### 3.4 Emoji policy in code

The project uses emoji in user-facing strings, toolbar labels, and template names. This is intentional brand voice. **Don't strip them in a "cleanup" pass.** However: do not add emoji to comments, log messages, or code that isn't user-visible.

---

## 4. Architecture

### 4.1 Three-process boundary

```
main (src/main/index.ts)
  ├─ exposes IPC handlers: fs.readFile, fs.writeFile, process.run, process.kill, ...
  └─ owns the PTY (terminal), filesystem, child processes

preload (src/preload/)
  └─ contextBridge → window.api { fs, process, dialog, ... }

renderer (src/renderer/src/)
  └─ React app, never touches Node.js APIs directly
```

The renderer **must not** import `fs`, `child_process`, `path`, etc. Always go through `window.api.*`. If you need a new capability, add it in main, expose via preload, type it in `src/preload/index.d.ts`, then consume.

### 4.2 Folder layout

```
src/renderer/src/
├── App.tsx                       — root layout, restores last folder on mount
├── store/appStore.ts             — Zustand global store (THE source of truth)
├── types/                        — shared TypeScript types
├── utils/
│   ├── toast.ts                  — toast notifications
│   ├── callKitsune.ts            — multi-provider AI call wrapper
│   ├── codeRunner.ts             — ANSI → HTML, code execution helpers
│   ├── codeToBlockly.ts          — zero-dep JS parser → Blockly XML (bidirectional sync)
│   ├── flowCodeGen.ts            — Flow graph → JS/Python code
│   ├── languageDetect.ts         — filename → Monaco language
│   └── templates.ts              — code templates
└── components/
    ├── AI/                       — Kitsune chat, ModelSelector (Copilot-style dropdown)
    ├── ActivityBar/              — left-most icon bar + Kitsune avatar widget
    ├── BlockEditor/              — Blockly + bidirectional Monaco sync
    ├── BottomPanel/              — Terminal, Output, Problems, Scripts, Preview tabs
    ├── Debugger/                 — Time-travel + AlgorithmAnimator
    ├── Editor/                   — Monaco wrapper with custom themes (momiji-dark, momiji-light)
    ├── FlowEditor/               — React Flow + code generation + templates
    ├── Playground/               — Canvas, Colors, Easing, Shader, Sprite slicer (CreativeHub)
    ├── Settings/                 — AISettings, LicensePanel, SettingsPanel
    ├── Sidebar/                  — File tree, search, debug, git, todo/quests
    ├── TitleBar/                 — Window controls + license tier badge
    └── Todo/                     — Quest system (gamified learning)

src/main/index.ts                 — Electron main, IPC handlers
src/preload/                      — contextBridge → window.api
```

### 4.3 State management

**One Zustand store**, in `src/renderer/src/store/appStore.ts`. Everything global goes there: folder, tabs, settings, AI providers, custom agents, license, recent folders, pending AI prompts.

Local component state stays local. Don't lift state to Zustand unless multiple unrelated components need it.

**Partializing:** only the fields listed in `partialize` survive a restart. The full list today:

```
settings, aiProviders, customAgents, sidebarWidth, showSidebar,
bottomPanelHeight, currentFolder, recentFolders,
licenseKey, licenseTier, licenseExpiry
```

If you add new "user preferences", add them to partialize. If you add transient state (like a loading flag), don't.

### 4.4 The three editor surfaces share patterns

All of BlockEditor, FlowEditor, and the main Editor:
- Generate code into a `code` state variable
- Dispatch `runner:start` with `processId: 'runner-main'`
- Call `await window.api.process.run('runner-main', command, args, cwd)`
- Subscribe to `window.api.process.onStdout/onStderr/onExit` for output
- Show their own **inline output panel** (Block: below Monaco, Flow: right-panel tab) so the user doesn't need to find the bottom panel

When adding a fourth surface, **copy this pattern**. Don't invent a new IPC convention.

---

## 5. Common Tasks — How to Do Them Right

### 5.1 Add a new AI provider

1. Add an entry to the `aiProviders` array in `appStore.ts` defaults.
2. Add a case in `src/renderer/src/utils/callKitsune.ts` if its API is non-OpenAI-compatible.
3. The unified `ModelSelector` will pick it up automatically if you add the model(s) to `ALL_MODELS`.
4. Update `DEPRECATED_MODELS` migration map if any old IDs need redirecting.

### 5.2 Add a new Blockly block to a template

Templates in `BlockEditor.tsx` are built programmatically with `ws.newBlock(...)`. Each template is `{ id, name, icon, desc, load: (ws) => void }`. The pattern:

```ts
const block = ws.newBlock('block_type')
block.initSvg(); block.render()
block.setFieldValue('value', 'FIELD_NAME')
block.getInput('INPUT_NAME')?.connection?.connect(otherBlock.outputConnection!)
parent.nextConnection?.connect(child.previousConnection!)  // statement chain
```

If a template uses `text_print`, `text_prompt_ext`, or `text_prompt`, the overrides in §1.3 already handle it. If the template uses a different `window.*`-emitting block, override that generator too.

Input names matter — `text_print` is `'TEXT'`, `controls_ifelse` uses `'IF0'`/`'DO0'`/`'ELSE'`, `lists_create_with` uses `'ADD0'`/`'ADD1'`/... (mutate `itemCount_` and call `updateShape_()` for variable arity).

### 5.3 Add a new Flow Editor node type

1. Add a memoized component in `FlowEditor/FlowNodes.tsx` using the existing `NodeShell` wrapper.
2. Add the type to `NODE_TYPES`, `NODE_PALETTE`, and `DEFAULT_NODE_DATA`.
3. Extend `FlowNodeData` in `utils/flowCodeGen.ts` with any new data fields.
4. Add a `case` in `flowCodeGen.ts`'s `traverse()` switch — handle both `lang === 'python'` and `lang === 'javascript'`.

Use `console.log(...)` for JS output, `print(...)` for Python. Never `window.alert`.

### 5.4 Add a setting

1. Add to `EditorSettings` type.
2. Add to `defaultSettings` in `appStore.ts`.
3. Render a control in `SettingsPanel.tsx` that reads/writes via `updateSettings({ ... })`.
4. Workspace overrides: include in `saveWorkspaceSettings()` if it's project-specific.

### 5.5 Run code from a new place

```ts
const fname = `something.${ext}`
const tmpPath = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/${fname}`
await window.api.fs.writeFile(tmpPath, code)
window.dispatchEvent(new CustomEvent('runner:start', {
  detail: { processId: 'runner-main', command, args: [tmpPath], cwd: currentFolder ?? '', label: fname, fileName: fname }
}))
await window.api.process.run('runner-main', command, [tmpPath], currentFolder ?? '')
```

Don't bypass the event dispatch — the OutputPanel and Kitsune error-explainer key off it.

### 5.6 Commit messages

Style: `<type>: short imperative summary` then blank line, then body. Types observed: `feat`, `fix`, `chore`, `docs`. Body is bullet points or short paragraphs explaining **why**, not just what.

Always co-author commits made by an AI agent. Example:

```
feat: add inline output panel to Flow Editor

Auto-switches to output tab when ▶ Run is clicked so the user
doesn't need to open the bottom panel.

Co-Authored-By: <Agent Name> <noreply@example.com>
```

**Never commit** with `--no-verify` or `--no-gpg-sign` unless explicitly asked. **Never** force-push to `main`.

---

## 6. Anti-patterns — Things That Have Caused Bugs

| Anti-pattern | What happened | Right way |
|---|---|---|
| Hardcoding `#f97316` in JSX | Theme switch broke | `var(--accent-mauve)` |
| Removing `'TEXT'` for `'VALUE'` in Blockly override | Whole BlockEditor blank-screened | Always `'TEXT'` for `text_print` |
| Adding `currentFolder` outside `partialize` | Folder reset on every restart | Add to `partialize` |
| Putting `no-drag` on every titlebar child | Window couldn't be dragged | Only mark interactive children `no-drag` |
| Setting Block editor default sync to `blocks-primary` | Monaco read-only, users couldn't type | Default is `code-primary` |
| Skipping `removeEventListener` in cleanup | Memory leaks, double handlers after HMR | Always return cleanup from `useEffect` |
| Polling for AI provider list every render | Re-fetched models infinitely | Cache in store, refresh on user action |
| Using `window.alert/prompt/confirm` | Crashes in Node runtime | Use `toast.*` and custom dialogs |
| Inventing a new processId per editor | OutputPanel didn't see the output | Use `'runner-main'` |
| Renaming the Zustand store key | Users lost all settings on update | Never rename `'momiji-store'` |
| Tagging before bumping `package.json` version | v1.3.1 release shipped with installer named `1.3.0.exe` → auto-update broken | Bump → commit → push → THEN tag |
| Omitting `latest*.yml` from CI upload glob | Auto-updater couldn't find new versions even though releases existed | Keep `latest.yml`, `latest-mac.yml`, `latest-linux.yml` in `release.yml` upload patterns |
| Using `--publish never` without uploading YAML | Same as above — metadata files never reach the Release | Either `--publish always` + `GH_TOKEN`, OR `--publish never` + manual YAML upload |

---

## 7. Things That Look Wrong But Are Intentional

- **`--accent-mauve` is orange, not mauve.** Legacy name from a theme migration. Don't rename — too many references.
- **The Block Editor defaults to `code-primary` sync mode.** Users wanted to type code freely; blocks-primary made Monaco read-only and confused everyone.
- **Templates are built programmatically, not as XML strings.** Blockly's XML format is verbose and brittle across versions. Programmatic builds survive Blockly upgrades better.
- **The `<<autonomous-loop>>` / `<<autonomous-loop-dynamic>>` sentinels** in any cron/schedule code are not strings to replace — they are resolved by the runtime.
- **Custom events instead of context/redux** for cross-tree comms — keeps individual components decoupled and easier to delete.
- **License validation calls Lemon Squeezy directly from the renderer.** No backend proxy. This is fine because the API key is the user's license key, not a secret server credential.
- **Indonesian-language toasts and comments occasionally appear** because the primary user is Indonesian. Match the existing language in a file rather than translating.

---

## 8. Build, Release, Distribution

- **Dev:** `npm run dev` (electron-vite dev with HMR)
- **Build renderer + main:** `npm run build`
- **Full installer:** `npm run dist` (electron-builder, outputs to `release/`)
- **CI:** GitHub Actions builds on **git tag push** (`v*`), not on every commit to `main` — see `.github/workflows/release.yml`
- **Auto-update:** `electron-updater` checks GitHub Releases for new `latest.yml`

### 8.1 The correct release procedure (DO NOT SKIP STEPS)

This procedure was hardened after the v1.3.1 auto-update bug (see §6). Follow it exactly:

```
1. Bump version in package.json
2. Update docs/index.html (badges + download URLs match new version)
3. git commit -m "chore: bump to vX.Y.Z + update download links"
4. git push origin main          ← MUST be on main first
5. git tag -a vX.Y.Z -m "..."    ← tag AFTER the bump commit
6. git push origin vX.Y.Z        ← triggers CI
7. Wait ~20-30 min for CI to build all 3 platforms
8. Verify the GitHub Release contains BOTH:
   - Installers (.exe, .dmg, .AppImage, .deb)
   - Metadata YAML (latest.yml, latest-mac.yml, latest-linux.yml)  ← CRITICAL
```

**If you tag before bumping `package.json`**, the CI will build with the *old* version number — the installer will be named `Momiji-IDE-Setup-1.3.0.exe` even though the tag says `v1.3.1`. Auto-update silently breaks because electron-updater compares package.json version to `latest.yml` version.

### 8.2 Auto-update requirements

For `electron-updater` to detect a new version, the GitHub Release **must** contain:

| File | Platform | What it does |
|---|---|---|
| `latest.yml` | Windows | Tells the updater current version + checksum |
| `latest-mac.yml` | macOS | Same, for macOS |
| `latest-linux.yml` | Linux | Same, for Linux |
| `*.blockmap` | All | Enables delta updates (smaller downloads) |

These files are generated by `electron-builder` during `npm run dist`. The CI workflow uploads them via `softprops/action-gh-release` — see the `files:` glob in `release.yml`. **Do not remove these patterns** or auto-update breaks again.

### 8.3 Recovery if a release is broken

If a release goes out broken (wrong version, missing YAML, etc.):

```bash
git tag -d vX.Y.Z                       # delete local tag
git push origin :refs/tags/vX.Y.Z       # delete remote tag
# This also deletes the GitHub Release (because softprops creates them tied to tags)

# Fix the underlying issue (bump version, fix workflow, etc.), then:
git tag -a vX.Y.Z -m "..."              # re-tag at the corrected HEAD
git push origin vX.Y.Z                  # re-trigger CI
```

**Heads-up:** users who already installed the broken version may not be able to auto-update to the fixed one (because their installed binary references a `latest.yml` that never existed). They'll need to download the new installer manually once. After that, future updates work.

---

## 9. Working Style with This User

Brief notes for the agent on how the owner prefers collaboration:

- **Indonesian + English mix.** Respond in the same language register the user uses. Casual Indonesian with code-switch is normal.
- **Don't ask permission for obvious follow-ups.** Just do the work, then summarize.
- **Show diffs / changed files**, not pasted full files, after edits.
- **Skip preamble.** No "Sure, I'd be happy to..." — get to the point.
- **The user often signs off in Indonesian slang** (`gas`, `wkwk`, `mantab`). Don't read these as commands — they're conversational.
- **The user values speed over completeness.** Ship a working slice, then iterate. Don't propose a 5-phase refactor when a 10-line patch will do.

---

## 10. When in Doubt

1. **Read `src/renderer/src/store/appStore.ts` first.** Most "where does X live" questions are answered there.
2. **Grep for the event name or CSS variable** before refactoring — there are usually 5+ consumers.
3. **Run `npm run dev` and try the change in the app** before declaring it done. Type-checking passes ≠ feature works.
4. **If something blank-screens**, open DevTools console first — most bugs are React errors from a typo'd prop or a thrown Blockly/Monaco call.
5. **If you're about to rename, delete, or move something with a literal string ID** (event names, processIds, store keys, CSS variables), stop and audit all references first.

---

---

## 11. Current Roadmap & Pending Work

This is what's actively in flight as of v1.3.1. Don't refactor these areas blindly — there's probably half-finished work tied to them. If you're picking up one of these, do the smallest viable slice and verify in the app.

### 11.1 Launch & marketing (in progress)

- **Demo video** (30 sec): the wow moment is block ↔ code bidirectional sync in BlockEditor. Other strong candidates: Flow Editor templates loading, Kitsune auto-fix on error.
- **Reddit posts**: drafts targeted at r/learnprogramming, r/gamedev, r/webdev. Tone is friendly/educational, not salesy.
- **Product Hunt submission**: planned for a Tuesday launch (12 AM PST). The `PRODUCT_HUNT_LAUNCH_KIT.md` (local-only, never push) has assets and copy.
- **Landing page** (`docs/index.html`): version badges, download links, and pricing table must match `package.json` version + Lemon Squeezy product IDs. When bumping version, update both in the same commit.
- **Existing user migration notice** (pending): users on v1.2 cannot auto-update to v1.3.1 because v1.2 binaries shipped without proper `latest.yml` plumbing. They need a one-time manual reinstall. Consider a website banner / Discord post / in-app prompt before PH launch.

### 11.2 Education / STEM expansion (planned)

User wants to position the Block Editor as a STEM-learning tool for kids, including a robotics angle.

- **Robotics/Arduino/micro:bit block category** — would need a new Blockly toolbox section + generator overrides that emit Arduino C++ or MicroPython instead of generic JS/Python. **Not started.** If you start this, treat it as a fourth generator alongside `javascriptGenerator` and `pythonGenerator` — don't try to shoehorn it into the existing two.
- **Quest System** (`components/Todo/QuestPanel.tsx`) — 14 quests, 4 tracks, level/XP system. Adding a robotics track here would be the most natural integration point.
- **Advanced templates** for both BlockEditor and FlowEditor — recent batch added FizzBuzz, Dice Roll, Temp Converter, Player Movement, Grade Calculator, Fibonacci. More templates welcome; follow the existing programmatic build pattern (see §5.2).

### 11.3 Monetization (live but evolving)

- The Free/Pro/Studio tier system is **live** (Lemon Squeezy). License validation calls LS directly from the renderer — see §1.7.
- **Future:** a thin backend proxy for license validation would let us add server-side feature gates (e.g., cloud sync, team workspaces) without bundling them into the desktop binary. Don't build it speculatively — wait until there's a Studio-tier feature that actually needs it.
- The `ModelSelector` (`components/AI/ModelSelector.tsx`) is the gate UI — 🔒 icons + "Upgrade" badges read from `licenseTier`.

### 11.4 Known gaps / nice-to-haves

These have been discussed but not committed to:

- **Bidirectional sync for Python** in BlockEditor (currently JS-only — `codeToBlockly.ts` is a hand-written JS parser).
- **Plugin/extension marketplace** (`components/Extensions/` exists as a stub).
- **Multi-cursor / vim mode** in Monaco beyond defaults.
- **Cloud sync of settings/workspace** (Studio tier feature, needs backend).
- **Better Live Preview** (`BottomPanel/LivePreview.tsx`) — current version is basic.

### 11.5 What to leave alone unless asked

- The custom Monaco themes `momiji-dark` / `momiji-light` are tuned to match the orange palette. Don't override them with the default vs-dark/vs-light.
- The `KitsuneAvatarWidget` state machine (idle/error/success/thinking/proactive) is wired to the runner and Monaco markers — replacing it with a generic loader breaks personality.
- The `restoreLastFolder()` flow in `App.tsx` mount — handles the "last folder no longer exists" case silently. Don't add a blocking error dialog there.
- The `'momiji:flow:workspace'` / `'momiji:blockly:workspace'` localStorage keys for save/load slots — keep these names or migrate cleanly.

---

---

## 12. Change Log of This File

Each time you make a non-trivial change to the codebase or fix a class of bug worth remembering, append an entry here. Keep it short — one line, dated, attributing the agent. This is the audit trail that prevents the same bugs from recurring across agent handovers.

Format: `YYYY-MM-DD | <agent name> | <one-line summary> | <sections touched>`

```
2026-05-25 | Claude Sonnet 4.6 | Initial AGENTS.md handover, v1.3.1 era | all sections (initial)
2026-05-25 | Claude Sonnet 4.6 | Documented v1.3.1 auto-update bug + correct release procedure | §6, §8, §11.1
2026-05-25 | Claude Sonnet 4.6 | Re-released v1.3.1 with correct latest.yml plumbing — auto-update functional from this version onward | (no doc change, status update)
2026-05-25 | Claude Sonnet 4.6 | Added RELEASE_NOTES_v1.3.1.md + migration banner in docs/index.html for v1.2 users who can't auto-update | docs/, release notes
2026-05-25 | Antigravity (Google) | Added STEM robotics Blockly blocks, secondary AI sidebar dock, TitleBar layout toggles, Windows process kill fix (taskkill /F /T), Three.js dep | BlockEditor.tsx, TitleBar.tsx, appStore.ts, main/index.ts
2026-05-25 | Claude Sonnet 4.6 | Full RobotSimulator.tsx rewrite — 5 arena presets (Oval/Figure-8/Sumo/Maze/Custom), track painter, robot drag, multiple obstacles, sonar cone visualization, mission lap counter, 3D camera orbit+zoom | RobotSimulator.tsx
2026-05-25 | Claude Sonnet 4.6 | Fix 3D pitch black (setTimeout layout defer) + 🤖 Arena always-visible toggle | RobotSimulator.tsx, BlockEditor.tsx
2026-05-25 | Claude Sonnet 4.6 | Markdown preview upgrade — marked parser, GFM, copy buttons, view mode toggle (Edit/Split/Preview), resizable split, formatting toolbar, scroll sync, HTML export | MarkdownPreview.tsx, CodeEditor.tsx
2026-05-25 | Claude Sonnet 4.6 | Hardware export — Micro:bit MicroPython + Arduino C++ transpiler, HardwareExportPanel with pin guide, download button | hardwareExport.ts, HardwareExportPanel.tsx, BlockEditor.tsx
```

**Note on stale release assets:** When you delete and re-push a git tag, the GitHub Release sometimes retains the previously-uploaded assets even though the tag is "new". The v1.3.1 release ended up with both 1.3.0-named files (from the broken first build) and 1.3.1-named files (from the fixed build). `latest.yml` correctly references only the 1.3.1 file, so auto-update works — but manual cleanup via the GitHub web UI is needed to keep the release page tidy. To avoid this in the future, delete the GitHub Release explicitly (not just the tag) before re-pushing.

---

_Maintainers: keep this file in sync as conventions evolve and as roadmap items ship. Move completed §11 items into §6 (anti-patterns) or §5 (how-to) so future agents learn from them. Append to §12 every time you touch the architecture, fix a class of bug, or change a convention._
