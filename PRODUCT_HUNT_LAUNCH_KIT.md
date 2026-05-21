# 🚀 Momiji IDE — Product Hunt Launch Kit

> File ini berisi semua copy yang siap pakai untuk launch.
> Target launch: **Tuesday 12:01 AM PST** (Selasa pagi waktu AS)

---

## 1. PRODUCT HUNT SUBMISSION

### Tagline (60 chars max)
```
The AI IDE where blocks talk to code — and Kitsune explains everything
```

**Alt options:**
```
AI-native IDE for everyone: beginners, game devs & pros
```
```
Cursor for beginners: block coding + full Monaco + Kitsune AI
```

---

### Topics / Tags
- Developer Tools
- Artificial Intelligence
- Education
- Open Source
- Desktop App

---

### Description (280 chars, shownpreview)
```
Momiji IDE is a free, open-source code editor with Kitsune AI built in. 
Unique: drag a block → see real JS code. Edit the code → blocks update back. 
Works with Claude, Gemini, GPT, Groq (free), Ollama, and 5 more providers.
```

---

### Full Product Description

Momiji IDE is the code editor that meets you wherever you are — whether you've never written a line of code or you're building your 10th production app.

**The magic moment:**
Drag a "for loop" block → real JavaScript appears in the editor instantly. Edit the number in the code → the block updates. Bidirectional, live, no setup. This is how we think programming should be taught.

**For beginners:**
- Visual block coding (Blockly) with Beginner → Expert toolboxes
- Kitsune AI explains every error in plain language, not stack traces
- Coding Quests + XP system: level up from Baby Coder to Grand Master
- Algorithm Animator: watch your code execute step by step with animated data structures

**For developers:**
- Full Monaco editor (VS Code engine) — IntelliSense, 50+ languages
- 8 AI providers: Claude, Gemini, GPT-4o, Groq (free!), DeepSeek, Mistral, OpenRouter, Ollama
- 7 autonomous agents + custom agent builder
- Project Memory — write context once, Kitsune remembers forever
- Git blame, HTTP client, SQLite browser, package manager, hex viewer, PDF viewer

**For game devs:**
- Visual Flow editor for node-graph scripting
- Kitsune speaks Unity/Godot/Blender analogies
- Canvas Playground with 10 animation templates
- Kitsune Avatar reacts to your code: wiggles on errors, jumps when it compiles clean

**Free. Forever. No account. No telemetry. BYOK (keys stay on your machine).**

---

### First Comment (post immediately after launch to show on top)

```
Hey PH! 👋 I'm Haikal, the solo developer behind Momiji IDE.

I started building this because I was frustrated — every AI code editor is built for senior devs, and every beginner tool caps out before you can do anything real.

Momiji is my attempt to bridge that gap. The thing I'm most proud of in this release:

**Block ↔ Code bidirectional sync** — You drag a block, JavaScript appears. You edit the JavaScript, the block updates. I wrote a zero-dependency JS parser from scratch to make this work without any build-time AST tools.

**Kitsune Avatar** — There's a little fox character in the sidebar that reacts to your code state. Wiggles when there are errors. Jumps when your code runs clean. After 10 minutes idle, she nudges you with a tip. Yes, she has three sprite images. Yes, it's extra. But that's what makes an IDE feel *alive* vs just functional.

I built everything with Electron + React + Monaco. Free and open source on GitHub.

Would genuinely love your feedback — especially from people who have tried to teach someone else to code. What's the hardest part to get past?

🦊 https://github.com/momiji-ide/momiji-ide
```

---

## 2. REDDIT POSTS

### r/learnprogramming (best sub for launch)

**Title:**
```
I built a free IDE where drag-and-drop blocks and real code stay in sync automatically — feedback welcome
```

**Body:**
```
Hey r/learnprogramming! I've been building Momiji IDE as a side project for the past year and just shipped v1.3.0. Looking for feedback from people who are learning, or who teach.

The core idea: most tools split beginners and "real" coders into two separate camps. Scratch/Blockly for beginners, VS Code for everyone else. There's no bridge.

Momiji tries to be the bridge:

**What's unique:**
- Drag a block (for loop, if/else, variable) → real JavaScript appears in Monaco editor instantly
- Edit that JavaScript → the blocks update automatically
- You can watch your own code animate step by step (Algorithm Animator) with variable values updating live
- Kitsune AI has 3 explanation modes: Beginner (analogies, encouraging), Developer (direct, technical), Creative (game/Unity framing)
- Coding Quests with XP — 14 challenges across Game Dev, Web, Python, and General tracks
- Works with Groq (free), Gemini free tier, Ollama (local, offline), or BYOK for Claude/GPT

**What I'm trying to understand:**
What's the hardest concept to get past as a beginner? I want to build specific quests around those moments.

Download: https://github.com/momiji-ide/momiji-ide/releases (Windows, Mac, Linux)
```

---

### r/gamedev

**Title:**
```
I added a Kitsune AI companion to my code editor — she reacts to your code errors and jumps when you succeed
```

**Body:**
```
Built something a bit different — Momiji IDE, a code editor focused on game devs and creative coders.

What's new in v1.3.0 that's relevant to r/gamedev:

🦊 **Kitsune Avatar** — small fox character in the sidebar that reacts to your code:
- Wiggles + confused face when Monaco detects errors
- Jumps when your code compiles/runs clean
- Glows purple while AI is thinking
- Nudges you with a tip after 10 minutes idle

🎬 **Algorithm Animator** — step through your game logic visually. Watch arrays sort themselves with animated bars. See your loop counter increment in real time. Good for debugging game state.

🗺️ **Quests** — 14 coding challenges. The Game Dev track goes: move player → add jump → collision detection → score system → game loop. Kitsune gives you hints if you're stuck.

⟳ **Block ↔ Code sync** — drag a game loop block → JS appears. Edit the JS → block updates. Good for showing non-coders what code does.

Also: Kitsune speaks Godot/Unity/Blender analogies when you pick the Creative persona. She frames code concepts in terms of visual outcomes.

Free, open source, Windows/Mac/Linux: https://github.com/momiji-ide/momiji-ide
```

---

### r/webdev

**Title:**
```
Show r/webdev: Free IDE with 8 AI providers (including Groq free), bi-directional block-to-code sync, and a fox mascot
```

**Body:**
```
Hey webdevs, launching Momiji IDE v1.3.0 today.

Quick pitch: VS Code is great. But it wasn't built for someone learning their first `fetch()` call. Momiji tries to be the IDE that actually teaches you — not just autocompletes.

**Things you might actually use:**

- **HTTP Client** built in — test your APIs without leaving the IDE
- **8 AI providers** — Claude, Gemini, GPT, Groq (free, no key needed), DeepSeek, Mistral, Ollama, or custom OpenAI-compatible endpoint
- **Custom Agent Manager** — build your own agents (code reviewer, test writer, doc writer) with specific system prompts
- **Git integration** — stage, commit, branch, push, AI-written commit messages
- **SQLite browser**, **Package Manager** (npm/pip/cargo), **Regex Playground**

**What's new:**
- Block ↔ code bidirectional sync (explained more in comments)
- Algorithm Animator for visualizing execution
- Kitsune Avatar that reacts to your code state (yes, the fox jumps when it compiles)

BYOK — bring your own API key, or use Groq/Gemini free tier. Keys stay local.

GitHub: https://github.com/momiji-ide/momiji-ide
```

---

## 3. DEV.TO ARTICLE

**Title:**
```
I built a Cursor alternative with drag-and-drop block coding, a reactive fox mascot, and bidirectional code sync
```

**Tags:** `showdev`, `opensource`, `ai`, `beginners`

**Article:**

---

Last month I quit fighting with VS Code extensions and started building my own editor. Six months later, Momiji IDE v1.3.0 is live — and it does something I haven't seen anywhere else.

### The problem I was solving

Every AI editor I tried (Cursor, Copilot, Continue) was built for senior developers. Every beginner tool (Scratch, Blockly, Snap!) caps out before you can do anything real.

There's no bridge.

Momiji is my attempt to build that bridge — an editor where a drag-and-drop block and a `for` loop are the same thing, just seen from different angles.

### The magic moment: block ↔ code bidirectional sync

Here's the feature I'm most proud of:

1. You drag a "repeat 10 times" block onto the canvas
2. Real JavaScript appears in the Monaco editor: `for (var i = 0; i < 10; i++) { ... }`
3. You change `10` to `50` directly in the code
4. The block updates its count to 50

Bi-directional. Live. Zero external dependencies.

I built a recursive descent parser from scratch (`codeToBlockly.ts`) that converts JavaScript back to Blockly XML. It handles: variable declarations, for/while loops, if/else, arithmetic, comparisons, logic, function definitions — the full subset that Blockly itself generates.

```typescript
// The parser handles patterns like:
var score = 0;              // → variables_set block
for (var i = 0; i < 10; i++) { ... }  // → controls_for block
if (score > 100) { ... }   // → controls_if block
window.alert(String(score)); // → text_print block
```

Three sync modes:
- **Live** — blocks control code (original behavior)
- **Edit** — free code editing + one-click "↑ Sync to Blocks" button
- **Auto-sync** — code changes debounce 350ms then auto-parse to blocks

### Kitsune AI — adaptive explanations

The AI layer (called Kitsune) has three explanation personas:

```
🧒 Beginner: "Oops! Your for loop is missing a closing bracket. Think of it 
             like a box — if you open it, you have to close it!"

⚡ Developer: "Unexpected token '}' on line 24 — missing closing paren 
              on the for loop initializer."

🎨 Creative: "Your game loop lost its end tag — like a Unity Update() 
              without its closing brace."
```

Same error, three completely different explanations. Saved to localStorage, remembered across sessions.

### The reactive avatar

There's a small Kitsune (fox girl) character in the sidebar. She has three sprite images:

- `kitsune-normal.png` → idle, ready
- `kitsune-confuse.png` → errors detected, wiggle animation
- `kitsune-happy.png` → code runs clean, jump animation

She also goes proactive after 10 minutes idle — shows a "I noticed something..." state and sends a tip to the AI panel when clicked.

Is it necessary? No. But it makes the IDE feel *alive* instead of just functional. And honestly, that matters for learners.

### Tech stack

- **Electron 31** + electron-vite (cross-platform desktop)
- **React 18** + TypeScript + Zustand
- **Monaco Editor** (same engine as VS Code)
- **Blockly** for the block editor
- **xterm.js** + node-pty for the terminal
- **Multi-provider AI** — Claude, Gemini, GPT-4o, Groq, DeepSeek, Mistral, OpenRouter, Ollama, Custom

### What's free

Everything. No account. No telemetry. BYOK (API keys stored locally, never sent to Momiji servers). Start with Groq (free, no key needed) or Gemini free tier.

### Links

- **Download**: https://github.com/momiji-ide/momiji-ide/releases
- **GitHub**: https://github.com/momiji-ide/momiji-ide
- **Website**: https://momiji-ide.github.io/momiji-ide

Would love feedback, especially from people who teach programming. What's the concept that trips up beginners the most — I want to build specific quests around that.

---

## 4. LAUNCH CHECKLIST

### Pre-launch (do these first)
- [ ] Record a 30-second demo GIF/video (blocks → code sync is the wow moment)
- [ ] Upload demo to YouTube/Twitter as unlisted, get URL
- [ ] Add demo video to Product Hunt submission media
- [ ] Star the GitHub repo from at least 5 accounts you have access to
- [ ] Tell 5 friends to upvote on launch day (not fake, just remind real people)
- [ ] Update landing page hero with demo video embed

### Launch day (Tuesday, 12:01 AM PST)
- [ ] Submit to Product Hunt with all media
- [ ] Post first comment immediately (copy from section 1)
- [ ] Post r/learnprogramming (highest traffic)
- [ ] Post r/gamedev
- [ ] Post r/webdev
- [ ] Post r/programming (shorter version)
- [ ] Publish Dev.to article
- [ ] Tweet/X thread: "I shipped [X] → [Y] → [Z] — thread 🧵"
- [ ] DM every current GitHub stargazer personally

### Post-launch (within 48h)
- [ ] Respond to every PH comment
- [ ] Thank every upvoter who left a comment
- [ ] Fix any reported bugs same day
- [ ] Post a "thank you" update on PH with top 3 pieces of feedback

---

## 5. TWITTER/X THREAD

```
1/ After 6 months of evenings and weekends, I shipped Momiji IDE v1.3.0 🍁

A code editor where drag-and-drop blocks and real code are the same thing — just seen from different angles.

Here's what's inside 🧵
```

```
2/ The thing I'm most proud of:

Block ↔ Code BIDIRECTIONAL sync.

Drag a for-loop block → JavaScript appears.
Edit the JavaScript → the block updates.

I built a zero-dependency JS parser from scratch for this.

[GIF of the sync working]
```

```
3/ Kitsune AI has 3 explanation modes:

🧒 Beginner: analogies, "Oops!", step by step
⚡ Dev: direct, technical, no hand-holding
🎨 Creative: Unity/Godot/Blender framing

Same error, three completely different answers.
```

```
4/ There's a reactive fox mascot in the sidebar.

She WIGGLES when Monaco detects errors.
She JUMPS when your code runs clean.
She nudges you after 10 minutes idle.

Unnecessary? Probably. Makes the IDE feel alive? Absolutely.
```

```
5/ New in v1.3.0:
- Algorithm Animator (watch code execute step by step)
- Coding Quests + XP (14 challenges, level up system)
- Kitsune Avatar (reactive emotional states)
- Block ↔ Code sync (the bidirectional parser)

All free. All open source.
```

```
6/ Stack: Electron + React + Monaco + Blockly + xterm.js

8 AI providers: Claude, Gemini, GPT, Groq (FREE), DeepSeek, Mistral, Ollama, Custom endpoint

BYOK — keys stay on your machine.

GitHub: https://github.com/momiji-ide/momiji-ide

If this seems useful, a ⭐ goes a long way 🙏
```

---

*Generated: 2026-05-21 | Momiji IDE v1.3.0 launch kit*
