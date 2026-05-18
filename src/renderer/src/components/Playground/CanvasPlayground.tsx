import { useState, useEffect, useRef, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'

const STARTER_TEMPLATES: { name: string; icon: string; code: string }[] = [
  {
    name: 'Bouncing Ball',
    icon: '⚽',
    code: `// Bouncing Ball — edit and see it live!
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

let x = 200, y = 150, dx = 3, dy = 2, r = 30

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Ball
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#89b4fa'
  ctx.fill()
  ctx.closePath()

  // Bounce off walls
  if (x + dx > canvas.width - r || x + dx < r)  dx = -dx
  if (y + dy > canvas.height - r || y + dy < r)  dy = -dy
  x += dx;  y += dy

  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Star Field',
    icon: '✨',
    code: `// Star Field — space travel!
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const stars = Array.from({length: 200}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  z: Math.random() * W, pz: 0
}))

function draw() {
  ctx.fillStyle = 'rgba(17,17,27,0.2)'
  ctx.fillRect(0, 0, W, H)
  stars.forEach(s => {
    s.pz = s.z
    s.z -= 4
    if (s.z <= 0) { s.x = Math.random()*W; s.y = Math.random()*H; s.z = W; s.pz = s.z }
    const sx = (s.x - W/2) * (W/s.z) + W/2
    const sy = (s.y - H/2) * (W/s.z) + H/2
    const px = (s.x - W/2) * (W/s.pz) + W/2
    const py = (s.y - H/2) * (W/s.pz) + H/2
    const size = Math.max(0.5, W/s.z)
    ctx.strokeStyle = \`rgba(205,214,244,\${1 - s.z/W})\`
    ctx.lineWidth = size
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke()
  })
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Color Spiral',
    icon: '🌀',
    code: `// Color Spiral
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const cx = canvas.width/2, cy = canvas.height/2
let t = 0

function draw() {
  ctx.fillStyle = 'rgba(17,17,27,0.05)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < 5; i++) {
    const a = t + i * 0.3
    const r = a * 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    const hue = (a * 20) % 360
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = \`hsl(\${hue}, 80%, 65%)\`
    ctx.fill()
  }
  t += 0.04
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Fractal Tree',
    icon: '🌲',
    code: `// Fractal Tree
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#1e1e2e'
ctx.fillRect(0,0,canvas.width,canvas.height)

function branch(x, y, len, angle, depth) {
  if (depth === 0 || len < 2) return
  const x2 = x + Math.cos(angle) * len
  const y2 = y + Math.sin(angle) * len
  const green = Math.floor((1 - depth/10) * 200 + 55)
  ctx.strokeStyle = depth > 4 ? \`rgb(101,79,54)\` : \`rgb(30,\${green},50)\`
  ctx.lineWidth = depth * 0.8
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke()
  branch(x2, y2, len * 0.72, angle - 0.4, depth - 1)
  branch(x2, y2, len * 0.72, angle + 0.4, depth - 1)
  branch(x2, y2, len * 0.6,  angle,       depth - 1)
}
branch(canvas.width/2, canvas.height-20, 80, -Math.PI/2, 10)`
  },
  {
    name: 'Lissajous',
    icon: '〰️',
    code: `// Lissajous Curve
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
let t = 0

function draw() {
  ctx.fillStyle = 'rgba(17,17,27,0.08)'
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 2
  let prev = null
  for (let i = 0; i < 300; i++) {
    const a = t + i * 0.02
    const x = W/2 + Math.sin(3*a + Math.PI/4) * W*0.4
    const y = H/2 + Math.sin(2*a) * H*0.4
    const hue = (i * 1.2) % 360
    ctx.strokeStyle = \`hsla(\${hue}, 80%, 65%, 0.8)\`
    if (prev) { ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke() }
    prev = {x, y}
  }
  t += 0.01
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Particles',
    icon: '✦',
    code: `// Particle System — click to burst!
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const particles = []

class Particle {
  constructor(x, y, burst) {
    this.x = x; this.y = y
    const angle = Math.random() * Math.PI * 2
    const speed = burst ? Math.random() * 6 + 2 : Math.random() * 0.5
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed - (burst ? 0 : 1)
    this.life = 1
    this.decay = burst ? Math.random() * 0.02 + 0.01 : 0.005
    this.r = Math.random() * (burst ? 4 : 2) + 1
    this.hue = Math.random() * 60 + (burst ? 20 : 200)
  }
  update() {
    this.x += this.vx; this.y += this.vy
    this.vy += 0.05; this.life -= this.decay
    this.vx *= 0.99
  }
  draw() {
    ctx.globalAlpha = this.life
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = \`hsl(\${this.hue},90%,65%)\`
    ctx.fill()
  }
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left, y = e.clientY - rect.top
  for (let i = 0; i < 60; i++) particles.push(new Particle(x, y, true))
})

function draw() {
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(17,17,27,0.15)'
  ctx.fillRect(0, 0, W, H)
  // Ambient particles
  if (particles.length < 200 && Math.random() < 0.3)
    particles.push(new Particle(Math.random() * W, H + 5, false))
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(); particles[i].draw()
    if (particles[i].life <= 0) particles.splice(i, 1)
  }
  ctx.globalAlpha = 1
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Game of Life',
    icon: '🧬',
    code: `// Conway's Game of Life
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const CELL = 8
const COLS = Math.floor(canvas.width / CELL)
const ROWS = Math.floor(canvas.height / CELL)

let grid = Array.from({length: ROWS}, () =>
  Array.from({length: COLS}, () => Math.random() < 0.3 ? 1 : 0))

function next() {
  return grid.map((row, r) => row.map((cell, c) => {
    let n = 0
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = (r + dr + ROWS) % ROWS, nc = (c + dc + COLS) % COLS
        n += grid[nr][nc]
      }
    return (cell && (n === 2 || n === 3)) || (!cell && n === 3) ? 1 : 0
  }))
}

let gen = 0
function draw() {
  ctx.fillStyle = '#1e1e2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell) return
    const hue = (r * 2 + c + gen * 2) % 360
    ctx.fillStyle = \`hsl(\${hue}, 70%, 65%)\`
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1)
  }))
  ctx.fillStyle = '#585b70'
  ctx.font = '10px monospace'
  ctx.fillText(\`Gen: \${gen}\`, 4, 12)
  grid = next(); gen++
  setTimeout(() => requestAnimationFrame(draw), 80)
}
draw()`
  },
  {
    name: 'Gravity Sim',
    icon: '🪐',
    code: `// Gravity Simulation — balls with physics
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const G = 0.4, BOUNCE = 0.75, FRICTION = 0.995

const balls = Array.from({length: 12}, (_, i) => ({
  x: 40 + Math.random() * (W - 80),
  y: 30 + Math.random() * (H * 0.4),
  r: 8 + Math.random() * 16,
  vx: (Math.random() - 0.5) * 4,
  vy: (Math.random() - 0.5) * 2,
  hue: i * 30
}))

function draw() {
  ctx.fillStyle = 'rgba(17,17,27,0.3)'
  ctx.fillRect(0, 0, W, H)

  balls.forEach(b => {
    b.vy += G; b.vx *= FRICTION; b.vy *= FRICTION
    b.x += b.vx; b.y += b.vy
    // Floor / ceiling
    if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * BOUNCE }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * BOUNCE }
    // Walls
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * BOUNCE }
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE }
    // Ball-ball collision
    balls.forEach(o => {
      if (o === b) return
      const dx = o.x - b.x, dy = o.y - b.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist < b.r + o.r) {
        const nx = dx/dist, ny = dy/dist
        const rel = (b.vx - o.vx)*nx + (b.vy - o.vy)*ny
        if (rel > 0) { b.vx -= rel*nx; b.vy -= rel*ny; o.vx += rel*nx; o.vy += rel*ny }
      }
    })
    // Draw
    const grad = ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, 1, b.x, b.y, b.r)
    grad.addColorStop(0, \`hsl(\${b.hue},80%,80%)\`)
    grad.addColorStop(1, \`hsl(\${b.hue},60%,40%)\`)
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2)
    ctx.fillStyle = grad; ctx.fill()
  })
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Perlin Terrain',
    icon: '🏔️',
    code: `// Perlin-ish Terrain — scrolling landscape
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height

// Simple smooth noise
function noise(x) {
  const i = Math.floor(x)
  const f = x - i
  const t = f*f*(3 - 2*f)
  return lerp(hash(i), hash(i+1), t)
}
function hash(n) {
  n = Math.sin(n * 127.1) * 43758.5453
  return n - Math.floor(n)
}
function lerp(a, b, t) { return a + (b-a)*t }
function octave(x, octs) {
  let v=0, amp=0.5, freq=1, max=0
  for(let i=0;i<octs;i++){v+=noise(x*freq)*amp;max+=amp;amp*=0.5;freq*=2}
  return v/max
}

let offset = 0
function draw() {
  ctx.fillStyle = '#11111b'
  ctx.fillRect(0, 0, W, H)

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H*0.6)
  sky.addColorStop(0, '#1e1e2e')
  sky.addColorStop(1, '#313244')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H * 0.6)

  // Mountains (3 layers)
  const layers = [
    {amp:0.35, freq:0.004, yBase:0.75, color:'#313244', spd:0.3},
    {amp:0.25, freq:0.008, yBase:0.82, color:'#45475a', spd:0.6},
    {amp:0.15, freq:0.015, yBase:0.88, color:'#585b70', spd:1.2},
  ]
  layers.forEach(l => {
    ctx.beginPath(); ctx.moveTo(0, H)
    for(let x=0;x<=W;x++){
      const h = octave((x + offset*l.spd) * l.freq, 5)
      ctx.lineTo(x, H * l.yBase - h * H * l.amp)
    }
    ctx.lineTo(W, H); ctx.closePath()
    ctx.fillStyle = l.color; ctx.fill()
  })

  // Ground
  ctx.fillStyle = '#1e1e2e'
  ctx.fillRect(0, H * 0.9, W, H * 0.1)

  offset += 1
  requestAnimationFrame(draw)
}
draw()`
  },
  {
    name: 'Blank Canvas',
    icon: '📄',
    code: `// Your canvas playground
// Canvas is 400×300 — draw anything!
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

// Draw a gradient background
const grad = ctx.createLinearGradient(0, 0, 400, 300)
grad.addColorStop(0, '#1e1e2e')
grad.addColorStop(1, '#313244')
ctx.fillStyle = grad
ctx.fillRect(0, 0, 400, 300)

// Your code here...
ctx.fillStyle = '#cdd6f4'
ctx.font = '20px monospace'
ctx.textAlign = 'center'
ctx.fillText('Hello, Canvas! 🎨', 200, 150)`
  }
]

interface Props { onClose: () => void }

export function CanvasPlayground({ onClose }: Props) {
  const { settings } = useAppStore()
  const [code, setCode] = useState(STARTER_TEMPLATES[0].code)
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  const runCode = useCallback((src: string) => {
    setError('')
    if (!iframeRef.current) return
    const html = `<!DOCTYPE html>
<html><head><style>
  body { margin:0; background:#1e1e2e; overflow:hidden; }
  canvas { display:block; }
</style></head>
<body>
<canvas id="canvas" width="400" height="300"></canvas>
<script>
  window.onerror = (msg, src, line, col) => {
    parent.postMessage({ type:'error', msg, line }, '*')
  }
  try {
    ${src}
  } catch(e) {
    parent.postMessage({ type:'error', msg: e.message }, '*')
  }
<\/script>
</body></html>`
    iframeRef.current.srcdoc = html
  }, [])

  // Listen for errors from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'error') setError(`Line ${e.data.line ?? '?'}: ${e.data.msg}`)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Debounced auto-run on code change
  useEffect(() => {
    if (runTimer.current) clearTimeout(runTimer.current)
    runTimer.current = setTimeout(() => runCode(code), 800)
    return () => { if (runTimer.current) clearTimeout(runTimer.current) }
  }, [code, runCode])

  // Run initial template
  useEffect(() => { runCode(code) }, [])

  const loadTemplate = (idx: number) => {
    setSelected(idx)
    setCode(STARTER_TEMPLATES[idx].code)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--accent-mauve)' }}>🎨 Canvas Playground</span>
        <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
          style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44' }}>
          ● live
        </span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          Edit code → canvas updates automatically
        </span>

        {/* Templates */}
        <div className="flex gap-1 ml-2">
          {STARTER_TEMPLATES.map((t, i) => (
            <button key={t.name} onClick={() => loadTemplate(i)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all"
              style={{
                background: selected === i ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                color: selected === i ? 'white' : 'var(--text-muted)',
                border: `1px solid ${selected === i ? 'var(--accent-mauve)' : 'var(--border)'}`
              }}
              title={t.name}>
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button onClick={onClose}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          ✕ Close
        </button>
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code editor — left */}
        <div className="flex flex-col" style={{ flex: '0 0 55%', borderRight: '1px solid var(--border)' }}>
          <div className="px-3 py-1 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            <span>JavaScript</span>
            <span className="ml-auto">Ctrl+A to select all</span>
          </div>
          <div className="flex-1">
            <MonacoEditor
              language="javascript"
              value={code}
              theme={monacoTheme}
              onChange={v => v !== undefined && setCode(v)}
              options={{
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily,
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                wordWrap: 'on',
                scrollbar: { verticalScrollbarSize: 4 },
                suggest: { showKeywords: true },
                quickSuggestions: true,
              }}
            />
          </div>
        </div>

        {/* Canvas preview — right */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#1e1e2e' }}>
          <div className="px-3 py-1 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-subtle)' }}>Canvas Output</span>
            <span style={{ color: 'var(--text-subtle)' }}>400 × 300</span>
            {error && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded"
                style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ⚠ {error}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts"
              style={{
                width: 400, height: 300,
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          {/* Info panel */}
          <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              🦊 Kitsune tip
            </p>
            <p className="text-xs" style={{ color: 'var(--text-subtle)', lineHeight: 1.5 }}>
              {STARTER_TEMPLATES[selected].name} — try changing numbers and colors!
              The canvas auto-refreshes 0.8s after you stop typing.
              Use <code style={{ color: 'var(--accent-blue)' }}>requestAnimationFrame(draw)</code> for animation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
