import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from '../../utils/toast'

// ── Preset easings ──────────────────────────────────────────────────────────

const PRESETS: Record<string, [number, number, number, number]> = {
  'linear':       [0, 0, 1, 1],
  'ease':         [0.25, 0.1, 0.25, 1],
  'ease-in':      [0.42, 0, 1, 1],
  'ease-out':     [0, 0, 0.58, 1],
  'ease-in-out':  [0.42, 0, 0.58, 1],
  'ease-in-back': [0.36, 0, 0.66, -0.56],
  'ease-out-back':[0.34, 1.56, 0.64, 1],
  'ease-in-out-back': [0.68, -0.6, 0.32, 1.6],
  'bounce-out':   [0.34, 1.8, 0.64, 1],
  'sharp':        [0.4, 0, 0.6, 1],
  'spring':       [0.175, 0.885, 0.32, 1.275],
}

// cubic bezier evaluation
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  return function(t: number): number {
    // Newton-Raphson numerical solver
    const ax = 3*p1x - 3*p2x + 1, bx = 3*p2x - 6*p1x, cx = 3*p1x
    const ay = 3*p1y - 3*p2y + 1, by = 3*p2y - 6*p1y, cy = 3*p1y
    const sampleX = (t: number) => ((ax*t + bx)*t + cx)*t
    const sampleY = (t: number) => ((ay*t + by)*t + cy)*t
    const sampleDX = (t: number) => (3*ax*t + 2*bx)*t + cx

    let x = t
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(x) - t
      if (Math.abs(dx) < 1e-6) break
      x -= dx / sampleDX(x)
    }
    return sampleY(x)
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function EasingVisualizer() {
  const [cp, setCp] = useState<[number, number, number, number]>([0.25, 0.1, 0.25, 1]) // p1x p1y p2x p2y
  const [preset, setPreset] = useState('ease')
  const [animating, setAnimating] = useState(false)
  const [animProgress, setAnimProgress] = useState(0)
  const [comparison, setComparison] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)

  const [p1x, p1y, p2x, p2y] = cp
  const easing = cubicBezier(p1x, p1y, p2x, p2y)

  // Draw curve on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const pad = 32

    ctx.clearRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = '#313244'; ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const x = pad + (i / 4) * (W - pad * 2)
      const y = pad + (i / 4) * (H - pad * 2)
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke()
    }

    const toCanvas = (nx: number, ny: number) => [
      pad + nx * (W - pad * 2),
      H - pad - ny * (H - pad * 2)
    ]

    // Linear reference
    ctx.strokeStyle = '#45475a'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(...toCanvas(0, 0) as [number, number]); ctx.lineTo(...toCanvas(1, 1) as [number, number]); ctx.stroke()
    ctx.setLineDash([])

    // Control point handles
    const [ox, oy] = toCanvas(0, 0), [ex, ey] = toCanvas(1, 1)
    const [c1x, c1y] = toCanvas(p1x, p1y), [c2x, c2y] = toCanvas(p2x, p2y)

    ctx.strokeStyle = '#6c7086'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(c1x, c1y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(c2x, c2y); ctx.stroke()

    // Control points
    ;[[c1x, c1y, '#f97316'], [c2x, c2y, '#cba6f7']].forEach(([x, y, col]) => {
      ctx.fillStyle = col as string; ctx.beginPath()
      ctx.arc(x as number, y as number, 6, 0, Math.PI * 2); ctx.fill()
    })

    // Curve
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.beginPath()
    for (let i = 0; i <= 100; i++) {
      const t = i / 100
      const y = easing(t)
      const [cx, cy] = toCanvas(t, y)
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
    }
    ctx.stroke()

    // Current animation dot
    if (animating || animProgress > 0) {
      const y = easing(animProgress)
      const [cx, cy] = toCanvas(animProgress, y)
      ctx.fillStyle = '#a6e3a1'
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
    }
  }, [cp, animProgress, animating, easing])

  // Draggable control points on canvas
  const dragRef = useRef<null | 'p1' | 'p2'>(null)
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const W = canvas.width, H = canvas.height, pad = 32
    const mx = (e.clientX - rect.left) * (W / rect.width)
    const my = (e.clientY - rect.top) * (H / rect.height)
    const toCanvas = (nx: number, ny: number) => [pad + nx * (W - pad * 2), H - pad - ny * (H - pad * 2)]
    const [c1x, c1y] = toCanvas(p1x, p1y)
    const [c2x, c2y] = toCanvas(p2x, p2y)
    const dist = (ax: number, ay: number) => Math.hypot(mx - ax, my - ay)
    if (dist(c1x, c1y) < 14) dragRef.current = 'p1'
    else if (dist(c2x, c2y) < 14) dragRef.current = 'p2'
  }, [p1x, p1y, p2x, p2y])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const W = canvas.width, H = canvas.height, pad = 32
    const nx = Math.max(-0.5, Math.min(1.5, (e.clientX - rect.left) * (W / rect.width) - pad) / (W - pad * 2))
    const ny = Math.max(-0.5, Math.min(1.5, 1 - ((e.clientY - rect.top) * (H / rect.height) - pad) / (H - pad * 2)))
    setCp(prev => {
      if (dragRef.current === 'p1') return [nx, ny, prev[2], prev[3]]
      return [prev[0], prev[1], nx, ny]
    })
    setPreset('custom')
  }, [])

  const onMouseUp = () => { dragRef.current = null }

  // Play animation
  const playAnim = () => {
    if (animating) { if (animRef.current) cancelAnimationFrame(animRef.current); setAnimating(false); setAnimProgress(0); return }
    setAnimating(true)
    const start = performance.now()
    const dur = 1200
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setAnimProgress(t)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
      else { setTimeout(() => { setAnimating(false); setAnimProgress(0) }, 400) }
    }
    animRef.current = requestAnimationFrame(tick)
  }

  const cssValue = `cubic-bezier(${[p1x, p1y, p2x, p2y].map(v => +v.toFixed(3)).join(', ')})`
  const gsapValue = `{ease: "power2.out"}  // closest: ${preset}`

  const copy = (text: string) => { window.api.clipboard.writeText(text); toast.success('Copied!') }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: 44, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>📐 EASING VISUALIZER</span>
        <div className="flex-1" />
        <button onClick={playAnim}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{ background: animating ? 'var(--accent-red)' : 'var(--accent-green)', color: 'var(--bg-base)' }}>
          {animating ? '■ Stop' : '▶ Preview'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: canvas */}
        <div className="flex flex-col items-center justify-center p-4" style={{ flex: '0 0 280px', borderRight: '1px solid var(--border)' }}>
          <canvas ref={canvasRef} width={240} height={240}
            style={{ borderRadius: 12, background: '#1e1e2e', cursor: 'crosshair', width: '100%', aspectRatio: '1' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
          <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
            🟠 P1 handle &nbsp; 🟣 P2 handle — drag to reshape
          </p>
        </div>

        {/* Right: controls + output */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Presets */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map(k => (
                <button key={k} onClick={() => { setCp(PRESETS[k]); setPreset(k) }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    background: preset === k ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                    color: preset === k ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${preset === k ? 'var(--accent-mauve)' : 'var(--border)'}`,
                  }}>{k}</button>
              ))}
            </div>
          </div>

          {/* Manual sliders */}
          <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: 'var(--bg-surface0)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Control Points</p>
            {[['P1 X', 0, -0.5, 1.5], ['P1 Y', 1, -0.5, 1.5], ['P2 X', 2, -0.5, 1.5], ['P2 Y', 3, -0.5, 1.5]].map(([label, idx, min, max]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className="text-xs w-12" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <input type="range" min={min} max={max} step={0.01} value={cp[idx as number]}
                  onChange={e => { setCp(prev => { const n = [...prev] as typeof prev; n[idx as number] = +e.target.value; return n }); setPreset('custom') }}
                  style={{ flex: 1, accentColor: 'var(--accent-mauve)' }} />
                <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--text)' }}>{(+cp[idx as number]).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Animation demo */}
          {(animating || animProgress > 0) && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Preview</p>
              <div style={{ height: 20, background: 'var(--bg-surface1)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-mauve)', position: 'absolute',
                  left: `calc(${easing(animProgress) * 100}% - 10px)`, transition: 'none'
                }} />
              </div>
              <div style={{ height: 20, background: 'var(--bg-surface1)', borderRadius: 999, overflow: 'hidden', position: 'relative', marginTop: 6 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#45475a', position: 'absolute',
                  left: `calc(${animProgress * 100}% - 10px)`, transition: 'none'
                }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>Orange = eased &nbsp;·&nbsp; Grey = linear</p>
            </div>
          )}

          {/* Output */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Export</p>
            {[
              { label: 'CSS', value: `transition: all 0.4s ${cssValue};` },
              { label: 'CSS var', value: cssValue },
              { label: 'GSAP', value: `gsap.to(el, { duration: 0.4, ease: "power2.out" })` },
              { label: 'Framer', value: `transition={{ duration: 0.4, ease: [${[p1x,p1y,p2x,p2y].map(v=>+v.toFixed(3)).join(',')}] }}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
                <span className="text-xs font-semibold w-14 flex-shrink-0" style={{ color: 'var(--accent-mauve)' }}>{label}</span>
                <code className="text-xs flex-1 truncate" style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{value}</code>
                <button onClick={() => copy(value)} className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>copy</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
