import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { callKitsune } from '../../utils/callKitsune'
import { toast } from '../../utils/toast'
import { getT, getLang } from '../../utils/i18n'
import { drawPixelKitsune, pixelFrameIndex, type PixelAnim } from './pixelKitsune'

// ─── Virtual scene space (scaled to canvas) ──────────────────────────────────
const VW = 512
const VH = 512

// Back wall height — everything below this is floor.
const WALL_H = 196

// Wall windows — weather is rendered inside these rects.
const LEFT_WINDOW  = { x: 14,  y: 18, w: 140, h: 160 }
const RIGHT_WINDOW = { x: 396, y: 18, w: 102, h: 140 }

// Back-wall door — agents enter/exit through here.
const DOOR = { x: 296, y: 54, w: 76, h: 152 }

type AgentType = 'review' | 'test' | 'docs' | 'bug'
type Weather   = 'clear' | 'rain' | 'snow' | 'night'
type Phase     = 'out' | 'work' | 'celebrate' | 'angry' | 'back'

interface AgentDef {
  name: string; color: string; desk: { x: number; y: number }
  system: string; task: string
  demo: string
}

// Desk positions tuned to land near the isometric desks in the momiji office
// BG image (512×512). If you swap to a different theme, retune these.
const AGENTS: Record<AgentType, AgentDef> = {
  review: {
    name: 'Code Reviewer', color: '#7F77DD', desk: { x: 195, y: 295 },
    system: 'You are a senior code reviewer inside Momiji IDE. Be concise and constructive. Use markdown. Max 6 bullet points.',
    task: 'Review this code. List the top issues (bugs, smells, style) with line references and a one-line fix each.',
    demo: '• Variable `total` shadowing on line 12 — rename inner one\n• Missing null check before `.length` on line 24\n• Consider extracting the loop body into a helper'
  },
  test: {
    name: 'Test Writer', color: '#1D9E75', desk: { x: 330, y: 295 },
    system: 'You are a test engineer inside Momiji IDE. Write focused unit tests. Use the idiomatic test framework for the language. Output only code with brief comments.',
    task: 'Write 3-5 unit tests for the main functions in this code.',
    demo: 'test("handles empty input", () => {\n  expect(run([])).toEqual([])\n})\ntest("sums correctly", () => {\n  expect(sum([1,2,3])).toBe(6)\n})'
  },
  docs: {
    name: 'Doc Writer', color: '#378ADD', desk: { x: 200, y: 395 },
    system: 'You are a technical writer inside Momiji IDE. Write clear, beginner-friendly docs. Use markdown.',
    task: 'Write a concise README section documenting what this code does, its main functions, and a usage example.',
    demo: '## What it does\nProcesses sensor readings and reports anomalies.\n\n### Usage\n```js\nconst r = analyze(readings)\n```'
  },
  bug: {
    name: 'Bug Hunter', color: '#D85A30', desk: { x: 335, y: 395 },
    system: 'You are a debugging expert inside Momiji IDE. Find the most likely bug. Be specific: file, line, why it breaks, and the fix.',
    task: 'Find the most likely bug in this code and propose a minimal fix.',
    demo: 'Likely bug: `i <= arr.length` on line 8 reads one past the end.\nFix: change to `i < arr.length`.'
  },
}

// Where agents step onto the floor when they walk through the door.
const ENTRY = { x: 334, y: WALL_H + 4 }

// Background pixelation — the procedurally-drawn room is downsampled to this
// size then scaled back up with nearest-neighbor, so it blends with the
// blocky pixel-art kitsune sprites.
const PIXEL_SIZE = 176

interface Agent {
  id: string; type: AgentType; phase: Phase
  pos: { x: number; y: number }; wp: { x: number; y: number }[]; wi: number
  t: number; phaseT: number; flip: boolean
  progress: number; resultId: number | null
}

interface LogEntry { time: string; who: string; text: string; color: string }
interface TaskResult { id: number; agent: string; type: AgentType; title: string; body: string; open: boolean }

// Central aisle between the two desk columns (desks span ~155-240 / ~290-375).
const AISLE_X = 264

// Rotating speech-bubble lines shown above an agent while it works.
const WORK_BUBBLES: Record<AgentType, string[]> = {
  review: ['🔍 reading code…', '🤔 checking style…', '📝 noting issues…'],
  test:   ['⌨️ writing tests…', '🧪 running cases…', '🤞 edge cases…'],
  docs:   ['✍️ drafting docs…', '📚 explaining…', '✨ polishing…'],
  bug:    ['🐛 hunting bugs…', '🔬 tracing stack…', '💡 found a clue…'],
}

function waypoints(desk: { x: number; y: number }, reverse: boolean) {
  // Stand just in front (below in iso projection) of the desk. Route through
  // the central aisle so agents never cut through another desk on the way.
  const spot = { x: desk.x, y: desk.y + 28 }
  const pts = [
    { x: ENTRY.x, y: ENTRY.y },
    { x: AISLE_X, y: ENTRY.y + 26 },
    { x: AISLE_X, y: spot.y },
    { x: spot.x, y: spot.y },
  ]
  return reverse ? pts.slice().reverse() : pts
}

// ─── Component ────────────────────────────────────────────────────────────────
export function KitsuneCommandCenter() {
  const t = getT(getLang())
  const activeFile = useAppStore(s => s.tabs.find(tab => tab.id === s.activeTabId)?.fileName ?? null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentsRef = useRef<Agent[]>([])
  const seqRef    = useRef<Record<AgentType, number>>({ review: 0, test: 0, docs: 0, bug: 0 })
  const doneRef   = useRef<Record<AgentType, number>>({ review: 0, test: 0, docs: 0, bug: 0 })
  const weatherRef = useRef<Weather>('clear')
  type Particle = { x: number; y: number; v: number; s: number }
  const particlesRef = useRef<{ left: Particle[]; right: Particle[] }>({ left: [], right: [] })
  const demoWarnedRef = useRef(false)
  const resultSeq = useRef(0)
  // 0 = closed, 1 = fully open — eased toward open whenever an agent is near the door.
  const doorOpenRef = useRef(0)

  const [, force] = useState(0)
  const rerender = () => force(n => n + 1)
  const [weather, setWeather]   = useState<Weather>('clear')
  const [autoWeather, setAutoWeather] = useState(true)
  // Crossfade state between weather looks, so changes feel smooth instead of a hard cut.
  const weatherTransRef = useRef<{ from: Weather; to: Weather; p: number }>({ from: 'clear', to: 'clear', p: 1 })
  const [cmd, setCmd]           = useState('')
  const [logs, setLogs]         = useState<LogEntry[]>([])
  const [results, setResults]   = useState<TaskResult[]>([])

  useEffect(() => {
    weatherTransRef.current = { from: weatherRef.current, to: weather, p: 0 }
    weatherRef.current = weather
    particlesRef.current = { left: [], right: [] }
  }, [weather])

  // Auto weather cycle
  useEffect(() => {
    if (!autoWeather) return
    const order: Weather[] = ['clear', 'rain', 'night', 'snow']
    const id = setInterval(() => {
      setWeather(w => order[(order.indexOf(w) + 1) % order.length])
    }, 50000)
    return () => clearInterval(id)
  }, [autoWeather])


  const addLog = useCallback((who: string, text: string, color: string) => {
    const time = new Date().toLocaleTimeString().slice(0, 8)
    setLogs(prev => [{ time, who, text, color }, ...prev].slice(0, 30))
  }, [])

  // ─── Dispatch ──────────────────────────────────────────────────────────────
  // `extraContext` (if given) is appended to the prompt — used for chaining,
  // where one agent's findings feed the next agent's task.
  // `onResult` fires once the task settles, with the result body (or '' on
  // failure) — used to advance a chain to the next agent.
  const dispatch = useCallback((type: AgentType, extraContext?: string, onResult?: (body: string) => void) => {
    const def = AGENTS[type]
    seqRef.current[type]++
    const id = def.name.split(' ')[0] + '-' + seqRef.current[type]
    const agent: Agent = {
      id, type, phase: 'out',
      pos: { x: ENTRY.x, y: ENTRY.y }, wp: waypoints(def.desk, false), wi: 0,
      t: Math.random() * 9, phaseT: 0, flip: true, progress: 0, resultId: null
    }
    agentsRef.current.push(agent)
    addLog(id, `${t.cc_dispatched} ${def.name} ${t.cc_desk}`, def.color)
    rerender()

    // Run the real task in parallel with the walk
    runTask(agent, extraContext).then(({ title, body, demo }) => {
      const rid = ++resultSeq.current
      agent.resultId = rid
      // Auto-expand the newest result, collapse the rest, so output is visible.
      setResults(prev => [{ id: rid, agent: agent.id, type, title, body, open: true },
                          ...prev.map(r => ({ ...r, open: false }))].slice(0, 12))
      agent.progress = 1
      if (demo && !demoWarnedRef.current) {
        demoWarnedRef.current = true
        addLog('SYS', t.cc_demo_note, '#888780')
      }
      onResult?.(body)
    }).catch((e: any) => {
      agent.progress = -1
      addLog(agent.id, 'failed: ' + (e?.message ?? 'unknown error'), '#E24B4A')
      onResult?.('')
    })
  }, [addLog])

  // Dispatch a sequence of agents where each one only starts after the
  // previous one finishes, with the previous agent's result passed along as
  // extra context — e.g. Bug Hunter's findings feed into Code Reviewer's task.
  const dispatchChain = useCallback((types: AgentType[]) => {
    const run = (idx: number, context?: string) => {
      if (idx >= types.length) return
      dispatch(types[idx], context, (body) => {
        setTimeout(() => run(idx + 1, body), 600)
      })
    }
    run(0)
  }, [dispatch])

  async function runTask(agent: Agent, extraContext?: string): Promise<{ title: string; body: string; demo: boolean }> {
    const def = AGENTS[agent.type]
    const { tabs, activeTabId, aiProviders } = useAppStore.getState()
    const tab = tabs.find(t => t.id === activeTabId)
    const hasAI = aiProviders.some(p => p.enabled && p.apiKey)

    if (!hasAI || !tab) {
      await new Promise(r => setTimeout(r, 4500 + Math.random() * 3000))
      return {
        title: tab ? `${def.name}: ${tab.fileName}` : `${def.name}: ${t.cc_no_file}`,
        body: def.demo, demo: true
      }
    }
    const context = extraContext ? `\n\nFindings from a previous agent in this chain:\n${extraContext.slice(0, 1500)}\n` : ''
    const prompt = `File: ${tab.fileName}\n\`\`\`\n${tab.content.slice(0, 3500)}\n\`\`\`\n${context}\n${def.task}`
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

    // Offscreen canvases for pixelating the procedural room (downsample +
    // nearest-neighbor upscale), kept separate from the crisp sprite/label layer.
    const sceneCanvas = document.createElement('canvas')
    sceneCanvas.width = VW; sceneCanvas.height = VH
    const sceneCtx = sceneCanvas.getContext('2d')!
    const smallCanvas = document.createElement('canvas')
    smallCanvas.width = PIXEL_SIZE; smallCanvas.height = PIXEL_SIZE
    const smallCtx = smallCanvas.getContext('2d')!

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

      // Advance the weather crossfade
      const wTrans = weatherTransRef.current
      if (wTrans.p < 1) wTrans.p = Math.min(1, wTrans.p + dt / 1.2)

      // Door swings open when any agent is close to the doorway
      const nearDoor = agentsRef.current.some(a => Math.hypot(a.pos.x - ENTRY.x, a.pos.y - ENTRY.y) < 70)
      doorOpenRef.current += ((nearDoor ? 1 : 0) - doorOpenRef.current) * Math.min(1, dt * 7)

      // Draw the room into the scene canvas, then pixelate it onto the
      // visible canvas so it blends with the blocky kitsune sprites.
      sceneCtx.clearRect(0, 0, VW, VH)
      drawOfficeScene(sceneCtx, t)
      smallCtx.imageSmoothingEnabled = true
      smallCtx.clearRect(0, 0, PIXEL_SIZE, PIXEL_SIZE)
      smallCtx.drawImage(sceneCanvas, 0, 0, VW, VH, 0, 0, PIXEL_SIZE, PIXEL_SIZE)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(smallCanvas, 0, 0, PIXEL_SIZE, PIXEL_SIZE, 0, 0, VW, VH)
      ctx.imageSmoothingEnabled = true

      drawDeskLabels(ctx)
      updateAndDrawAgents(ctx, t, dt)
      drawDeskFronts(ctx, t)
      drawAmbientTint(ctx)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, []) // eslint-disable-line

  // ─── Scene drawing ─────────────────────────────────────────────────────────
  // A fully hand-drawn office: warm wall + wood floor, two windows, a back
  // door agents walk through, and a 2x2 desk grid. Drawn into an offscreen
  // canvas each frame and pixelated before compositing onto the visible one.
  function drawOfficeScene(ctx: CanvasRenderingContext2D, t: number) {
    // Back wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, WALL_H)
    wallGrad.addColorStop(0, '#f6e5db')
    wallGrad.addColorStop(1, '#ece8e9')
    ctx.fillStyle = wallGrad
    ctx.fillRect(0, 0, VW, WALL_H)

    // Floor
    const floorGrad = ctx.createLinearGradient(0, WALL_H, 0, VH)
    floorGrad.addColorStop(0, '#c9a98a')
    floorGrad.addColorStop(1, '#a3805f')
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, WALL_H, VW, VH - WALL_H)

    // Floor planks
    ctx.strokeStyle = 'rgba(89,66,62,0.15)'; ctx.lineWidth = 1
    for (let y = WALL_H + 18; y < VH; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke()
    }

    // Baseboard
    ctx.fillStyle = '#7a5c4a'
    ctx.fillRect(0, WALL_H - 6, VW, 8)

    // Windows + door
    drawWindow(ctx, LEFT_WINDOW)
    drawWindow(ctx, RIGHT_WINDOW)
    drawDoor(ctx, doorOpenRef.current)

    // Wall + floor decor
    drawShelf(ctx, 178, 24)
    drawClock(ctx, 334, 28)
    drawPlant(ctx, 466, WALL_H - 2, t)
    drawPlant(ctx, 36, WALL_H - 2, t + 2.4)
    drawPrinter(ctx, 64, 330, t)
    drawWaterCooler(ctx, 452, 330, t)

    // Chair backs — drawn before the kitsune sprites so they peek out behind
    for (const k of Object.keys(AGENTS) as AgentType[]) {
      drawChairBack(ctx, AGENTS[k].desk, AGENTS[k].color)
    }

    // Weather, rendered inside both windows with a crossfade between looks
    drawWeather(ctx, t)
  }

  // Desk labels (name + done counter) — drawn crisp on the main canvas, on
  // top of the pixelated scene, so the text stays readable.
  function drawDeskLabels(ctx: CanvasRenderingContext2D) {
    for (const k of Object.keys(AGENTS) as AgentType[]) {
      const d = AGENTS[k]
      const label = `${d.name} · ${doneRef.current[k]} done`
      ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center'
      const tw = ctx.measureText(label).width + 14
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.roundRect(d.desk.x - tw / 2, d.desk.y + 50, tw, 17, 8); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(label, d.desk.x, d.desk.y + 62)
    }
  }

  // Daytime cityscape baked into a window pane (clear-weather baseline).
  function drawWindow(ctx: CanvasRenderingContext2D, win: { x: number; y: number; w: number; h: number }) {
    const { x, y, w, h } = win
    ctx.fillStyle = '#59423e'
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8)

    const sky = ctx.createLinearGradient(x, y, x, y + h)
    sky.addColorStop(0, '#bfe3f0')
    sky.addColorStop(1, '#f7e0c4')
    ctx.fillStyle = sky
    ctx.fillRect(x, y, w, h)

    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.22, 14, 0, Math.PI * 2); ctx.fill()

    ctx.fillStyle = '#dba07a'
    for (let i = 0; i < 3; i++) ctx.fillRect(x + i * (w / 3) + 2, y + h * 0.68, w / 3 - 4, h * 0.32)

    ctx.strokeStyle = '#59423e'; ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h)
    ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2)
    ctx.stroke()
  }

  // Back-wall door — agents walk in/out through here. `open` (0..1) swings
  // the panel toward the left hinge, revealing a dark hallway behind it.
  function drawDoor(ctx: CanvasRenderingContext2D, open: number) {
    const { x, y, w, h } = DOOR
    ctx.fillStyle = '#59423e'
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
    // Hallway behind the door, visible while open
    ctx.fillStyle = '#241a18'
    ctx.fillRect(x, y, w, h)
    if (open > 0.1) {
      // a sliver of warm light spilling in from the hallway
      ctx.fillStyle = `rgba(244,152,84,${0.12 * open})`
      ctx.fillRect(x, y, w, h)
    }
    // Door panel — width shrinks toward the hinge as a cheap swing effect
    const pw = w * (1 - 0.85 * open)
    if (pw > 3) {
      ctx.fillStyle = '#8e6c61'
      ctx.fillRect(x, y, pw, h)
      if (pw > 30) {
        ctx.strokeStyle = 'rgba(70,42,36,0.4)'; ctx.lineWidth = 2
        ctx.strokeRect(x + 8, y + 8, pw - 16, h * 0.45)
        ctx.strokeRect(x + 8, y + h * 0.55, pw - 16, h * 0.4 - 8)
      }
      ctx.fillStyle = '#f49854'
      ctx.beginPath(); ctx.arc(x + pw - 9, y + h * 0.55, 3, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Working wall clock above the door — hands follow the real time.
  function drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.fillStyle = '#59423e'
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f6f6f8'
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill()
    const now = new Date()
    const mAng = (now.getMinutes() + now.getSeconds() / 60) / 60 * Math.PI * 2 - Math.PI / 2
    const hAng = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2
    ctx.strokeStyle = '#271e23'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(hAng) * 6, cy + Math.sin(hAng) * 6); ctx.stroke()
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mAng) * 9, cy + Math.sin(mAng) * 9); ctx.stroke()
  }

  // Office printer on a side table — periodically spits out a page.
  function drawPrinter(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    // side table
    ctx.fillStyle = '#59423e'
    ctx.beginPath(); ctx.roundRect(x - 26, y, 52, 9, 3); ctx.fill()
    ctx.fillStyle = '#462a24'
    ctx.fillRect(x - 21, y + 9, 5, 14)
    ctx.fillRect(x + 16, y + 9, 5, 14)
    // page sliding out the front (cycles every 6s), then "taken"
    const cyc = t % 6
    const slide = Math.min(1, Math.max(0, (cyc - 0.8) / 1.8))
    if (cyc < 4.6 && slide > 0) {
      ctx.fillStyle = '#f6f6f8'
      ctx.fillRect(x - 8, y - 8, 16, 6 + slide * 12)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1
      for (let i = 1; i <= 3; i++) {
        const ly = y - 4 + i * slide * 4
        ctx.beginPath(); ctx.moveTo(x - 5, ly); ctx.lineTo(x + 5, ly); ctx.stroke()
      }
    }
    // printer body (drawn after the page so the page emerges from inside)
    ctx.fillStyle = '#3a3338'
    ctx.beginPath(); ctx.roundRect(x - 18, y - 18, 36, 15, 3); ctx.fill()
    ctx.fillStyle = '#271e23'
    ctx.fillRect(x - 12, y - 9, 24, 3)
    // status LED blinks while "printing"
    ctx.fillStyle = cyc < 3 ? `rgba(34,197,94,${0.5 + 0.5 * Math.sin(t * 10)})` : 'rgba(34,197,94,0.9)'
    ctx.fillRect(x + 11, y - 15, 3, 3)
  }

  // Water cooler — translucent bottle with bubbles drifting up.
  function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    // base unit
    ctx.fillStyle = '#ece8e9'
    ctx.beginPath(); ctx.roundRect(x - 11, y - 26, 22, 26, 3); ctx.fill()
    ctx.fillStyle = '#a69ea5'
    ctx.fillRect(x - 8, y - 18, 16, 5)
    // bottle
    ctx.fillStyle = 'rgba(96,165,250,0.55)'
    ctx.beginPath(); ctx.roundRect(x - 9, y - 46, 18, 20, 4); ctx.fill()
    // water line wobbles slightly
    ctx.fillStyle = 'rgba(147,197,253,0.5)'
    ctx.fillRect(x - 9, y - 46 + 4 + Math.sin(t * 1.8) * 1.2, 18, 2)
    // a bubble rising inside the bottle
    const bub = (t * 7) % 16
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath(); ctx.arc(x + Math.sin(t * 2.2) * 3, y - 28 - bub, 1.6, 0, Math.PI * 2); ctx.fill()
    // paper cup on the tray
    ctx.fillStyle = '#f6f6f8'
    ctx.fillRect(x - 3, y - 16, 6, 6)
  }

  // Small bookshelf with colorful book spines, between the windows.
  function drawShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#8e6c61'
    ctx.fillRect(x, y, 92, 72)
    ctx.fillStyle = '#59423e'
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 6 + i * 22, 84, 4)

    const colors = ['#dc7f42', '#7F77DD', '#1D9E75', '#378ADD', '#D85A30', '#f49854']
    for (let row = 0; row < 3; row++) {
      let bx = x + 6
      for (let i = 0; i < 6; i++) {
        const bw = 6 + (i % 3) * 2
        const bh = 16
        ctx.fillStyle = colors[(i + row * 2) % colors.length]
        ctx.fillRect(bx, y + 6 + row * 22 - bh, bw, bh)
        bx += bw + 2
      }
    }
  }

  // Potted plant in the corner of the back wall — leaves sway gently.
  function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.fillStyle = '#8e6c61'
    ctx.beginPath()
    ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.lineTo(x + 10, y + 22); ctx.lineTo(x - 10, y + 22)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#1D9E75'
    for (let i = 0; i < 5; i++) {
      const sway = Math.sin(t * 1.3 + i * 0.9) * 0.08
      const ang = -Math.PI / 2 + (i - 2) * 0.4 + sway
      ctx.beginPath()
      ctx.ellipse(x + Math.cos(ang) * 10, y - Math.sin(ang) * 22, 6, 16, ang + sway, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Chair back, drawn before the sprite so it peeks out behind a seated kitsune.
  function drawChairBack(ctx: CanvasRenderingContext2D, desk: { x: number; y: number }, color: string) {
    const spot = { x: desk.x, y: desk.y + 28 }
    ctx.fillStyle = '#462a24'
    ctx.beginPath(); ctx.roundRect(spot.x - 22, spot.y - 38, 44, 40, 8); ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = color
    ctx.beginPath(); ctx.roundRect(spot.x - 16, spot.y - 32, 32, 26, 6); ctx.fill()
    ctx.globalAlpha = 1
  }

  // Desk surface + monitor, drawn after the sprites so a seated kitsune's
  // legs disappear behind the desk — the "sitting" illusion.
  function drawDeskFronts(ctx: CanvasRenderingContext2D, t: number) {
    for (const k of Object.keys(AGENTS) as AgentType[]) {
      const d = AGENTS[k]
      const busy = agentsRef.current.some(a => a.type === k && a.phase === 'work')
      const spot = { x: d.desk.x, y: d.desk.y + 28 }

      ctx.fillStyle = '#8e6c61'
      ctx.beginPath(); ctx.roundRect(spot.x - 40, spot.y - 18, 80, 12, 3); ctx.fill()
      ctx.fillStyle = '#59423e'
      ctx.beginPath(); ctx.roundRect(spot.x - 40, spot.y - 8, 80, 26, [0, 0, 6, 6]); ctx.fill()

      // Monitor — low on the desk surface so it covers a seated kitsune's
      // torso but leaves the head and ears visible above it.
      ctx.fillStyle = '#271e23'
      ctx.beginPath(); ctx.roundRect(spot.x - 12, spot.y - 20, 24, 14, 2); ctx.fill()
      ctx.fillStyle = busy ? d.color : '#3a3338'
      ctx.globalAlpha = busy ? 0.6 + 0.3 * Math.sin(t * 6) : 1
      ctx.fillRect(spot.x - 9, spot.y - 17, 18, 9)
      ctx.globalAlpha = 1
    }
  }

  // ─── Weather ────────────────────────────────────────────────────────────────
  const ease = (p: number) => p * p * (3 - 2 * p)

  function drawWeather(ctx: CanvasRenderingContext2D, t: number) {
    const { from, to, p } = weatherTransRef.current
    const k = ease(p)
    if (from !== 'clear') drawWeatherInWindow(ctx, LEFT_WINDOW, particlesRef.current.left, from, (1 - k), t, false)
    if (to !== 'clear')   drawWeatherInWindow(ctx, LEFT_WINDOW, particlesRef.current.left, to, k, t, true)
    if (from !== 'clear') drawWeatherInWindow(ctx, RIGHT_WINDOW, particlesRef.current.right, from, (1 - k), t, false)
    if (to !== 'clear')   drawWeatherInWindow(ctx, RIGHT_WINDOW, particlesRef.current.right, to, k, t, true)
  }

  function drawWeatherInWindow(
    ctx: CanvasRenderingContext2D,
    win: { x: number; y: number; w: number; h: number },
    particles: { x: number; y: number; v: number; s: number }[],
    wt: Weather, alpha: number, t: number, advance: boolean
  ) {
    if (alpha <= 0.01) return
    const { x, y, w, h } = win
    ctx.save()
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    ctx.globalAlpha = alpha

    if (wt === 'night') {
      ctx.fillStyle = 'rgba(8,12,32,0.6)'; ctx.fillRect(x, y, w, h)
      for (let i = 0; i < 14; i++) {
        const sx = x + (i * 37) % w, sy = y + (i * 23) % (h * 0.7)
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i))
        ctx.fillStyle = `rgba(255,255,240,${tw})`
        ctx.fillRect(sx, sy, 2, 2)
      }
      ctx.fillStyle = '#f5f0d8'
      ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.22, 12, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = wt === 'rain' ? 'rgba(40,55,80,0.4)' : 'rgba(180,200,225,0.3)'
      ctx.fillRect(x, y, w, h)

      const want = wt === 'rain' ? 30 : 22
      while (particles.length < want) particles.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.8, s: Math.random() })
      for (const part of particles) {
        if (wt === 'rain') {
          if (advance) part.y += part.v * 0.06
          const px = x + part.x * w, py = y + part.y * h
          ctx.strokeStyle = 'rgba(220,235,255,0.6)'; ctx.lineWidth = 1.2
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 2, py + 9); ctx.stroke()
        } else {
          if (advance) part.y += part.v * 0.016
          const px = x + ((part.x + Math.sin(t * 1.2 + part.s * 9) * 0.03) % 1) * w
          const py = y + part.y * h
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.beginPath(); ctx.arc(px, py, 1.2 + part.s * 1.4, 0, Math.PI * 2); ctx.fill()
        }
        if (advance && part.y > 1) { part.y = -0.05; part.x = Math.random() }
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Ambient lighting tint over the whole scene — keeps the room's mood in
  // sync with the weather even outside the window panes, with a crossfade.
  function drawAmbientTint(ctx: CanvasRenderingContext2D) {
    const tintFor = (wx: Weather): [string, number] => {
      switch (wx) {
        case 'night': return ['#0a0e23', 0.38]
        case 'rain':  return ['#283750', 0.14]
        case 'snow':  return ['#c8d7eb', 0.10]
        default:      return ['#000000', 0]
      }
    }
    const { from, to, p } = weatherTransRef.current
    const k = ease(p)
    const [fc, fa] = tintFor(from)
    const [tc, ta] = tintFor(to)
    if (fa * (1 - k) > 0.001) {
      ctx.fillStyle = fc; ctx.globalAlpha = fa * (1 - k)
      ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1
    }
    if (ta * k > 0.001) {
      ctx.fillStyle = tc; ctx.globalAlpha = ta * k
      ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1
    }
  }

  function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  }

  // ─── Agent simulation ──────────────────────────────────────────────────────
  function updateAndDrawAgents(ctx: CanvasRenderingContext2D, t: number, dt: number) {
    const tr = getT(getLang())   // t (param) is time; tr = translations
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
              addLog(a.id, tr.cc_working, def.color); changed = true
            } else {
              agentsRef.current = agentsRef.current.filter(x => x !== a)
              changed = true
            }
          }
        } else {
          a.pos.x += dx / d * SPEED * dt; a.pos.y += dy / d * SPEED * dt
          a.flip = dx < 0   // sprite faces right by default; flip when moving left
        }
      } else if (a.phase === 'work') {
        if (a.progress >= 1) {
          doneRef.current[a.type]++
          a.phase = 'celebrate'; a.phaseT = 0
          addLog(a.id, tr.cc_done, '#1D9E75'); changed = true
        } else if (a.progress < 0) {
          a.phase = 'angry'; a.phaseT = 0; changed = true
        }
      } else if (a.phase === 'celebrate' || a.phase === 'angry') {
        if (a.phaseT > 1.6) {
          a.phase = 'back'; a.wp = waypoints(def.desk, true); a.wi = 0
        }
      }

      // Draw
      {
        const anim: PixelAnim =
          a.phase === 'work' ? 'work' :
          a.phase === 'celebrate' ? 'celebrate' :
          a.phase === 'angry' ? 'work' : 'walk'
        // Seated agents are drawn smaller and lower so they look like they're
        // sitting behind the desk/chair instead of towering over it. The head
        // pokes above the (low) monitor; the desk front hides the legs.
        const seated = a.phase === 'work' || a.phase === 'celebrate' || a.phase === 'angry'
        const bob = (a.phase === 'out' || a.phase === 'back') ? Math.sin(a.t * 13) * 1.5 : 0
        const destH = seated ? 50 : 60
        const feetY = seated ? a.pos.y + 8 : a.pos.y + 4 + bob
        drawShadow(ctx, a.pos.x, feetY + 2, seated ? 16 : 20)
        drawPixelKitsune(ctx, anim, pixelFrameIndex(anim, a.t), a.pos.x, feetY, destH, a.flip)
        // name tag — only while walking; desk fronts cover seated agents anyway
        if (!seated) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)'
          const tag = a.id
          ctx.font = '600 9px monospace'
          const tw = ctx.measureText(tag).width + 8
          ctx.fillRect(a.pos.x - tw / 2, a.pos.y + 8, tw, 13)
          ctx.fillStyle = def.color; ctx.textAlign = 'center'
          ctx.fillText(tag, a.pos.x, a.pos.y + 18)
        }
        // progress while working (pseudo until promise resolves)
        if (a.phase === 'work') {
          const shown = a.progress >= 1 ? 1 : Math.min(0.92, 1 - Math.exp(-a.phaseT / 4))
          const barY = feetY - destH - 10
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(a.pos.x - 20, barY, 40, 5)
          ctx.fillStyle = def.color; ctx.fillRect(a.pos.x - 20, barY, 40 * shown, 5)
        }
        // speech bubble — live status while working, verdict on wrap-up
        {
          const bubble =
            a.phase === 'work' ? WORK_BUBBLES[a.type][Math.floor(a.phaseT / 2.4) % WORK_BUBBLES[a.type].length] :
            a.phase === 'celebrate' ? '✅ done!' :
            a.phase === 'angry' ? '😤 failed' : null
          if (bubble) {
            const by = feetY - destH - (a.phase === 'work' ? 28 : 14)
            ctx.font = '600 9px sans-serif'
            const bw = ctx.measureText(bubble).width + 12
            ctx.fillStyle = 'rgba(255,255,255,0.93)'
            ctx.beginPath(); ctx.roundRect(a.pos.x - bw / 2, by, bw, 14, 6); ctx.fill()
            ctx.beginPath()
            ctx.moveTo(a.pos.x - 3, by + 13); ctx.lineTo(a.pos.x + 3, by + 13); ctx.lineTo(a.pos.x, by + 18)
            ctx.closePath(); ctx.fill()
            ctx.fillStyle = '#3a3338'; ctx.textAlign = 'center'
            ctx.fillText(bubble, a.pos.x, by + 10)
          }
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

      {/* Quick presets — multi-agent recipes for common workflows */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 flex-shrink-0 text-xs flex-wrap"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>Quick presets:</span>
        {[
          { label: '🌅 Daily standup',    agents: ['review','test','docs','bug'] as AgentType[] },
          { label: '✅ Pre-commit check', agents: ['review','bug']                as AgentType[] },
          { label: '📚 Doc + test it',    agents: ['docs','test']                 as AgentType[] },
          { label: '🐛 Hunt the bug',     agents: ['bug','review']                as AgentType[] },
          { label: '🔗 Bug → Review chain', agents: ['bug','review'] as AgentType[], chain: true },
        ].map(p => (
          <button key={p.label}
            onClick={() => p.chain ? dispatchChain(p.agents) : p.agents.forEach((a, i) => setTimeout(() => dispatch(a), i * 450))}
            title={p.chain ? 'Runs sequentially — Bug Hunter\'s findings feed Code Reviewer\'s task' : undefined}
            className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Context banner — which file the agents will work on */}
      <div className="flex items-center gap-2 px-4 py-1 flex-shrink-0 text-xs"
        style={{ background: activeFile ? 'var(--accent-green)18' : 'var(--accent-yellow)18',
                 borderBottom: '1px solid var(--border)',
                 color: activeFile ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
        {activeFile
          ? <>📄 Agents will analyze: <strong>{activeFile}</strong></>
          : <>⚠ {t.cc_no_file_hint}</>}
      </div>

      {/* Main split — office animation left, mission dashboard + tasks right */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: animated office + activity feed underneath */}
        <div className="flex flex-col overflow-hidden" style={{ width: '55%', borderRight: '1px solid var(--border)' }}>
          <div className="flex-1 overflow-hidden" style={{ minHeight: 220, background: '#1a1512' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ height: 128, borderTop: '1px solid var(--border)' }}>
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
        </div>

        {/* Right: mission dashboard (pipeline flow + agent status) over results */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Dashboard */}
          <div className="flex-shrink-0 px-3 py-2"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
            <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--accent-mauve)' }}>
              📊 MISSION CONTROL
            </div>

            {/* Pipeline flow — live counts moving left to right */}
            <div className="flex items-center gap-1 mb-2.5 flex-wrap"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
              {(() => {
                const walking = activeAgents.filter(a => a.phase === 'out' || a.phase === 'back').length
                const working = activeAgents.filter(a => a.phase === 'work').length
                const wrapup  = activeAgents.filter(a => a.phase === 'celebrate' || a.phase === 'angry').length
                const done    = (Object.keys(AGENTS) as AgentType[]).reduce((s, k) => s + doneRef.current[k], 0)
                const stages = [
                  { icon: '🚶', label: 'WALK', n: walking },
                  { icon: '💻', label: 'WORK', n: working },
                  { icon: '🎉', label: 'WRAP', n: wrapup },
                  { icon: '✅', label: 'DONE', n: done },
                ]
                return stages.map((s, i) => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                      style={{
                        background: s.n > 0 ? 'var(--bg-surface0)' : 'transparent',
                        border: '1px solid var(--border)',
                        color: s.n > 0 ? 'var(--text)' : 'var(--text-subtle)',
                        boxShadow: s.n > 0 && i < 3 ? '0 0 6px rgba(249,115,22,0.35)' : 'none',
                      }}>
                      {s.icon} {s.label} <strong style={{ color: s.n > 0 ? 'var(--accent-mauve)' : 'inherit' }}>{s.n}</strong>
                    </span>
                    {i < stages.length - 1 && <span style={{ color: 'var(--text-subtle)' }}>→</span>}
                  </span>
                ))
              })()}
            </div>

            {/* Per-agent status board */}
            <div className="flex flex-col gap-1">
              {(Object.keys(AGENTS) as AgentType[]).map(k => {
                const live = activeAgents.find(a => a.type === k)
                const status =
                  !live ? 'idle' :
                  live.phase === 'work' ? 'working' :
                  live.phase === 'out' ? 'walking in' :
                  live.phase === 'back' ? 'returning' :
                  live.phase === 'angry' ? 'failed' : 'celebrating'
                const extra = activeAgents.filter(a => a.type === k).length - 1
                return (
                  <div key={k} className="flex items-center gap-2 text-xs"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: 99, background: AGENTS[k].color, flexShrink: 0,
                      boxShadow: live ? `0 0 5px ${AGENTS[k].color}` : 'none', opacity: live ? 1 : 0.4,
                    }} />
                    <span className="w-24 truncate" style={{ color: 'var(--text)' }}>{AGENTS[k].name}</span>
                    <span className="flex-1" style={{ color: live ? AGENTS[k].color : 'var(--text-subtle)' }}>
                      {status}{extra > 0 ? ` (+${extra})` : ''}
                    </span>
                    <span style={{ color: 'var(--text-subtle)' }}>{doneRef.current[k]} ✓</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Results */}
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
