import { useState, useRef, useEffect, useCallback } from 'react'

// Detect color values in a line of text
const COLOR_RE = /#([0-9a-fA-F]{3,8})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)/g

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16)]
  }
  if (h.length === 6 || h.length === 8) {
    return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)]
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const [r, g, b] = rgb
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

export interface ColorMatch {
  value: string   // original string e.g. "#1e1e2e"
  hex: string     // normalized hex e.g. "#1e1e2e"
  col: number     // column offset in line
}

export function findColorsInLine(line: string): ColorMatch[] {
  const matches: ColorMatch[] = []
  let m: RegExpExecArray | null
  COLOR_RE.lastIndex = 0
  while ((m = COLOR_RE.exec(line)) !== null) {
    const raw = m[0]
    let hex = ''
    if (raw.startsWith('#')) {
      const h = raw.slice(1)
      hex = h.length === 3
        ? '#' + h.split('').map(c => c + c).join('')
        : '#' + h.slice(0, 6)
    } else {
      // Convert rgb/hsl to hex approximation — skip for now, show swatch only
      const nums = raw.match(/\d+/g)
      if (nums && nums.length >= 3) {
        hex = rgbToHex(parseInt(nums[0]), parseInt(nums[1]), parseInt(nums[2]))
      }
    }
    if (hex) matches.push({ value: raw, hex, col: m.index })
  }
  return matches
}

interface Props {
  color: string            // hex color to edit
  x: number               // pixel x position
  y: number               // pixel y position
  onApply: (hex: string) => void
  onClose: () => void
}

export function ColorPickerPopup({ color, x, y, onApply, onClose }: Props) {
  const [current, setCurrent] = useState(color)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 50)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  // Clamp position so popup stays in viewport
  const vw = window.innerWidth, vh = window.innerHeight
  const W = 200, H = 280
  const px = Math.min(x, vw - W - 8)
  const py = y + H > vh ? y - H - 8 : y + 24

  const rgb = hexToRgb(current)
  const light = isLight(current)

  return (
    <div ref={ref}
      className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{ left: px, top: py, width: W, background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>

      {/* Preview swatch */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ background: current, borderBottom: '1px solid rgba(0,0,0,0.2)' }}>
        <span className="text-xs font-mono font-bold" style={{ color: light ? '#000' : '#fff' }}>{current}</span>
        <button onClick={onClose} style={{ color: light ? '#00000088' : '#ffffff88', fontSize: 14 }}>✕</button>
      </div>

      {/* Native color input */}
      <div className="p-3 flex flex-col gap-3">
        <div className="flex justify-center">
          <input type="color" value={current}
            onChange={e => setCurrent(e.target.value)}
            className="cursor-pointer rounded"
            style={{ width: 140, height: 100, border: 'none', padding: 0, background: 'none' }} />
        </div>

        {/* Hex input */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>HEX</span>
          <input value={current}
            onChange={e => {
              const v = e.target.value
              if (/^#[0-9a-fA-F]{0,8}$/.test(v)) setCurrent(v)
            }}
            className="flex-1 px-2 py-1 rounded text-xs font-mono outline-none"
            style={{ background: 'var(--bg-crust)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        {/* RGB display */}
        {rgb && (
          <div className="flex gap-1">
            {['R','G','B'].map((ch, i) => (
              <div key={ch} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-xs" style={{ color: ['var(--accent-red)','var(--accent-green)','var(--accent-blue)'][i] }}>{ch}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{rgb[i]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Apply button */}
        <button onClick={() => { onApply(current); onClose() }}
          className="w-full py-1.5 rounded text-xs font-bold transition-all"
          style={{ background: current, color: light ? '#000' : '#fff' }}>
          Apply
        </button>
      </div>
    </div>
  )
}
