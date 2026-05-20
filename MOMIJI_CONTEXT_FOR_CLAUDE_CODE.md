# Momiji IDE — Full Context & Development Roadmap
> Generated from product strategy session. Feed this to Claude Code for full context.

---

## 1. Project Overview

**Momiji IDE** is an AI-native creative coding studio — not just a code editor.
Built with **Electron + React + Monaco Editor**.
Current version: **v1.2.0** (live, cross-platform, free).
Homepage: https://momiji-ide.github.io/momiji-ide

### Core Positioning
> "The AI-native creative studio where anyone can build games, apps, and tools —
> from their first block to production-ready code."

Not competing with VS Code or Cursor.
Competing in a **new arena**: beginner → pro progression platform for creative developers.
The "Canva for software creation" — wins by enabling non-coders, not by converting senior devs.

### Tech Stack
- **Shell**: Electron
- **UI**: React
- **Editor**: Monaco (VS Code engine)
- **Block coding**: Blockly
- **AI**: Multi-provider via BYOK (Claude, Gemini, GPT-4o, Groq, OpenRouter, DeepSeek, Mistral, Ollama)
- **AI companion**: Kitsune AI (custom persona + routing layer)

---

## 2. Target Users

| Persona | Description |
|---|---|
| 🧒 Students & Kids | First-time coders, learn via blocks, guided by Kitsune |
| 🎮 Game Developers | Indie devs, visual flow + code, fast iteration |
| 🎨 Designers & Animators | Non-coders, automate creative pipelines |
| ⚡ Developers | Full Monaco + Kitsune AI + 7 agents |
| 🏢 Teams & Studios | Collaboration, custom Kitsune persona |

---

## 3. Current Features (v1.2.0)

### Editor
- [x] Monaco core (VS Code engine), IntelliSense, 50+ languages
- [x] Block mode (Blockly drag-and-drop)
- [x] Flow mode (node-graph visual editor)
- [x] Command palette (Ctrl+P fuzzy search)
- [x] Live color picker (click hex/rgb/hsl values)
- [x] Code screenshot generator
- [x] Snippet manager
- [x] TODO scanner

### Kitsune AI
- [x] 8 provider support: Claude, Gemini, GPT-4o, Groq, OpenRouter, DeepSeek, Mistral, Ollama
- [x] 7 built-in agents: Code Reviewer, Test Writer, Doc Writer, Security Auditor, Refactor Assistant, Bug Hunter, Custom
- [x] Vision support (paste screenshots)
- [x] Project memory via `.momiji/kitsune-memory.md`
- [x] Live token analytics
- [x] BYOK model (keys stored locally, never sent to Momiji servers)

### Developer Tools
- [x] Git integration (stage, commit, diff, inline blame, AI commit messages)
- [x] SQLite Explorer
- [x] HTTP Client
- [x] Package Manager (npm, pip, cargo)
- [x] Regex Playground
- [x] Canvas Playground
- [x] Universal file viewer (PDF, images, hex/binary, 25+ formats)
- [x] Sandbox environment

---

## 4. Feature Roadmap & What Needs to Be Built

### PHASE 1 — Ship Now (0–3 months)
> All pure prompt engineering. Zero new infra. Can ship in 1–2 weeks.

---

#### FEATURE 01: Kitsune Explain Mode — 3 Personas
**Priority: HIGHEST. Ship first.**

**What it is:**
Toggle between 3 explanation styles. Same question, completely different answer.

| Persona | Tone | Analogies | Detail level |
|---|---|---|---|
| 🧒 Beginner/Anak | Warm, encouraging | Daily life (box, machine) | Minimal, step by step |
| ⚡ Developer | Technical, direct | None needed | Full, no hand-holding |
| 🎨 Creative/Game Dev | Visual, contextual | Photoshop, Unity, Blender | Medium, tools-focused |

**How to implement:**
1. Add persona selector UI in Kitsune panel (3 toggle buttons or dropdown)
2. Store selection in `.momiji/kitsune-memory.md` as `kitsune_persona: beginner|developer|creative`
3. Prepend persona system prompt to EVERY Kitsune request

**System prompts:**

```
// BEGINNER persona
"You are Kitsune, a friendly AI companion in Momiji IDE.
The user is a beginner or child. Rules:
- Always use real-world analogies (toys, food, everyday objects)
- Never use jargon without explaining it first
- Keep sentences short (max 2 lines per paragraph)
- Celebrate small wins before suggesting improvements
- End every explanation with one simple thing they can try next
- If they make an error, say 'Oops!' not 'Error:'"

// DEVELOPER persona  
"You are Kitsune, an AI pair programmer in Momiji IDE.
The user is an experienced developer. Rules:
- Be direct and precise, no hand-holding
- Use correct technical terminology
- Skip analogies unless asked
- Focus on edge cases, performance, and best practices
- Suggest idiomatic patterns for the language being used
- Keep responses concise — they can ask follow-ups"

// CREATIVE persona
"You are Kitsune, a creative coding companion in Momiji IDE.
The user is a designer, animator, or game developer.  Rules:
- Frame everything in terms of visual outcomes and creative tools
- Reference familiar tools: Unity, Godot, Blender, Photoshop, After Effects
- Connect code concepts to visual/game concepts they already know
- Suggest how code changes will affect visual output
- Be enthusiastic about creative applications
- Always mention what this enables them to CREATE"
```

**UI location:** Kitsune panel header, next to model selector.
**Persistence:** Save to `kitsune-memory.md`, reload on project open.

---

#### FEATURE 02: "Explain My Error Like Human"
**Priority: HIGH. Viral potential.**

**What it is:**
When Monaco shows a red squiggle or error panel, show a "Ask Kitsune" button.
Kitsune reads the error and explains it in plain language — not the raw error message.

**Current pain point:**
```
SyntaxError: Unexpected token '}'  ← what Monaco shows
```
```
"Kamu lupa tutup kurung di baris 24, jadi parser bingung 
 membaca function berikutnya. Coba tambah ) sebelum baris 25."
← what Kitsune should say
```

**How to implement:**
1. Listen to `editor.onDidChangeModelDecorations()` for error markers
2. When errors detected → show "Ask Kitsune about this error" button in Problems panel
3. On click → send error message + surrounding code (±5 lines) + active persona to Kitsune
4. Display response in Kitsune chat panel, with line highlight in editor

**Kitsune prompt template:**
```
"The user is getting this error in their code:
Error: {error_message}
On line {line_number}:
{code_context}

Explain this error in plain language appropriate for a {persona} user.
1. What went wrong (in simple terms)
2. Why it happened  
3. Exactly how to fix it
4. Highlight which line to look at"
```

**Extra:** Tone of explanation follows active persona (beginner gets emoji + encouragement, dev gets direct fix).

---

#### FEATURE 03: Kitsune Mentor Mode — Code Review with Encouragement
**Priority: HIGH. Opens EDU market.**

**What it is:**
"Review with Kitsune" button in editor toolbar.
Kitsune reviews code with: praise first → tips → one challenge at end.

**3 Review modes:**
- **Mentor** (default): Encouraging, celebrates good code, explains tips gently
- **Pro**: Direct, technical, no praise, just actionable feedback
- **Kid-friendly**: Super encouraging, game/toy analogies, makes it feel like a quest

**Response structure (always):**
```json
{
  "score": { "quality": "8/10", "style": "7/10" },
  "praise": ["What was done well..."],
  "tips": [{ "line": 14, "head": "tip title", "body": "explanation" }],
  "challenge": "One specific thing to improve next"
}
```

**How to implement:**
1. Add "Review" button to editor toolbar (or right-click context menu)
2. Send selected code (or entire file if nothing selected) + persona to Kitsune
3. Parse structured JSON response
4. Render as cards: green (praise) → blue (tip) → orange (challenge)
5. Click tip card → highlight relevant line in editor

---

### PHASE 2 — After 1,000+ Active Users (3–9 months)

---

#### FEATURE 04: Kitsune Avatar — Reactive Emotional States
**Priority: HIGH. Signature visual of Momiji.**

**What it is:**
Small Kitsune avatar in the IDE sidebar that reacts to code state.

| State | Trigger | Avatar | Mood text |
|---|---|---|---|
| Idle | Normal editing | 🦊 | "Ready to help" |
| Error | Monaco error markers detected | 😵 | "Found an issue!" |
| Success | Code runs without errors | 🎉 | "Yeay, it works!" |
| Thinking | Kitsune processing request | 🤔 | "Hmm, let me think..." |
| Proactive | Kitsune has a suggestion | 💡 | "I noticed something..." |

**V1 implementation (1–2 days, CSS + emoji):**
```javascript
// Listen to Monaco error state
editor.onDidChangeModelDecorations(() => {
  const markers = monaco.editor.getModelMarkers({ resource: editor.getModel().uri })
  const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error)
  
  if (errors.length > 0) {
    setKitsuneState('error')
  } else {
    setKitsuneState('idle')
  }
})

// Listen to terminal/run output
onRunSuccess(() => setKitsuneState('success'))
onRunError(() => setKitsuneState('error'))
```

**V2 (Phase 3, if budget allows):** Commission Live2D or Lottie animation artist for animated avatar.

**Proactive tip trigger:**
- User has been on same file for 10+ minutes
- User has run same error 3+ times
- Kitsune detects a pattern improvement opportunity
→ Show gentle strip at bottom of editor: "Kitsune noticed something..."

---

#### FEATURE 05: Visual Algorithm Animator
**Priority: HIGH. EDU killer feature.**

**What it is:**
Step-through animation of code execution, synced to Monaco line highlighting.
Panel shows data structures (arrays, trees, graphs) animating in real time.

**How it works:**
1. User selects code block → clicks "Visualize"
2. Momiji wraps execution in a step recorder:
```javascript
// Step recorder — capture state at each line
function createStepRecorder(code) {
  // Inject tracking before each statement
  // Capture: variable values, array states, loop counters
  // Return: array of {line, variables, arrays, description}
}
```
3. Each step: highlight active line in Monaco + animate data structure panel
4. Kitsune generates plain-language description for each step (cacheable)
5. User can: Play, Pause, Step forward, Step back, Adjust speed

**Supported visualizations V1:**
- Arrays (bar chart, value boxes)
- For/while loops (iteration counter)
- Variable values (live value labels)
- Sorting algorithms (animated bars)

**Supported visualizations V2:**
- Binary search (highlight range)
- Trees (node graph)
- Stack/Queue (push/pop animation)
- Recursion (call stack visualization)

---

#### FEATURE 06: Live Block ↔ Code Bi-directional Sync
**Priority: HIGHEST wow moment. Medium effort.**

**What it is:**
Block panel and Code panel are live mirrors of each other.
Edit a block → code updates instantly. Edit code → block updates instantly.

**The magic moment:**
Non-coder drags a "repeat" block → sees real JavaScript `for` loop appear.
They click the `for` loop in code → see the block highlight.
This is the moment that makes Momiji genuinely unique.

**Implementation approach:**
```
Block edit → Blockly workspace → Generate JS → Diff with Monaco → Apply delta
Code edit → Parse JS (Babel AST) → Match to Blockly patterns → Update workspace
```

**Challenges to solve:**
- Not all JS code maps to Blockly blocks (handle gracefully: show "code-only" indicator)
- Prevent infinite update loops (use dirty flags)
- Performance: debounce updates (250ms delay)

**V1 scope:** Support subset of JS that maps cleanly to Blockly (variables, loops, conditionals, functions)
**V2:** Expand coverage, add visual indicator for "code has advanced features that can't show as blocks"

---

#### FEATURE 07: Coding Quest System + XP
**Priority: MEDIUM. Retention driver.**

**What it is:**
Kitsune gives daily "quests" — small coding challenges inside the user's project.
Complete quest → earn XP → unlock next challenge level.

**Quest structure:**
```json
{
  "id": "add-jump",
  "title": "Make your character jump!",
  "description": "Add a jump function that moves the player up by 100px when space is pressed",
  "hints": ["Use addEventListener", "keyCode for space is 32"],
  "successCondition": "function named jump exists AND uses addEventListener",
  "xp": 50,
  "unlocks": "add-double-jump"
}
```

**Kitsune's role:** Gives hints when stuck, celebrates on completion, suggests next quest.

**Storage:** Save XP and progress to `.momiji/kitsune-memory.md`

**V1:** 10 curated quests for game dev (movement → jump → collision → score → win condition)
**V2:** Community-submitted quest packs, per-language quest tracks

---

### PHASE 3 — After Pro Tier Revenue (9–18 months)

---

#### FEATURE 08: Creative Intent Mode
**"Make movement like Hollow Knight"**

User describes desired game feel in natural language.
Kitsune translates to: code architecture, physics values, animation curves, design patterns.

Requires: curated game design pattern knowledge base.
Not just LLM call — needs structured game design data.

---

#### FEATURE 09: "Share Your Creation" — One-Click Publish
**Viral loop feature.**

One button → deploy to `momiji.run/username/project`
"Built with Momiji IDE 🍁" watermark.
Public gallery of all user creations.

Requires: hosting infrastructure (Vercel/Netlify integration or own server).

---

#### FEATURE 10: Kitsune AI Memory Personality
**Emotional moat.**

Kitsune actively uses project memory in conversation:
"You usually use Godot right? Want me to translate this to GDScript?"
"I noticed you keep running into this same error — want me to explain why it happens?"

Already has: `.momiji/kitsune-memory.md` system.
Needs: Active recall logic — Kitsune proactively references memory.

---

#### FEATURE 11: AI Sprite & Asset Generator
**Game dev magnet.**

Describe asset → generate pixel art sprite / icon / background → save to project folder.
BYOK model: user brings their own Fal.ai / Replicate API key (zero server cost for Momiji).

---

## 5. Kitsune Memory File Format

Location: `.momiji/kitsune-memory.md` in every project.
Kitsune reads this at start of every session.

**Suggested schema to implement:**
```markdown
# Kitsune Memory — [Project Name]

## Project
- Type: game / web app / automation / learning
- Stack: JavaScript / Python / GDScript / etc.
- Engine: Godot / Unity / none
- Description: [one line description]

## User
- Persona: beginner | developer | creative
- Experience level: 1-10
- Preferred explanation style: analogies | technical | visual
- Language: English | Bahasa Indonesia | Japanese

## Project History
- [auto-generated by Kitsune: key decisions, patterns used, bugs fixed]

## Custom Rules
- [user-defined: "always use TypeScript", "prefer functional style", etc.]
```

---

## 6. Plugin/Extension System

**Current state:** Custom Momiji plugin API.

**Options for VS Code extension compatibility:**

| Option | Effort | What it gives |
|---|---|---|
| **Open VSX Registry** (recommended) | Medium | Legal access to thousands of existing extensions |
| `@codingame/monaco-vscode-api` | High | Near-full VS Code API compatibility |
| Native Momiji Plugin API only | Low | Clean but small ecosystem |

**Recommendation:** Implement Open VSX Registry integration.
Allows users to install popular language support, themes, and linting extensions.
Build native Momiji Plugin API on top for Momiji-specific features (Kitsune integrations, Block mode extensions).

**VS Code Marketplace:** Cannot be accessed legally. Microsoft restricts it to VS Code only.

---

## 7. Business Model

### Tiers (introduce after 1,000+ active users)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 forever | Full IDE, Kitsune via Groq/Gemini free, 50 AI req/day |
| **Pro** | $9/month | Kitsune via Claude Haiku, unlimited requests, cloud sync |
| **Studio** | $24/seat/month | Team workspace, custom Kitsune persona, admin dashboard |
| **EDU** | Custom | Teacher dashboard, student progress, bulk licensing |

### Revenue philosophy: "Free to learn. Pay to power."
- Free tier must be genuinely useful (not crippled)
- Paid tiers add AI power, not gate core features
- BYOK model means zero AI server cost at any tier

---

## 8. Go-to-Market — Validation Plan (Next 3 Months)

### Week 1–3: Prepare
- [ ] Record 30-second demo video for hero section
- [ ] Deploy new landing page (already built)
- [ ] Set up Plausible analytics (free, privacy-first)
- [ ] Write Reddit posts (don't post yet)
- [ ] Draft Product Hunt submission

### Week 4–8: Launch
- [ ] Post on r/gamedev, r/learnprogramming, r/webdev
- [ ] Product Hunt launch (Tuesday 12AM PST)
- [ ] Post YouTube Shorts (Kitsune doing impressive things)
- [ ] DM first 10 GitHub stargazers — ask for 15-min call
- [ ] Post on Dev.to: "I built a Cursor alternative with Block coding"

### Week 9–12: Analyze
- [ ] Review: which segment downloads most?
- [ ] Complete 10 user interviews
- [ ] Ship 1 feature based on user feedback
- [ ] Double down on channel that drove most downloads

### Target metrics
- 500+ downloads by week 12
- 200+ GitHub stars by week 12
- 20% week-2 retention
- 10 user interviews completed

---

## 9. Competitive Position Summary

| | Momiji IDE | VS Code / Cursor | Unity / Godot | GDevelop / Construct | Scratch |
|---|---|---|---|---|---|
| Block/no-code | ✓ | ✗ | Partial | ✓ | ✓ |
| Full code editor | ✓ | ✓ | ✓ | ✗ | ✗ |
| AI built-in | ✓ | ✓ | Limited | ✗ | ✗ |
| AI explains to beginners | ✓ | ✗ | ✗ | ✗ | ✗ |
| Multi-provider AI | ✓ (8) | ✗ | ✗ | ✗ | ✗ |
| Beginner → Pro path | ✓ | ✗ | ✗ | ✗ | ✗ |
| Free forever | ✓ | ✓ | Limited | Partial | ✓ |
| Build games | ✓ | Partial | ✓ | ✓ | Simple |
| Build apps/tools | ✓ | ✓ | ✗ | ✗ | ✗ |

**Key insight:** Momiji is not competing with Unity/Godot (they are engines).
Momiji sits **before and alongside** game engines — the place where users learn to think like developers, then graduate to engines.

---

## 10. Immediate Action Items for Claude Code

### This week (in priority order):

**1. Implement Feature 01 — Kitsune Explain Mode**
- Add 3-persona toggle to Kitsune panel UI
- Add persona to kitsune-memory.md schema
- Modify Kitsune system prompt injection to prepend persona prompt
- Test with: loops, functions, arrays, async/await, classes

**2. Implement Feature 02 — Error Explanation**
- Add listener to Monaco error markers
- Add "Ask Kitsune" button to Problems panel
- Build error context payload (error + surrounding code + persona)
- Test with: syntax errors, runtime errors, type errors

**3. Implement Feature 03 — Mentor Mode Review**
- Add "Review" button to editor toolbar
- Build structured prompt for JSON response
- Build review card UI (green praise / blue tip / orange challenge)
- Link tip cards to line highlights in editor

**4. Deploy new landing page**
- Replace current index.html with new landing page HTML
- Verify all download links point to correct release assets
- Add Plausible analytics script

**5. Update README.md**
- Replace with new README (already drafted)
- Add demo GIF once recorded

---

## 11. Files Already Created (available for download)

| File | Description |
|---|---|
| `Momiji_IDE_Pitch_Deck.pptx` | 10-slide investor pitch deck |
| `Momiji_IDE_Business_Model.docx` | Full business model document |
| `Momiji_IDE_Pricing.html` | Complete pricing page, ready to deploy |
| `Momiji_IDE_Landing_Page.html` | Revised landing page with new positioning |
| `Momiji_Landing_Page_Improvements.html` | Improvement guide with before/after copy |
| `README.md` | New GitHub README |

---

*End of context document. Feed this entire file to Claude Code for full project context.*
