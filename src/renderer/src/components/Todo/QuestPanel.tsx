import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

// ── Quest definitions ─────────────────────────────────────────────────────────

interface Quest {
  id:               string
  title:            string
  desc:             string
  hint:             string
  xp:               number
  track:            'gamedev' | 'web' | 'python' | 'general'
  difficulty:       'easy' | 'medium' | 'hard'
  successPattern:   RegExp    // matched against active file content
  unlocks?:         string
}

const ALL_QUESTS: Quest[] = [
  // ── Game Dev Track ─────────────────────────────────────────────────────────
  {
    id: 'move-player', track: 'gamedev', difficulty: 'easy', xp: 50,
    title: '🎮 Move the Player',
    desc: 'Create a function called `movePlayer` that changes an x or y position.',
    hint: 'Try: function movePlayer(dx, dy) { x += dx; y += dy; }',
    successPattern: /function\s+movePlayer|movePlayer\s*=/,
    unlocks: 'add-jump'
  },
  {
    id: 'add-jump', track: 'gamedev', difficulty: 'easy', xp: 60,
    title: '⬆️ Make it Jump!',
    desc: 'Add a `jump` function that uses a velocity or position offset.',
    hint: 'Try: function jump() { vy = -10; } // negative y = up in most engines',
    successPattern: /function\s+jump|jump\s*=/,
    unlocks: 'collision-detect'
  },
  {
    id: 'collision-detect', track: 'gamedev', difficulty: 'medium', xp: 80,
    title: '💥 Detect Collision',
    desc: 'Write a function `checkCollision(a, b)` that returns true if two objects overlap.',
    hint: 'Compare x, y, width, and height of both objects (AABB collision).',
    successPattern: /function\s+checkCollision|checkCollision\s*=/,
    unlocks: 'score-system'
  },
  {
    id: 'score-system', track: 'gamedev', difficulty: 'medium', xp: 90,
    title: '🏆 Track the Score',
    desc: 'Add a `score` variable and a `addScore(points)` function.',
    hint: 'let score = 0; function addScore(pts) { score += pts; }',
    successPattern: /(?:let|const|var)\s+score|addScore\s*=/,
    unlocks: 'game-loop'
  },
  {
    id: 'game-loop', track: 'gamedev', difficulty: 'hard', xp: 120,
    title: '🔄 The Game Loop',
    desc: 'Create a `gameLoop()` function that calls `requestAnimationFrame` or `setInterval`.',
    hint: 'function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }',
    successPattern: /requestAnimationFrame|gameLoop|setInterval.*update/,
    unlocks: undefined
  },

  // ── Web Dev Track ──────────────────────────────────────────────────────────
  {
    id: 'create-element', track: 'web', difficulty: 'easy', xp: 40,
    title: '🌐 Create a DOM Element',
    desc: 'Use `document.createElement` to create and append a new element.',
    hint: 'const div = document.createElement("div"); document.body.appendChild(div);',
    successPattern: /document\.createElement|innerHTML\s*=/,
    unlocks: 'add-event'
  },
  {
    id: 'add-event', track: 'web', difficulty: 'easy', xp: 50,
    title: '🖱️ Add a Click Listener',
    desc: 'Use `addEventListener("click", ...)` on any element.',
    hint: 'element.addEventListener("click", () => { console.log("clicked!"); })',
    successPattern: /addEventListener\s*\(\s*['"]click/,
    unlocks: 'fetch-data'
  },
  {
    id: 'fetch-data', track: 'web', difficulty: 'medium', xp: 80,
    title: '🌐 Fetch Data from an API',
    desc: 'Use `fetch()` to get data from any URL and log it.',
    hint: 'fetch("https://jsonplaceholder.typicode.com/todos/1").then(r => r.json()).then(console.log)',
    successPattern: /fetch\s*\(/,
    unlocks: undefined
  },

  // ── Python Track ───────────────────────────────────────────────────────────
  {
    id: 'py-function', track: 'python', difficulty: 'easy', xp: 40,
    title: '🐍 Write a Python Function',
    desc: 'Create a function with `def` that takes at least one parameter.',
    hint: 'def greet(name):\n    return f"Hello, {name}!"',
    successPattern: /def\s+\w+\s*\(/,
    unlocks: 'py-list-loop'
  },
  {
    id: 'py-list-loop', track: 'python', difficulty: 'easy', xp: 50,
    title: '🔄 Loop a List',
    desc: 'Use `for item in list:` to loop over a list and print each item.',
    hint: 'my_list = [1,2,3]\nfor item in my_list:\n    print(item)',
    successPattern: /for\s+\w+\s+in\s+/,
    unlocks: 'py-dict'
  },
  {
    id: 'py-dict', track: 'python', difficulty: 'medium', xp: 70,
    title: '📖 Use a Dictionary',
    desc: 'Create a dict with at least 3 keys and access one value.',
    hint: 'data = {"name": "Kitsune", "age": 1, "type": "fox"}\nprint(data["name"])',
    successPattern: /\{\s*['"]?\w+['"]?\s*:\s*.+['"]?\w+['"]?\s*:/,
    unlocks: undefined
  },

  // ── General Track ──────────────────────────────────────────────────────────
  {
    id: 'gen-recursion', track: 'general', difficulty: 'hard', xp: 100,
    title: '♾️ Write a Recursive Function',
    desc: 'Write a function that calls itself (factorial, fibonacci, etc.).',
    hint: 'function factorial(n) { if (n <= 1) return 1; return n * factorial(n-1); }',
    successPattern: /function\s+(\w+)[^{]*\{[^}]*\1\s*\(/s,
    unlocks: undefined
  },
  {
    id: 'gen-sort', track: 'general', difficulty: 'medium', xp: 75,
    title: '🔃 Sort an Array',
    desc: 'Sort any array using `.sort()` or implement your own sort.',
    hint: 'const sorted = [3,1,2].sort((a,b) => a - b);',
    successPattern: /\.sort\s*\(|bubbleSort|mergeSort|quickSort/,
    unlocks: undefined
  },
]

// XP to level mapping
function getLevel(xp: number) {
  if (xp < 100) return { level: 1, title: 'Baby Coder 🐣',     next: 100 }
  if (xp < 250) return { level: 2, title: 'Code Apprentice 🦊', next: 250 }
  if (xp < 500) return { level: 3, title: 'Builder 🔨',         next: 500 }
  if (xp < 800) return { level: 4, title: 'Developer ⚡',        next: 800 }
  if (xp < 1200) return { level: 5, title: 'Architect 🏗️',      next: 1200 }
  return { level: 6, title: 'Grand Master 🏆', next: Infinity }
}

const TRACK_LABELS: Record<string, string> = {
  all: '🌟 All', gamedev: '🎮 Game Dev', web: '🌐 Web', python: '🐍 Python', general: '⚙️ General'
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadProgress(): { xp: number; completed: string[] } {
  try {
    return JSON.parse(localStorage.getItem('momiji:quest-progress') ?? '{"xp":0,"completed":[]}')
  } catch { return { xp: 0, completed: [] } }
}
function saveProgress(p: { xp: number; completed: string[] }) {
  localStorage.setItem('momiji:quest-progress', JSON.stringify(p))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuestPanel() {
  const { tabs, activeTabId, currentFolder } = useAppStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

  const [progress, setProgress]   = useState(loadProgress)
  const [track, setTrack]         = useState<'all' | 'gamedev' | 'web' | 'python' | 'general'>('all')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [checking, setChecking]   = useState<string | null>(null)

  const { xp, completed } = progress
  const lvl = getLevel(xp)
  const xpToNext = lvl.next === Infinity ? xp : lvl.next
  const pct = lvl.next === Infinity ? 100 : Math.min(100, (xp / lvl.next) * 100)

  const filteredQuests = ALL_QUESTS.filter(q =>
    (track === 'all' || q.track === track) && !completed.includes(q.id)
  )
  const completedQuests = ALL_QUESTS.filter(q => completed.includes(q.id))

  // Auto-check active file content against quest patterns
  const checkQuest = useCallback((quest: Quest) => {
    const content = activeTab?.content ?? ''
    if (!content.trim()) {
      toast.warning('No code in active editor tab')
      return
    }
    setChecking(quest.id)
    setTimeout(() => {
      const pass = quest.successPattern.test(content)
      setChecking(null)
      if (pass) {
        const newCompleted = [...completed, quest.id]
        const newXP = xp + quest.xp
        const newProgress = { xp: newXP, completed: newCompleted }
        setProgress(newProgress)
        saveProgress(newProgress)
        toast.success(`🏆 Quest complete: ${quest.title}! +${quest.xp} XP`)
        // Notify Kitsune avatar
        window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state: 'success', duration: 5000 } }))
        // Optionally write to kitsune memory
        if (currentFolder) {
          const memPath = `${currentFolder}/.momiji/kitsune-memory.md`
          window.api.fs.readFile(memPath).then(r => {
            const existing = r.content ?? ''
            const entry = `\n- Completed quest: ${quest.title} (+${quest.xp} XP) — Total XP: ${newXP}`
            window.api.fs.writeFile(memPath, existing + entry).catch(() => {})
          }).catch(() => {})
        }
      } else {
        toast.warning(`❌ Not yet — ${quest.hint}`)
        window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state: 'error', duration: 3000 } }))
      }
    }, 400)
  }, [activeTab, completed, xp, currentFolder])

  const askKitsuneHint = (quest: Quest) => {
    window.dispatchEvent(new CustomEvent('kitsune:askWithPrompt', {
      detail: { prompt: `I'm working on the Momiji coding quest: "${quest.title}". ${quest.desc} Can you give me a nudge without spoiling it? My current code:\n\`\`\`\n${activeTab?.content?.slice(0, 2000) ?? '(no code yet)'}\n\`\`\`` }
    }))
  }

  const resetProgress = () => {
    if (!confirm('Reset all quest progress and XP?')) return
    const empty = { xp: 0, completed: [] }
    setProgress(empty)
    saveProgress(empty)
    toast.info('Quest progress reset')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* XP + Level bar */}
      <div className="flex-shrink-0 p-3" style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-black" style={{ color: 'var(--accent-mauve)' }}>🗺️ QUESTS</span>
          <div className="flex-1" />
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'var(--accent-mauve)22', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
            {lvl.title}
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--accent-yellow)' }}>{xp} XP</span>
        </div>
        {/* XP bar */}
        <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-surface0)' }}>
          <div style={{
            height: '100%', borderRadius: '9999px',
            background: 'linear-gradient(90deg, var(--accent-mauve), #e85d04)',
            width: `${pct}%`, transition: 'width 0.4s ease'
          }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>Lv {lvl.level}</span>
          {lvl.next !== Infinity && <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>{xp}/{lvl.next} → Lv {lvl.level + 1}</span>}
        </div>

        {/* Track filter */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {Object.entries(TRACK_LABELS).map(([t, label]) => (
            <button key={t} onClick={() => setTrack(t as any)}
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: track === t ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                color: track === t ? 'white' : 'var(--text-muted)',
                border: `1px solid ${track === t ? 'var(--accent-mauve)' : 'var(--border)'}`,
                fontSize: 10
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">

        {filteredQuests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--text-subtle)' }}>
            <span style={{ fontSize: 32 }}>🎉</span>
            <p className="text-xs text-center">All quests in this track complete!</p>
            <p className="text-xs text-center" style={{ fontSize: 10 }}>Try another track or reset progress below.</p>
          </div>
        )}

        {filteredQuests.map(quest => (
          <div key={quest.id}
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${expanded === quest.id ? 'var(--accent-mauve)55' : 'var(--border)'}`, background: 'var(--bg-surface0)' }}>

            {/* Quest header */}
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === quest.id ? null : quest.id)}>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{quest.title}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{quest.desc}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: quest.difficulty === 'easy' ? 'var(--accent-green)22' : quest.difficulty === 'medium' ? 'var(--accent-yellow)22' : 'var(--accent-red)22',
                    color: quest.difficulty === 'easy' ? 'var(--accent-green)' : quest.difficulty === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-red)',
                    fontSize: 9
                  }}>
                  {quest.difficulty}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--accent-yellow)', fontSize: 10 }}>+{quest.xp}</span>
                <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{expanded === quest.id ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded content */}
            {expanded === quest.id && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {quest.desc}
                </div>
                <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: 'var(--accent-yellow)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  💡 Hint: {quest.hint}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkQuest(quest)}
                    disabled={checking === quest.id}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer', opacity: checking === quest.id ? 0.6 : 1 }}>
                    {checking === quest.id ? '⟳ Checking…' : '✓ Check My Code'}
                  </button>
                  <button
                    onClick={() => askKitsuneHint(quest)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44', cursor: 'pointer' }}>
                    🦊 Ask Kitsune
                  </button>
                </div>
                {quest.unlocks && (
                  <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>
                    🔓 Completes → unlocks next quest
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Completed section */}
        {completedQuests.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>
              ✅ Completed ({completedQuests.length})
            </p>
            {completedQuests.map(quest => (
              <div key={quest.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1"
                style={{ background: 'var(--bg-surface0)', opacity: 0.6 }}>
                <span className="text-xs" style={{ color: 'var(--accent-green)' }}>✓</span>
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{quest.title}</span>
                <span className="text-xs font-bold" style={{ color: 'var(--accent-yellow)', fontSize: 9 }}>+{quest.xp}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reset link */}
        <button onClick={resetProgress}
          className="text-xs mt-2 self-center"
          style={{ color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>
          Reset progress
        </button>
      </div>
    </div>
  )
}
