import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'

const THEMES = [
  { id: 'dracula',    bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' },
  { id: 'monokai',   bg: '#272822', text: '#f8f8f2', accent: '#a6e22e' },
  { id: 'night-owl', bg: '#011627', text: '#d6deeb', accent: '#82aaff' },
  { id: 'catppuccin',bg: '#1e1e2e', text: '#cdd6f4', accent: '#cba6f7' },
  { id: 'github',    bg: '#0d1117', text: '#e6edf3', accent: '#d2a8ff' },
  { id: 'solarized', bg: '#002b36', text: '#839496', accent: '#268bd2' },
]

const GRADIENTS = [
  { id: 'sunset',  value: 'linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)' },
  { id: 'ocean',   value: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  { id: 'forest',  value: 'linear-gradient(135deg, #22c55e, #0ea5e9)' },
  { id: 'fire',    value: 'linear-gradient(135deg, #ef4444, #f97316, #eab308)' },
  { id: 'galaxy',  value: 'linear-gradient(135deg, #1e1b4b, #4c1d95, #831843)' },
  { id: 'none',    value: '#1a1a2e' },
]

interface Props { onClose: () => void }

export function CodeScreenshot({ onClose }: Props) {
  const { tabs, activeTabId, settings } = useAppStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [themeIdx, setThemeIdx] = useState(3) // catppuccin default
  const [gradientIdx, setGradientIdx] = useState(0)
  const [padding, setPadding] = useState(48)
  const [fontSize, setFontSize] = useState(13)
  const [showLineNums, setShowLineNums] = useState(true)
  const [windowStyle, setWindowStyle] = useState<'mac' | 'win' | 'none'>('mac')
  const [selectedCode, setSelectedCode] = useState('')
  const [fileName, setFileName] = useState(activeTab?.fileName ?? 'code')

  useEffect(() => {
    // Get selected text or whole file
    const sel = window.getSelection()?.toString()
    setSelectedCode(sel && sel.length > 10 ? sel : (activeTab?.content ?? '').slice(0, 80 * 40))
    setFileName(activeTab?.fileName ?? 'code')
  }, [activeTab])

  const theme = THEMES[themeIdx]
  const gradient = GRADIENTS[gradientIdx]

  useEffect(() => { renderCanvas() }, [themeIdx, gradientIdx, padding, fontSize, showLineNums, windowStyle, selectedCode, fileName])

  const renderCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const lines = selectedCode.split('\n')
    const lineHeight = fontSize * 1.6
    const fontFamily = "'JetBrains Mono', 'Fira Code', monospace"
    const codeWidth = 640
    const lineNumWidth = showLineNums ? 40 : 0
    const headerH = windowStyle !== 'none' ? 40 : 0

    const W = codeWidth + padding * 2
    const H = lines.length * lineHeight + padding * 2 + headerH + 24

    canvas.width = W
    canvas.height = H
    canvas.style.width = Math.min(W, 700) + 'px'
    canvas.style.height = Math.min(H, 500) + 'px'

    // Background gradient
    if (gradient.value.startsWith('linear')) {
      const grd = ctx.createLinearGradient(0, 0, W, H)
      const stops = gradient.value.match(/#[0-9a-f]{6}/gi) ?? ['#1e1e2e', '#313244']
      stops.forEach((c, i) => grd.addColorStop(i / (stops.length - 1), c))
      ctx.fillStyle = grd
    } else {
      ctx.fillStyle = gradient.value
    }
    ctx.fillRect(0, 0, W, H)

    // Code window
    const rx = padding, ry = padding
    const rw = codeWidth, rh = H - padding * 2
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 10
    roundRect(ctx, rx, ry, rw, rh, 12, theme.bg)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Window chrome
    if (windowStyle === 'mac') {
      const dots = ['#ff5f57', '#ffbd2e', '#28c840']
      dots.forEach((c, i) => {
        ctx.beginPath()
        ctx.arc(rx + 20 + i * 20, ry + 20, 6, 0, Math.PI * 2)
        ctx.fillStyle = c
        ctx.fill()
      })
      // filename
      ctx.fillStyle = theme.text + '88'
      ctx.font = `12px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.fillText(fileName, rx + rw / 2, ry + 25)
      ctx.textAlign = 'left'
    } else if (windowStyle === 'win') {
      ctx.fillStyle = theme.accent
      ctx.fillRect(rx, ry, rw, 32)
      ctx.fillStyle = theme.text
      ctx.font = `11px ${fontFamily}`
      ctx.fillText(`  ${fileName}`, rx + 4, ry + 21)
      // win buttons
      ctx.fillStyle = theme.text + '66'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('⚊  ⬜  ✕', rx + rw - 8, ry + 21)
      ctx.textAlign = 'left'
    }

    // Code lines
    const codeStartY = ry + headerH + 16
    ctx.font = `${fontSize}px ${fontFamily}`

    lines.forEach((line, i) => {
      const y = codeStartY + i * lineHeight
      if (showLineNums) {
        ctx.fillStyle = theme.text + '44'
        ctx.fillText(String(i + 1).padStart(3), rx + 8, y)
      }
      // Simple syntax coloring: strings, comments, keywords
      const colored = colorize(line, theme)
      let x = rx + lineNumWidth + 12
      colored.forEach(({ text: t, color }) => {
        ctx.fillStyle = color
        ctx.fillText(t, x, y)
        x += ctx.measureText(t).width
      })
    })
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${fileName.replace(/\.[^.]+$/, '')}-screenshot.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="flex flex-col rounded-xl shadow-2xl overflow-hidden" style={{ width: 820, maxHeight: '90vh', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>📸 Code Screenshot</span>
          <div className="flex gap-2">
            <button onClick={download} className="px-4 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--accent-blue)', color: 'white' }}>⬇ Download PNG</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }}>✕</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Controls */}
          <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-shrink-0" style={{ width: 200, borderRight: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <Control label="Theme">
              <div className="flex flex-col gap-1">
                {THEMES.map((t, i) => (
                  <button key={t.id} onClick={() => setThemeIdx(i)}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs text-left"
                    style={{ background: themeIdx === i ? 'var(--accent-blue)22' : 'transparent', color: themeIdx === i ? 'var(--accent-blue)' : 'var(--text-muted)', border: themeIdx === i ? '1px solid var(--accent-blue)44' : '1px solid transparent' }}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.bg, border: '1px solid #ffffff33' }} />
                    {t.id}
                  </button>
                ))}
              </div>
            </Control>
            <Control label="Background">
              <div className="flex flex-wrap gap-1">
                {GRADIENTS.map((g, i) => (
                  <button key={g.id} onClick={() => setGradientIdx(i)} title={g.id}
                    className="w-8 h-8 rounded-lg transition-all"
                    style={{ background: g.value, border: gradientIdx === i ? '2px solid white' : '2px solid transparent' }} />
                ))}
              </div>
            </Control>
            <Control label={`Padding: ${padding}px`}>
              <input type="range" min={16} max={80} value={padding} onChange={e => setPadding(+e.target.value)} className="w-full" />
            </Control>
            <Control label={`Font: ${fontSize}px`}>
              <input type="range" min={10} max={18} value={fontSize} onChange={e => setFontSize(+e.target.value)} className="w-full" />
            </Control>
            <Control label="Window style">
              <div className="flex gap-1">
                {(['mac','win','none'] as const).map(s => (
                  <button key={s} onClick={() => setWindowStyle(s)}
                    className="flex-1 py-1 rounded text-xs capitalize"
                    style={{ background: windowStyle === s ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: windowStyle === s ? 'white' : 'var(--text-muted)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </Control>
            <Control label="Line numbers">
              <button onClick={() => setShowLineNums(v => !v)}
                className="w-full py-1 rounded text-xs"
                style={{ background: showLineNums ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: showLineNums ? 'white' : 'var(--text-muted)' }}>
                {showLineNums ? 'On' : 'Off'}
              </button>
            </Control>
          </div>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-6" style={{ background: '#0a0a0f' }}>
            <canvas ref={canvasRef} style={{ borderRadius: 8, maxWidth: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {children}
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

// Very simple syntax highlighter
function colorize(line: string, theme: { bg: string; text: string; accent: string }): { text: string; color: string }[] {
  const COMMENT_COLOR = theme.text + '55'
  const STRING_COLOR  = '#a6e3a1'
  const KEYWORD_COLOR = '#cba6f7'
  const NUM_COLOR     = '#fab387'

  if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) return [{ text: line, color: COMMENT_COLOR }]

  const tokens: { text: string; color: string }[] = []
  const KEYWORDS = /\b(const|let|var|function|class|return|if|else|for|while|import|export|from|async|await|def|elif|lambda|pass|True|False|None|int|str|bool|float)\b/g
  const STRINGS  = /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g
  const NUMBERS  = /\b\d+\.?\d*\b/g

  let pos = 0
  const ranges: { start: number; end: number; color: string }[] = []

  let m: RegExpExecArray | null
  STRINGS.lastIndex = 0
  while ((m = STRINGS.exec(line)) !== null) ranges.push({ start: m.index, end: m.index + m[0].length, color: STRING_COLOR })
  KEYWORDS.lastIndex = 0
  while ((m = KEYWORDS.exec(line)) !== null) { if (!ranges.some(r => m!.index >= r.start && m!.index < r.end)) ranges.push({ start: m.index, end: m.index + m[0].length, color: KEYWORD_COLOR }) }
  NUMBERS.lastIndex = 0
  while ((m = NUMBERS.exec(line)) !== null) { if (!ranges.some(r => m!.index >= r.start && m!.index < r.end)) ranges.push({ start: m.index, end: m.index + m[0].length, color: NUM_COLOR }) }
  ranges.sort((a, b) => a.start - b.start)

  for (const r of ranges) {
    if (pos < r.start) tokens.push({ text: line.slice(pos, r.start), color: theme.text })
    tokens.push({ text: line.slice(r.start, r.end), color: r.color })
    pos = r.end
  }
  if (pos < line.length) tokens.push({ text: line.slice(pos), color: theme.text })
  return tokens.length ? tokens : [{ text: line, color: theme.text }]
}
