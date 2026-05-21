import { useState, useRef, useCallback } from 'react'
import { toast } from '../../utils/toast'

// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) { r = g = b = l } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function generateHarmony(hex: string, mode: string): string[] {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const rotate = (deg: number) => ((h + deg) % 360 + 360) % 360
  const mkHex = (hh: number, ss = s, ll = l) => rgbToHex(...hslToRgb(hh, ss, ll))

  switch (mode) {
    case 'complementary':
      return [hex, mkHex(rotate(180))]
    case 'triadic':
      return [hex, mkHex(rotate(120)), mkHex(rotate(240))]
    case 'tetradic':
      return [hex, mkHex(rotate(90)), mkHex(rotate(180)), mkHex(rotate(270))]
    case 'analogous':
      return [mkHex(rotate(-30)), hex, mkHex(rotate(30))]
    case 'split-complementary':
      return [hex, mkHex(rotate(150)), mkHex(rotate(210))]
    case 'monochromatic':
      return [
        mkHex(h, s, Math.min(95, l + 30)),
        mkHex(h, s, Math.min(95, l + 15)),
        hex,
        mkHex(h, s, Math.max(5, l - 15)),
        mkHex(h, s, Math.max(5, l - 30)),
      ]
    default: return [hex]
  }
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const MODES = ['complementary', 'triadic', 'tetradic', 'analogous', 'split-complementary', 'monochromatic']

// ── Component ──────────────────────────────────────────────────────────────────

export function ColorPaletteStudio() {
  const [baseColor, setBaseColor]   = useState('#f97316')
  const [mode, setMode]             = useState('triadic')
  const [palette, setPalette]       = useState<string[]>(() => generateHarmony('#f97316', 'triadic'))
  const [extracted, setExtracted]   = useState<string[]>([])
  const [exportFmt, setExportFmt]   = useState<'css' | 'scss' | 'tailwind' | 'json'>('css')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = (hex: string, m = mode) => {
    setBaseColor(hex)
    setPalette(generateHarmony(hex, m))
  }

  const changeMode = (m: string) => {
    setMode(m)
    setPalette(generateHarmony(baseColor, m))
  }

  // Extract palette from image
  const extractFromImage = useCallback((file: File) => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = 100; canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, 100, 100)
      const data = ctx.getImageData(0, 0, 100, 100).data
      // Sample every 20px, cluster by rounding to nearest 32
      const buckets: Record<string, number> = {}
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue  // skip transparent
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i+1] / 32) * 32
        const b = Math.round(data[i+2] / 32) * 32
        const key = rgbToHex(r, g, b)
        buckets[key] = (buckets[key] ?? 0) + 1
      }
      const top = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([hex]) => hex)
      setExtracted(top)
      toast.success(`Extracted ${top.length} colors from image!`)
    }
    img.src = URL.createObjectURL(file)
  }, [])

  // Export
  const exportCode = () => {
    const colors = [...palette, ...extracted]
    let out = ''
    if (exportFmt === 'css') {
      out = `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`
    } else if (exportFmt === 'scss') {
      out = colors.map((c, i) => `$color-${i + 1}: ${c};`).join('\n')
    } else if (exportFmt === 'tailwind') {
      out = `// tailwind.config.js extend.colors\n{\n${colors.map((c, i) => `  'brand-${i + 1}': '${c}',`).join('\n')}\n}`
    } else {
      out = JSON.stringify(colors.reduce((acc, c, i) => ({ ...acc, [`color${i + 1}`]: c }), {}), null, 2)
    }
    navigator.clipboard.writeText(out)
    toast.success(`Copied as ${exportFmt.toUpperCase()}!`)
  }

  const allColors = [...palette, ...extracted]

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && extractFromImage(e.target.files[0])} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 44, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>🎨 COLOR PALETTE STUDIO</span>
        <div className="flex-1" />
        <select value={exportFmt} onChange={e => setExportFmt(e.target.value as any)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <option value="css">CSS Variables</option>
          <option value="scss">SCSS</option>
          <option value="tailwind">Tailwind</option>
          <option value="json">JSON</option>
        </select>
        <button onClick={exportCode}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white' }}>
          📋 Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* Base color + harmony mode */}
        <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-surface0)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Base Color</p>
          <div className="flex items-center gap-3">
            <input type="color" value={baseColor}
              onChange={e => update(e.target.value)}
              style={{ width: 48, height: 48, border: 'none', borderRadius: 12, cursor: 'pointer', background: 'none', padding: 0 }} />
            <input type="text" value={baseColor}
              onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) update(e.target.value) }}
              className="px-2 py-1 rounded text-xs font-mono outline-none"
              style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)', width: 90 }} />
            <div className="flex-1" />
            <div className="flex flex-wrap gap-1">
              {MODES.map(m => (
                <button key={m} onClick={() => changeMode(m)}
                  className="text-xs px-2 py-0.5 rounded-full capitalize"
                  style={{
                    background: mode === m ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                    color: mode === m ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${mode === m ? 'var(--accent-mauve)' : 'var(--border)'}`,
                    fontSize: 10
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Harmony palette */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Harmony Palette</p>
          <div className="flex gap-2 flex-wrap">
            {palette.map((hex, i) => <ColorChip key={i} hex={hex} onPick={() => update(hex)} />)}
          </div>
        </div>

        {/* Large swatches */}
        <div className="flex rounded-2xl overflow-hidden" style={{ height: 80 }}>
          {palette.map((hex, i) => (
            <div key={i} style={{ flex: 1, background: hex, cursor: 'pointer', position: 'relative' }}
              onClick={() => { navigator.clipboard.writeText(hex); toast.success(`Copied ${hex}`) }}
              title={hex}>
              <span style={{
                position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: luminance(hex) > 0.4 ? '#000' : '#fff', opacity: 0.8
              }}>{hex}</span>
            </div>
          ))}
        </div>

        {/* Contrast checker */}
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>Contrast (WCAG)</p>
          <div className="flex flex-wrap gap-2">
            {palette.slice(0, 3).map((bg, i) => {
              const textLight = '#ffffff', textDark = '#000000'
              const ratioW = contrastRatio(bg, textLight), ratioB = contrastRatio(bg, textDark)
              const best = ratioW > ratioB ? textLight : textDark
              const ratio = Math.max(ratioW, ratioB)
              const aa = ratio >= 4.5, aaa = ratio >= 7
              return (
                <div key={i} style={{ background: bg, color: best, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600 }}>
                  Aa {ratio.toFixed(1)}:1 {aaa ? '✓ AAA' : aa ? '✓ AA' : '✗'}
                </div>
              )
            })}
          </div>
        </div>

        {/* Extract from image */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-surface0)', border: '2px dashed var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>🖼️ Extract from Image</p>
            <button onClick={() => fileInputRef.current?.click()}
              className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--bg-surface1)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
              Upload Image
            </button>
          </div>
          {extracted.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {extracted.map((hex, i) => <ColorChip key={i} hex={hex} onPick={() => update(hex)} />)}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Upload a screenshot, game art, or design reference to extract its color palette.</p>
          )}
        </div>

      </div>
    </div>
  )
}

function ColorChip({ hex, onPick }: { hex: string; onPick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group"
      onClick={() => { navigator.clipboard.writeText(hex); onPick() }}
      title={`Click to copy & set as base: ${hex}`}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: hex, border: '2px solid rgba(255,255,255,0.1)', transition: 'transform 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-subtle)' }}>{hex}</span>
    </div>
  )
}
