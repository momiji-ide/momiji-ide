import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepFrame {
  line:        number
  variables:   Record<string, unknown>
  arrays:      Record<string, unknown[]>
  logs:        string[]
  description: string
}

// ── Safe JS step recorder ─────────────────────────────────────────────────────

function recordSteps(code: string): StepFrame[] {
  const frames: StepFrame[] = []
  const MAX_STEPS = 500

  // Intercept console.log
  const logs: string[] = []
  const fakeConsole = {
    log: (...args: unknown[]) => logs.push(args.map(a => JSON.stringify(a) ?? String(a)).join(' ')),
  }

  // Wrap code with per-line tracking via Proxy / line-by-line approach
  // We inject a __step__ function call before each statement
  const lines = code.split('\n')
  const instrumented: string[] = []
  let lineMap: number[] = []

  instrumented.push('const __vars__ = {}; const __arrays__ = {};')
  instrumented.push('function __step__(ln, scope) {')
  instrumented.push('  if (__frames__.length >= 500) return;')
  instrumented.push('  const snap = {};')
  instrumented.push('  for (const k of Object.keys(scope)) { try { snap[k] = JSON.parse(JSON.stringify(scope[k])); } catch { snap[k] = String(scope[k]); } }')
  instrumented.push('  const arrs = {};')
  instrumented.push('  for (const k of Object.keys(snap)) { if (Array.isArray(snap[k])) { arrs[k] = snap[k]; delete snap[k]; } }')
  instrumented.push('  __frames__.push({ line: ln, variables: snap, arrays: arrs, logs: [...__logs__], description: `Line ${ln}` });')
  instrumented.push('  __logs__.length = 0;')
  instrumented.push('}')

  // Add original code (just run it — no full AST instrumentation for V1)
  // V1: just execute and capture final state. Real step-through needs Babel.
  // For the animator UI demo, we'll generate synthetic frames from the code.
  instrumented.push(...lines)

  try {
    // V1: Generate synthetic frames by analyzing code patterns
    return generateSyntheticFrames(code)
  } catch (e) {
    return [{ line: 1, variables: {}, arrays: {}, logs: [`Error: ${e}`], description: 'Error recording steps' }]
  }
}

/** V1 synthetic frame generator — parses common patterns without full instrumentation */
function generateSyntheticFrames(code: string): StepFrame[] {
  const frames: StepFrame[] = []
  const lines = code.split('\n')
  const vars: Record<string, unknown> = {}
  const arrays: Record<string, unknown[]> = {}

  for (let i = 0; i < lines.length && frames.length < 300; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('function') && !line.includes('{')) continue

    // Detect variable assignment: let x = 5 / const arr = [1,2,3]
    const assignMatch = line.match(/(?:let|const|var)\s+(\w+)\s*=\s*(.+?);?$/)
    if (assignMatch) {
      const [, name, valStr] = assignMatch
      try {
        const val = JSON.parse(valStr.trim().replace(/'/g, '"'))
        if (Array.isArray(val)) {
          arrays[name] = val
          delete vars[name]
        } else {
          vars[name] = val
          delete arrays[name]
        }
      } catch {
        vars[name] = valStr.trim()
      }
      frames.push({
        line: i + 1,
        variables: { ...vars },
        arrays: { ...arrays },
        logs: [],
        description: `Set ${name} = ${valStr.trim()}`
      })
      continue
    }

    // Detect loop: for (let i = 0; i < n; i++)
    const forMatch = line.match(/for\s*\((?:let|var|const)?\s*(\w+)\s*=\s*(\d+);\s*\1\s*[<>=!]+\s*(\w+|\d+)/)
    if (forMatch) {
      const [, iVar, start, limit] = forMatch
      const limitN = isNaN(Number(limit)) ? (vars[limit] as number ?? 5) : Number(limit)
      const startN = Number(start)
      for (let n = startN; n < Math.min(limitN, startN + 20) && frames.length < 300; n++) {
        vars[iVar] = n
        // Simulate swap or common operation inside loop block
        const loopBody = lines.slice(i + 1, i + 10).join(' ')
        const swapMatch = loopBody.match(/\[(\w+)\]\s*,\s*\[(\w+)\]\]\s*=/)
        if (swapMatch && Object.keys(arrays).length > 0) {
          const arrName = Object.keys(arrays)[0]
          const arr = [...arrays[arrName]]
          const a = n, b = n + 1
          if (b < arr.length) {
            ;[arr[a], arr[b]] = [arr[b], arr[a]]
            arrays[arrName] = arr
          }
        }
        frames.push({
          line: i + 1,
          variables: { ...vars },
          arrays: { ...arrays },
          logs: [],
          description: `Loop iteration: ${iVar} = ${n}`
        })
      }
      continue
    }

    // Detect console.log
    const logMatch = line.match(/console\.log\((.+)\)/)
    if (logMatch) {
      frames.push({
        line: i + 1,
        variables: { ...vars },
        arrays: { ...arrays },
        logs: [`console.log(${logMatch[1]})`],
        description: `Log: ${logMatch[1]}`
      })
      continue
    }

    // Generic statement — just record current state
    if (line.length > 2 && frames.length > 0) {
      frames.push({
        line: i + 1,
        variables: { ...vars },
        arrays: { ...arrays },
        logs: [],
        description: line.slice(0, 60)
      })
    }
  }

  if (frames.length === 0) {
    frames.push({ line: 1, variables: {}, arrays: {}, logs: [], description: 'No trackable statements found' })
  }

  return frames
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlgorithmAnimator() {
  const { tabs, activeTabId } = useAppStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

  const [frames, setFrames]       = useState<StepFrame[]>([])
  const [cursor, setCursor]       = useState(0)
  const [playing, setPlaying]     = useState(false)
  const [speed, setSpeed]         = useState(600)   // ms per step
  const [code, setCode]           = useState('')
  const [useAI, setUseAI]         = useState(false)
  const [aiDescs, setAiDescs]     = useState<Record<number, string>>({})
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const analyze = useCallback(() => {
    const src = activeTab?.content ?? ''
    if (!src.trim()) { toast.warning('No code in editor'); return }
    setCode(src)
    const f = recordSteps(src)
    setFrames(f)
    setCursor(0)
    setPlaying(false)
    toast.success(`🎬 ${f.length} steps captured`)
  }, [activeTab])

  // Auto-play
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setCursor(c => {
          if (c >= frames.length - 1) { setPlaying(false); return c }
          return c + 1
        })
      }, speed)
    } else {
      if (playRef.current) clearInterval(playRef.current)
    }
    return () => { if (playRef.current) clearInterval(playRef.current) }
  }, [playing, speed, frames.length])

  const frame = frames[cursor]
  const lines = code.split('\n')

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: 40, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>
          🎬 ALGORITHM ANIMATOR
        </span>
        <div className="flex-1" />
        <button onClick={analyze}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white' }}>
          ▶ Analyze Active File
        </button>
      </div>

      {frames.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 48 }}>🎬</span>
          <p className="text-sm text-center">
            Open a file with code (JS, Python, etc.), then click <strong>Analyze Active File</strong>.
          </p>
          <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
            The animator will trace variable changes, array mutations, and loop iterations step by step.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: code view */}
          <div className="flex flex-col overflow-hidden flex-shrink-0"
            style={{ width: 280, borderRight: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <div className="px-3 py-1.5 flex-shrink-0 text-xs font-semibold" style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
              Code
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs" style={{ lineHeight: '20px' }}>
              {lines.map((ln, i) => (
                <div key={i}
                  style={{
                    display: 'flex', alignItems: 'center',
                    background: frame && frame.line === i + 1 ? 'rgba(249,115,22,0.18)' : 'transparent',
                    borderLeft: frame && frame.line === i + 1 ? '3px solid var(--accent-mauve)' : '3px solid transparent',
                    padding: '0 8px',
                  }}>
                  <span style={{ color: 'var(--text-subtle)', minWidth: 24, userSelect: 'none' }}>{i + 1}</span>
                  <span style={{ color: frame && frame.line === i + 1 ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ln || ' '}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: visualizer */}
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Step description */}
            {frame && (
              <div className="flex-shrink-0 px-4 py-2" style={{ background: 'var(--bg-surface0)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full mr-2"
                  style={{ background: 'var(--accent-mauve)', color: 'white' }}>
                  Step {cursor + 1} / {frames.length}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                  {frame.description}
                </span>
              </div>
            )}

            {/* Variables + Arrays */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

              {/* Variables */}
              {frame && Object.keys(frame.variables).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Variables</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(frame.variables).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                        style={{ background: 'var(--bg-surface1)', border: '1px solid var(--border)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>{k}</span>
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>=</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Arrays — bar chart visualization */}
              {frame && Object.keys(frame.arrays).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Arrays</p>
                  {Object.entries(frame.arrays).map(([arrName, arr]) => (
                    <ArrayVisualizer key={arrName} name={arrName} data={arr as number[]} />
                  ))}
                </div>
              )}

              {/* Console logs */}
              {frame && frame.logs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Console</p>
                  {frame.logs.map((l, i) => (
                    <div key={i} className="font-mono text-xs px-3 py-1 rounded"
                      style={{ background: 'var(--bg-surface0)', color: 'var(--accent-green)', marginBottom: 4 }}>
                      {l}
                    </div>
                  ))}
                </div>
              )}

              {frame && Object.keys(frame.variables).length === 0 && Object.keys(frame.arrays).length === 0 && frame.logs.length === 0 && (
                <div className="flex items-center justify-center flex-1" style={{ color: 'var(--text-subtle)' }}>
                  <p className="text-xs">No tracked values at this step</p>
                </div>
              )}
            </div>

            {/* Playback controls */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2"
              style={{ background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setPlaying(false); setCursor(0) }}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>⏮</button>
              <button onClick={() => { setPlaying(false); setCursor(c => Math.max(0, c - 1)) }}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>◀</button>
              <button onClick={() => setPlaying(p => !p)}
                className="px-3 py-1 rounded text-xs font-semibold"
                style={{ background: playing ? 'var(--accent-red)' : 'var(--accent-green)', color: 'var(--bg-base)', minWidth: 52 }}>
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => { setPlaying(false); setCursor(c => Math.min(frames.length - 1, c + 1)) }}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>▶</button>
              <button onClick={() => { setPlaying(false); setCursor(frames.length - 1) }}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>⏭</button>

              {/* Speed */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Speed</span>
                <input type="range" min={80} max={1200} step={40} value={1280 - speed}
                  onChange={e => setSpeed(1280 - Number(e.target.value))}
                  style={{ width: 72, accentColor: 'var(--accent-mauve)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>
                  {speed < 200 ? 'Fast' : speed < 600 ? 'Normal' : 'Slow'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-1.5 rounded-full ml-2 relative" style={{ background: 'var(--bg-surface0)', maxWidth: 120 }}>
                <div style={{
                  height: '100%', borderRadius: '9999px',
                  background: 'var(--accent-mauve)',
                  width: `${frames.length > 1 ? (cursor / (frames.length - 1)) * 100 : 0}%`,
                  transition: 'width 0.15s ease',
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Array Bar Visualizer ──────────────────────────────────────────────────────

function ArrayVisualizer({ name, data }: { name: string; data: unknown[] }) {
  const nums = data.map(v => (typeof v === 'number' ? v : NaN)).filter(n => !isNaN(n))
  const max  = Math.max(...nums, 1)
  const isNumeric = nums.length === data.length

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>{name}</span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>[{data.length}]</span>
      </div>

      {isNumeric ? (
        /* Bar chart for numeric arrays */
        <div className="flex items-end gap-0.5 p-3 rounded-xl"
          style={{ background: 'var(--bg-surface0)', height: 100, overflowX: 'auto' }}>
          {nums.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ minWidth: Math.max(24, 280 / data.length) }}>
              <span style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{v}</span>
              <div
                style={{
                  width: '100%',
                  height: `${(v / max) * 60}px`,
                  background: `hsl(${(i / data.length) * 60 + 20}, 80%, 65%)`,
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.2s ease',
                  minHeight: 2,
                }}
              />
              <span style={{ fontSize: 8, color: 'var(--text-subtle)' }}>{i}</span>
            </div>
          ))}
        </div>
      ) : (
        /* Box view for mixed arrays */
        <div className="flex gap-1 flex-wrap p-2 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
          {data.map((v, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="px-2 py-1 rounded text-xs font-mono"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)', minWidth: 32, textAlign: 'center' }}>
                {JSON.stringify(v)}
              </div>
              <span style={{ fontSize: 8, color: 'var(--text-subtle)' }}>{i}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
