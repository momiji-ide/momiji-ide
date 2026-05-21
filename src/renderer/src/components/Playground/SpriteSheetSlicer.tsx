import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from '../../utils/toast'

interface Frame { x: number; y: number; w: number; h: number; name: string }

export function SpriteSheetSlicer() {
  const [imgSrc, setImgSrc]       = useState<string | null>(null)
  const [imgSize, setImgSize]     = useState({ w: 0, h: 0 })
  const [cols, setCols]           = useState(4)
  const [rows, setRows]           = useState(4)
  const [frameW, setFrameW]       = useState(0)
  const [frameH, setFrameH]       = useState(0)
  const [mode, setMode]           = useState<'auto' | 'manual'>('auto')
  const [frames, setFrames]       = useState<Frame[]>([])
  const [preview, setPreview]     = useState<number | null>(null)
  const [animFps, setAnimFps]     = useState(8)
  const [animPlaying, setAnimPlaying] = useState(false)
  const [animFrame, setAnimFrame] = useState(0)
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set())

  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const previewRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const imgRef        = useRef<HTMLImageElement | null>(null)
  const animTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const computeFrames = useCallback((w: number, h: number, c: number, r: number): Frame[] => {
    const fw = Math.floor(w / c), fh = Math.floor(h / r)
    return Array.from({ length: c * r }, (_, i) => ({
      x: (i % c) * fw, y: Math.floor(i / c) * fh, w: fw, h: fh,
      name: `frame_${String(i).padStart(3, '0')}`
    }))
  }, [])

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgSrc(url)
      setImgSize({ w: img.width, h: img.height })
      const fw = Math.floor(img.width / cols), fh = Math.floor(img.height / rows)
      setFrameW(fw); setFrameH(fh)
      const f = computeFrames(img.width, img.height, cols, rows)
      setFrames(f)
      setSelectedFrames(new Set(f.map((_, i) => i)))
      toast.success(`Loaded ${img.width}×${img.height} — ${f.length} frames`)
    }
    img.src = url
  }

  // Redraw canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current, img = imgRef.current
    if (!canvas || !img || !imgSrc) return
    const scale = Math.min(canvas.offsetWidth / img.width, 200 / img.height, 1)
    canvas.width = img.width * scale; canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    frames.forEach((f, i) => {
      ctx.strokeStyle = selectedFrames.has(i) ? '#f97316' : '#45475a'
      ctx.lineWidth = 1
      ctx.strokeRect(f.x * scale, f.y * scale, f.w * scale, f.h * scale)
      ctx.fillStyle = 'rgba(249,115,22,0.08)'
      if (selectedFrames.has(i)) ctx.fillRect(f.x * scale, f.y * scale, f.w * scale, f.h * scale)
      if (i === preview) {
        ctx.fillStyle = 'rgba(249,115,22,0.25)'
        ctx.fillRect(f.x * scale, f.y * scale, f.w * scale, f.h * scale)
      }
    })
  }, [imgSrc, frames, selectedFrames, preview])

  // Animation preview
  useEffect(() => {
    const canvas = previewRef.current, img = imgRef.current
    if (!canvas || !img || frames.length === 0) return
    const f = frames[preview ?? animFrame]
    if (!f) return
    const scale = Math.min(120 / f.w, 120 / f.h, 3)
    canvas.width = f.w * scale; canvas.height = f.h * scale
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, canvas.width, canvas.height)
  }, [preview, animFrame, frames])

  useEffect(() => {
    if (animPlaying) {
      animTimerRef.current = setInterval(() => {
        setAnimFrame(f => (f + 1) % frames.length)
      }, 1000 / animFps)
    } else {
      if (animTimerRef.current) clearInterval(animTimerRef.current)
    }
    return () => { if (animTimerRef.current) clearInterval(animTimerRef.current) }
  }, [animPlaying, animFps, frames.length])

  const reslice = (c = cols, r = rows) => {
    if (!imgRef.current) return
    const f = computeFrames(imgSize.w, imgSize.h, c, r)
    setFrames(f); setSelectedFrames(new Set(f.map((_, i) => i)))
    setFrameW(Math.floor(imgSize.w / c)); setFrameH(Math.floor(imgSize.h / r))
  }

  const exportJSON = () => {
    const sel = frames.filter((_, i) => selectedFrames.has(i))
    const data = {
      meta: { image: 'spritesheet.png', size: { w: imgSize.w, h: imgSize.h }, scale: 1 },
      frames: Object.fromEntries(sel.map(f => [f.name, {
        frame: { x: f.x, y: f.y, w: f.w, h: f.h },
        rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
        sourceSize: { w: f.w, h: f.h }
      }]))
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('Phaser/Pixi JSON copied!')
  }

  const exportCSS = () => {
    const sel = frames.filter((_, i) => selectedFrames.has(i))
    const css = sel.map(f =>
      `.${f.name} { background-position: -${f.x}px -${f.y}px; width: ${f.w}px; height: ${f.h}px; }`
    ).join('\n')
    navigator.clipboard.writeText(css)
    toast.success('CSS sprite positions copied!')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && loadImage(e.target.files[0])} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: 44, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>🖼️ SPRITE SHEET SLICER</span>
        <div className="flex-1" />
        {imgSrc && <>
          <button onClick={exportJSON} className="px-2 py-1 rounded text-xs font-semibold"
            style={{ background: 'var(--bg-surface0)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44' }}>
            JSON (Phaser)
          </button>
          <button onClick={exportCSS} className="px-2 py-1 rounded text-xs font-semibold"
            style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
            CSS
          </button>
        </>}
        <button onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white' }}>
          📂 Load Sprite Sheet
        </button>
      </div>

      {!imgSrc ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 56 }}>🖼️</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Load a sprite sheet to slice it</p>
          <p className="text-xs text-center" style={{ color: 'var(--text-subtle)', maxWidth: 300 }}>
            Upload a PNG sprite sheet (e.g. from Aseprite, TexturePacker, or Kenney assets).
            Auto-slice by grid, preview animation, export to Phaser/Pixi JSON or CSS.
          </p>
          <button onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent-mauve)', color: 'white' }}>
            📂 Open Sprite Sheet
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Left: controls */}
          <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-shrink-0"
            style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>

            <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: 'var(--bg-surface0)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Grid Slice</p>
              {[['Columns', cols, setCols], ['Rows', rows, setRows]].map(([label, val, setter]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="text-xs w-16" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <input type="number" min={1} max={64} value={val as number}
                    onChange={e => { const v = Math.max(1, +e.target.value); (setter as Function)(v); label === 'Columns' ? reslice(v, rows) : reslice(cols, v) }}
                    className="flex-1 px-2 py-1 rounded text-xs text-center outline-none"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }} />
                </div>
              ))}
              <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                Frame: {frameW}×{frameH}px · {frames.length} total
              </p>
            </div>

            {/* Frame list */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Frames ({selectedFrames.size})</p>
                <button onClick={() => setSelectedFrames(new Set(frames.map((_, i) => i)))}
                  className="text-xs" style={{ color: 'var(--accent-mauve)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  All
                </button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {frames.map((_, i) => (
                  <button key={i} onClick={() => {
                    const s = new Set(selectedFrames)
                    s.has(i) ? s.delete(i) : s.add(i)
                    setSelectedFrames(s)
                    setPreview(i)
                  }}
                    style={{
                      width: 24, height: 24, borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                      background: selectedFrames.has(i) ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                      color: selectedFrames.has(i) ? 'white' : 'var(--text-muted)',
                      border: preview === i ? '2px solid var(--accent-yellow)' : '1px solid var(--border)'
                    }}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation preview */}
            <div className="p-3 rounded-xl flex flex-col gap-2 items-center" style={{ background: 'var(--bg-surface0)' }}>
              <p className="text-xs font-semibold self-start" style={{ color: 'var(--text-subtle)' }}>Animation Preview</p>
              <div style={{ width: 80, height: 80, background: 'var(--bg-surface1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundImage: 'linear-gradient(45deg, #313244 25%, transparent 25%), linear-gradient(-45deg, #313244 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #313244 75%), linear-gradient(-45deg, transparent 75%, #313244 75%)',
                backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0' }}>
                <canvas ref={previewRef} style={{ imageRendering: 'pixelated', maxWidth: 72, maxHeight: 72 }} />
              </div>
              <div className="flex items-center gap-2 w-full">
                <button onClick={() => setAnimPlaying(p => !p)}
                  className="flex-1 py-1 rounded text-xs font-semibold"
                  style={{ background: animPlaying ? 'var(--accent-red)' : 'var(--accent-green)', color: 'var(--bg-base)' }}>
                  {animPlaying ? '⏸' : '▶'}
                </button>
                <input type="range" min={1} max={30} value={animFps} onChange={e => setAnimFps(+e.target.value)}
                  style={{ flex: 1, accentColor: 'var(--accent-mauve)' }} />
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{animFps}fps</span>
              </div>
            </div>
          </div>

          {/* Right: sprite sheet canvas */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center"
            style={{ background: 'repeating-linear-gradient(45deg, #1e1e2e 0, #1e1e2e 10px, #181825 10px, #181825 20px)' }}>
            <canvas ref={canvasRef}
              style={{ imageRendering: 'pixelated', cursor: 'crosshair', maxWidth: '100%' }}
              onClick={e => {
                const canvas = canvasRef.current!, img = imgRef.current!
                const rect = canvas.getBoundingClientRect()
                const scale = canvas.width / rect.width
                const mx = (e.clientX - rect.left) * scale, my = (e.clientY - rect.top) * scale
                const fw = canvas.width / cols, fh = canvas.height / rows
                const col = Math.floor(mx / fw), row = Math.floor(my / fh)
                const idx = row * cols + col
                if (idx >= 0 && idx < frames.length) setPreview(idx)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
