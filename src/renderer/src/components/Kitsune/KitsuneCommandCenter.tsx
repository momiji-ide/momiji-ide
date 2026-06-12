import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { callKitsune } from '../../utils/callKitsune'
import { toast } from '../../utils/toast'
import { getT, getLang } from '../../utils/i18n'
import {
  loadKitsuneSheet, getKitsuneSheet, drawKitsune, frameIndex, type KitsuneAnim
} from './kitsuneSheet'

// ─── Virtual scene space (scaled to canvas) ──────────────────────────────────
const VW = 900
const VH = 430

type AgentType = 'review' | 'test' | 'docs' | 'bug'
type Weather   = 'clear' | 'rain' | 'snow' | 'night'
type Phase     = 'out' | 'work' | 'celebrate' | 'angry' | 'back'

interface AgentDef {
  name: string; color: string; desk: { x: number; y: number }
  system: string; task: string
  demo: string
}

const AGENTS: Record<AgentType, AgentDef> = {
  review: {
    name: 'Code Reviewer', color: '#7F77DD', desk: { x: 400, y: 305 },
    system: 'You are a senior code reviewer inside Momiji IDE. Be concise and constructive. Use markdown. Max 6 bullet points.',
    task: 'Review this code. List the top issues (bugs, smells, style) with line references and a one-line fix each.',
    demo: '• Variable `total` shadowing on line 12 — rename inner one\n• Missing null check before `.length` on line 24\n• Consider extracting the loop body into a helper'
  },
  test: {
    name: 'Test Writer', color: '#1D9E75', desk: { x: 590, y: 305 },
    system: 'You are a test engineer inside Momiji IDE. Write focused unit tests. Use the idiomatic test framework for the language. Output only code with brief comments.',
    task: 'Write 3-5 unit tests for the main functions in this code.',
    demo: 'test("handles empty input", () => {\n  expect(run([])).toEqual([])\n})\ntest("sums correctly", () => {\n  expect(sum([1,2,3])).toBe(6)\n})'
  },
  docs: {
    name: 'Doc Writer', color: '#378ADD', desk: { x: 495, y: 392 },
    system: 'You are a technical writer inside Momiji IDE. Write clear, beginner-friendly docs. Use markdown.',
    task: 'Write a concise README section documenting what this code does, its main functions, and a usage example.',
    demo: '## What it does\nProcesses sensor readings and reports anomalies.\n\n### Usage\n```js\nconst r = analyze(readings)\n```'
  },
  bug: {
    name: 'Bug Hunter', color: '#D85A30', desk: { x: 700, y: 392 },
    system: 'You are a debugging expert inside Momiji IDE. Find the most likely bug. Be specific: file, line, why it breaks, and the fix.',
    task: 'Find the most likely bug in this code and propose a minimal fix.',
    demo: 'Likely bug: `i <= arr.length` on line 8 reads one past the end.\nFix: change to `i < arr.length`.'
  },
}

const DEN = { x: 110, y: 360 }

interface Agent {
  id: string; type: AgentType; phase: Phase
  pos: { x: number; y: number }; wp: { x: number; y: number }[]; wi: number
  t: number; phaseT: number; flip: boolean
  progress: number; resultId: number | null
}

interface LogEntry { time: string; who: string; text: string; color: string }
interface TaskResult { id: number; agent: string; type: AgentType; title: string; body: string; open: boolean }

function waypoints(desk: { x: number; y: number }, reverse: boolean) {
  const spot = { x: desk.x - 52, y: desk.y + 26 }
  const pts = [{ x: DEN.x + 40, y: DEN.y }, { x: 250, y: 380 }, { x: spot.x, y: spot.y }]
  return reverse ? pts.slice().reverse() : pts
}

// ─── Component ────────────────────────────────────────────────────────────────
export function KitsuneCommandCenter() {
  const t = getT(getLang())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentsRef = useRef<Agent[]>([])
  const seqRef    = useRef<Record<AgentType, number>>({ review: 0, test: 0, docs: 0, bug: 0 })
  const doneRef   = useRef<Record<AgentType, number>>({ review: 0, test: 0, docs: 0, bug: 0 })
  const weatherRef = useRef<Weather>('clear')
  const particlesRef = useRef<{ x: number; y: number; v: number; s: number }[]>([])
  const demoWarnedRef = useRef(false)
  const resultSeq = useRef(0)

  const [, force] = useState(0)
  const rerender = () => force(n => n + 1)
  const [weather, setWeather]   = useState<Weather>('clear')
  const [autoWeather, setAutoWeather] = useState(true)
  const [cmd, setCmd]           = useState('')
  const [logs, setLogs]         = useState<LogEntry[]>([])
  const [results, setResults]   = useState<TaskResult[]>([])
  const [sheetReady, setSheetReady] = useState(false)

  useEffect(() => { weatherRef.current = weather; particlesRef.current = [] }, [weather])

  // Auto weather cycle
  useEffect(() => {
    if (!autoWeather) return
    const order: Weather[] = ['clear', 'rain', 'night', 'snow']
    const id = setInterval(() => {
      setWeather(w => order[(order.indexOf(w) + 1) % order.length])
    }, 50000)
    return () => clearInterval(id)
  }, [autoWeather])

  useEffect(() => { loadKitsuneSheet().then(() => setSheetReady(true)).catch(() => {}) }, [])

  const addLog = useCallback((who: string, text: string, color: string) => {
    const time = new Date().toLocaleTimeString().slice(0, 8)
    setLogs(prev => [{ time, who, text, color }, ...prev].slice(0, 30))
  }, [])

  // ─── Dispatch ──────────────────────────────────────────────────────────────
  const dispatch = useCallback((type: AgentType) => {
    if (agentsRef.current.length >= 6) { toast.warning(t.cc_full); return }
    const def = AGENTS[type]
    seqRef.current[type]++
    const id = def.name.split(' ')[0] + '-' + seqRef.current[type]
    const agent: Agent = {
      id, type, phase: 'out',
      pos: { x: DEN.x + 40, y: DEN.y }, wp: waypoints(def.desk, false), wi: 0,
      t: Math.random() * 9, phaseT: 0, flip: true, progress: 0, resultId: null
    }
    agentsRef.current.push(agent)
    addLog(id, `dispatched → ${def.name} desk`, def.color)
    rerender()

    // Run the real task in parallel with the walk
    runTask(agent).then(({ title, body, demo }) => {
      const rid = ++resultSeq.current
      agent.resultId = rid
      setResults(prev => [{ id: rid, agent: agent.id, type, title, body, open: false }, ...prev].slice(0, 12))
      agent.progress = 1
      if (demo && !demoWarnedRef.current) {
        demoWarnedRef.current = true
        addLog('SYS', t.cc_demo_note, '#888780')
      }
    }).catch((e: any) => {
      agent.progress = -1
      addLog(agent.id, 'failed: ' + (e?.message ?? 'unknown error'), '#E24B4A')
    })
  }, [addLog])

  async function runTask(agent: Agent): Promise<{ title: string; body: string; demo: boolean }> {
    const def = AGENTS[agent.type]
    const { tabs, activeTabId, aiProviders } = useAppStore.getState()
    const tab = tabs.find(t => t.id === activeTabId)
    const hasAI = aiProviders.some(p => p.enabled && p.apiKey)

    if (!hasAI || !tab) {
      await new Promise(r => setTimeout(r, 4500 + Math.random() * 3000))
      return {
        title: tab ? `${def.name}: ${tab.fileName}` : `${def.name}: (no file open)`,
        body: def.demo, demo: true
      }
    }
    const prompt = `File: ${tab.fileName}\n\`\`\`\n${tab.content.slice(0, 3500)}\n\`\`\`\n\n${def.task}`
    const out = await callKitsune(prompt, def.system)
    return { title: `${def.name}: ${tab.fileName}`, body: out, demo: false }
  }

  // Command bar → keyword routing
  const handleCommand = () => {
    const c = cmd.trim().toLowerCase()
    if (!c) return
    addLog('YOU', `"${cmd.trim()}"`, '#F97316')
    const hits: AgentType[] = []
    if (/review|cek|periksa/.test(c)) hits.push('review')
    if (/test|uji/.test(c))           hits.push('test')
    if (/doc|readme|dokumen/.test(c)) hits.push('docs')
    if (/bug|fix|error|benerin/.test(c)) hits.push('bug')
    if (hits.length === 0) hits.push('review')
    hits.forEach((h, i) => setTimeout(() => dispatch(h), i * 500))
    setCmd('')
  }

  // ─── Render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const dpr = window.devicePixelRatio || 1

    const fit = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      canvas.width = w * dpr; canvas.height = h * dpr
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      const w = canvas.clientWidth, h = canvas.clientHeight
      const s = Math.min(w / VW, h / VH)
      const ox = (w - VW * s) / 2, oy = (h - VH * s) / 2

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.translate(ox, oy)
      ctx.scale(s, s)

      drawOffice(ctx, t)
      updateAndDrawAgents(ctx, t, dt)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [sheetReady]) // eslint-disable-line

  // ─── Scene drawing ─────────────────────────────────────────────────────────
  function drawOffice(ctx: CanvasRenderingContext2D, t: number) {
    // Wall + floor
    ctx.fillStyle = '#2b2420'; ctx.fillRect(0, 0, VW, 285)
    ctx.fillStyle = '#201a16'; ctx.fillRect(0, 285, VW, VH - 285)
    ctx.strokeStyle = 'rgba(249,115,22,0.25)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 285); ctx.lineTo(VW, 285); ctx.stroke()
    // Floor planks
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
    for (let y = 305; y < VH; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke() }

    drawWindow(ctx, 140, 45, 200, 165, t)
    drawWindow(ctx, 590, 45, 200, 165, t)

    // Momiji wall art between windows
    ctx.fillStyle = 'rgba(249,115,22,0.12)'
    ctx.strokeStyle = 'rgba(249,115,22,0.4)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(465, 125, 38, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#F97316'; ctx.font = 'bold 30px serif'; ctx.textAlign = 'center'
    ctx.fillText('🍁', 465, 136)

    // Den corner — cushion + mini torii
    ctx.fillStyle = 'rgba(249,115,22,0.10)'
    ctx.strokeStyle = '#F97316'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(DEN.x, DEN.y + 8, 64, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#E24B4A'; ctx.lineWidth = 5
    ctx.beginPath(); ctx.moveTo(DEN.x - 42, 290); ctx.lineTo(DEN.x - 42, 240); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(DEN.x + 42, 290); ctx.lineTo(DEN.x + 42, 240); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(DEN.x - 56, 242); ctx.lineTo(DEN.x + 56, 242); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(DEN.x - 48, 254); ctx.lineTo(DEN.x + 48, 254); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Kitsune Den', DEN.x, 230)

    // Desks
    for (const k of Object.keys(AGENTS) as AgentType[]) {
      const d = AGENTS[k]
      const busy = agentsRef.current.some(a => a.type === k && a.phase === 'work')
      // table
      ctx.fillStyle = '#3a2f28'
      ctx.fillRect(d.desk.x - 55, d.desk.y - 6, 110, 12)
      ctx.fillRect(d.desk.x - 48, d.desk.y + 6, 8, 22)
      ctx.fillRect(d.desk.x + 40, d.desk.y + 6, 8, 22)
      // monitor
      ctx.fillStyle = '#15110e'
      ctx.fillRect(d.desk.x - 22, d.desk.y - 42, 44, 32)
      ctx.fillStyle = busy ? d.color : 'rgba(255,255,255,0.08)'
      ctx.globalAlpha = busy ? 0.55 + 0.25 * Math.sin(t * 5) : 1
      ctx.fillRect(d.desk.x - 18, d.desk.y - 38, 36, 24)
      ctx.globalAlpha = 1
      // label + counter
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(d.name, d.desk.x, d.desk.y + 46)
      ctx.fillStyle = d.color; ctx.font = '10px monospace'
      ctx.fillText(doneRef.current[k] + ' done', d.desk.x, d.desk.y + 60)
    }

    // Boss kitsune idle at the den
    const img = getKitsuneSheet()
    if (img) {
      drawShadow(ctx, DEN.x, DEN.y + 10, 40)
      drawKitsune(ctx, img, 'idle', frameIndex('idle', t), DEN.x, DEN.y + 10 + Math.sin(t * 1.6) * 2, 92)
    }
  }

  function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
    const wt = weatherRef.current
    const sky: Record<Weather, string> = { clear: '#7fb2dd', rain: '#5a6573', snow: '#9fb3c8', night: '#141d38' }
    ctx.save()
    ctx.fillStyle = sky[wt]
    ctx.fillRect(x, y, w, h)
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()

    if (wt === 'clear') {
      ctx.fillStyle = '#ffd76b'
      ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.3, 22, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      const cx1 = x + ((t * 7) % (w + 120)) - 60
      drawCloud(ctx, cx1, y + h * 0.35)
      drawCloud(ctx, x + ((t * 4 + 80) % (w + 120)) - 60, y + h * 0.6)
    } else if (wt === 'night') {
      ctx.fillStyle = '#f5f0d8'
      ctx.beginPath(); ctx.arc(x + w * 0.72, y + h * 0.28, 16, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = sky.night
      ctx.beginPath(); ctx.arc(x + w * 0.72 + 7, y + h * 0.28 - 4, 14, 0, Math.PI * 2); ctx.fill()
      for (let i = 0; i < 14; i++) {
        const sx = x + ((i * 73) % w), sy = y + ((i * 47) % (h * 0.7))
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i))
        ctx.fillStyle = `rgba(255,255,240,${tw})`
        ctx.fillRect(sx, sy, 2, 2)
      }
    } else {
      // rain / snow particles
      const P = particlesRef.current
      const want = wt === 'rain' ? 46 : 30
      while (P.length < want) P.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.8, s: Math.random() })
      for (const p of P) {
        if (wt === 'rain') {
          p.y += p.v * 0.045
          const px = x + p.x * w, py = y + p.y * h
          ctx.strokeStyle = 'rgba(220,235,255,0.55)'; ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 11); ctx.stroke()
        } else {
          p.y += p.v * 0.012
          const px = x + ((p.x + Math.sin(t * 1.2 + p.s * 9) * 0.03) % 1) * w
          const py = y + p.y * h
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.beginPath(); ctx.arc(px, py, 1.6 + p.s * 1.6, 0, Math.PI * 2); ctx.fill()
        }
        if (p.y > 1) { p.y = -0.05; p.x = Math.random() }
      }
    }
    ctx.restore()
    // frame + cross bars
    ctx.strokeStyle = '#4a3c32'; ctx.lineWidth = 7
    ctx.strokeRect(x, y, w, h)
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke()
    // sill
    ctx.fillStyle = '#4a3c32'; ctx.fillRect(x - 8, y + h, w + 16, 8)
  }

  function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.beginPath()
    ctx.arc(cx, cy, 13, 0, Math.PI * 2)
    ctx.arc(cx + 14, cy - 6, 11, 0, Math.PI * 2)
    ctx.arc(cx + 27, cy, 12, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  }

  // ─── Agent simulation ──────────────────────────────────────────────────────
  function updateAndDrawAgents(ctx: CanvasRenderingContext2D, t: number, dt: number) {
    const img = getKitsuneSheet()
    const SPEED = 95
    let changed = false

    for (const a of [...agentsRef.current]) {
      a.t += dt; a.phaseT += dt
      const def = AGENTS[a.type]

      if (a.phase === 'out' || a.phase === 'back') {
        const target = a.wp[a.wi]
        const dx = target.x - a.pos.x, dy = target.y - a.pos.y
        const d = Math.hypot(dx, dy)
        if (d < SPEED * dt) {
          a.pos = { ...target }; a.wi++
          if (a.wi >= a.wp.length) {
            if (a.phase === 'out') {
              a.phase = 'work'; a.phaseT = 0
              addLog(a.id, 'working at the desk…', def.color); changed = true
            } else {
              agentsRef.current = agentsRef.current.filter(x => x !== a)
              changed = true
            }
          }
        } else {
          a.pos.x += dx / d * SPEED * dt; a.pos.y += dy / d * SPEED * dt
          a.flip = dx >= 0
        }
      } else if (a.phase === 'work') {
        if (a.progress >= 1) {
          doneRef.current[a.type]++
          a.phase = 'celebrate'; a.phaseT = 0
          addLog(a.id, 'done! ✓ result ready below', '#1D9E75'); changed = true
        } else if (a.progress < 0) {
          a.phase = 'angry'; a.phaseT = 0; changed = true
        }
      } else if (a.phase === 'celebrate' || a.phase === 'angry') {
        if (a.phaseT > 1.6) {
          a.phase = 'back'; a.wp = waypoints(def.desk, true); a.wi = 0
        }
      }

      // Draw
      if (img) {
        const anim: KitsuneAnim =
          a.phase === 'work' ? 'work' :
          a.phase === 'celebrate' ? 'celebrate' :
          a.phase === 'angry' ? 'angry' : 'walk'
        const bob = (a.phase === 'out' || a.phase === 'back') ? Math.sin(a.t * 13) * 1.5 : 0
        drawShadow(ctx, a.pos.x, a.pos.y + 4, 24)
        drawKitsune(ctx, img, anim, frameIndex(anim, a.t), a.pos.x, a.pos.y + 4 + bob, 66, a.flip)
        // name tag
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        const tag = a.id
        ctx.font = '600 9px monospace'
        const tw = ctx.measureText(tag).width + 8
        ctx.fillRect(a.pos.x - tw / 2, a.pos.y + 8, tw, 13)
        ctx.fillStyle = def.color; ctx.textAlign = 'center'
        ctx.fillText(tag, a.pos.x, a.pos.y + 18)
        // progress while working (pseudo until promise resolves)
        if (a.phase === 'work') {
          const shown = a.progress >= 1 ? 1 : Math.min(0.92, 1 - Math.exp(-a.phaseT / 4))
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(a.pos.x - 20, a.pos.y - 78, 40, 5)
          ctx.fillStyle = def.color; ctx.fillRect(a.pos.x - 20, a.pos.y - 78, 40 * shown, 5)
        }
      }
    }
    if (changed) rerender()
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  const activeAgents = agentsRef.current
  const WEATHERS: { id: Weather; icon: string; label: string }[] = [
    { id: 'clear', icon: '☀️', label: 'Cerah' },
    { id: 'rain',  icon: '🌧️', label: 'Hujan' },
    { id: 'snow',  icon: '❄️', label: 'Salju' },
    { id: 'night', icon: '🌙', label: 'Malam' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: 42, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>
          🦊 KITSUNE COMMAND CENTER
        </span>
        <div className="flex-1" />
        {WEATHERS.map(w => (
          <button key={w.id} title={w.label}
            onClick={() => { setWeather(w.id); setAutoWeather(false) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
            style={{ background: weather === w.id && !autoWeather ? 'var(--accent-mauve)' : 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
            {w.icon}
          </button>
        ))}
        <button onClick={() => setAutoWeather(a => !a)}
          className="px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: autoWeather ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: autoWeather ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          ⟳ Auto
        </button>
      </div>

      {/* Command bar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ background: 'linear-gradient(to right, rgba(249,115,22,0.07), transparent)', borderBottom: '1px solid var(--border)' }}>
        <input
          value={cmd} onChange={e => setCmd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCommand() }}
          placeholder={t.cc_cmd_placeholder}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <button onClick={handleCommand}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none' }}>
          {t.cc_send}
        </button>
        {(Object.keys(AGENTS) as AgentType[]).map(k => (
          <button key={k} onClick={() => dispatch(k)} title={'Dispatch ' + AGENTS[k].name}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: AGENTS[k].color, display: 'inline-block' }} />
            {AGENTS[k].name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Office canvas */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 260, background: '#1a1512' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Bottom: feed + results */}
      <div className="flex flex-shrink-0" style={{ height: 190, borderTop: '1px solid var(--border)' }}>
        {/* Activity feed */}
        <div className="flex flex-col overflow-hidden" style={{ width: '42%', borderRight: '1px solid var(--border)' }}>
          <div className="px-3 py-1.5 text-xs font-semibold flex-shrink-0 flex items-center gap-2"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {t.cc_live}
            <span className="text-xs px-1.5 rounded-full" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)' }}>
              {activeAgents.length} {t.cc_active}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.8 }}>
            {logs.length === 0 && <span style={{ color: 'var(--text-subtle)' }}>{t.cc_feed_empty}</span>}
            {logs.map((l, i) => (
              <div key={i}>
                <span style={{ color: 'var(--text-subtle)', opacity: 0.6 }}>{l.time}</span>{' '}
                <span style={{ color: l.color, fontWeight: 600 }}>{l.who}</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {t.cc_results}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
            {results.length === 0 && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.cc_results_empty}</span>}
            {results.map(r => (
              <div key={r.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setResults(prev => prev.map(x => x.id === r.id ? { ...x, open: !x.open } : x))}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: AGENTS[r.type].color, flexShrink: 0 }} />
                  <span className="font-semibold truncate flex-1">{r.title}</span>
                  <span style={{ color: 'var(--text-subtle)' }}>{r.open ? '▲' : '▼'}</span>
                </button>
                {r.open && (
                  <div className="px-3 py-2" style={{ background: 'var(--bg-base)' }}>
                    <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", maxHeight: 200, overflow: 'auto' }}>
                      {r.body}
                    </pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(r.body); toast.success('Copied!') }}
                      className="mt-1.5 px-2 py-0.5 rounded text-xs"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      📋 Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
