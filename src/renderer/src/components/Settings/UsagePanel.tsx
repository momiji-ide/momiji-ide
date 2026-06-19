import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import type { UsageEntry } from '../../types'

type Range = 'all' | '30d' | '7d'

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#cba6f7', gemini: '#f97316', openai: '#4ade80', groq: '#facc15',
  deepseek: '#60a5fa', mistral: '#d4d4d8', openrouter: '#2dd4bf',
  sambanova: '#f59e0b', cerebras: '#a78bfa', ollama: '#89dceb', custom: '#94a3b8',
}

function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function UsagePanel() {
  const usageHistory = useAppStore(s => s.usageHistory)
  const [range, setRange] = useState<Range>('30d')

  const cutoff = range === '7d' ? daysAgo(7) : range === '30d' ? daysAgo(30) : ''
  const filtered = cutoff ? usageHistory.filter(e => e.date >= cutoff) : usageHistory

  // Group by date
  const byDate = new Map<string, number>()
  for (const e of filtered) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.tokensIn + e.tokensOut)
  }

  // Fill date gaps for the chart
  const days = range === '7d' ? 7 : range === '30d' ? 30 : Math.max(1, Math.ceil((Date.now() - Math.min(...usageHistory.map(e => new Date(e.date).getTime()), Date.now())) / 86400000))
  const dateKeys: string[] = []
  for (let i = days - 1; i >= 0; i--) dateKeys.push(daysAgo(i))
  const barValues = dateKeys.map(d => byDate.get(d) ?? 0)
  const maxVal = Math.max(1, ...barValues)

  // Group by model for breakdown
  const byModel = new Map<string, { providerId: string; tokensIn: number; tokensOut: number }>()
  for (const e of filtered) {
    const prev = byModel.get(e.model) ?? { providerId: e.providerId, tokensIn: 0, tokensOut: 0 }
    prev.tokensIn += e.tokensIn; prev.tokensOut += e.tokensOut
    byModel.set(e.model, prev)
  }
  const modelRows = [...byModel.entries()]
    .map(([model, d]) => ({ model, ...d, total: d.tokensIn + d.tokensOut }))
    .sort((a, b) => b.total - a.total)
  const totalTokens = modelRows.reduce((s, r) => s + r.total, 0)

  // Bar chart via canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth, H = c.clientHeight
    c.width = W * dpr; c.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const padL = 40, padR = 8, padT = 8, padB = 28
    const cw = W - padL - padR, ch = H - padT - padB
    const n = barValues.length
    if (n === 0) return
    const gap = Math.max(1, Math.floor(cw / n * 0.25))
    const bw = Math.max(2, (cw - gap * n) / n)

    // Y gridlines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padT + ch * (1 - i / 4)
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
    }
    // Y labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const y = padT + ch * (1 - i / 4)
      ctx.fillText(formatK(maxVal * i / 4), padL - 4, y + 3)
    }

    // Bars
    for (let i = 0; i < n; i++) {
      const x = padL + i * (bw + gap)
      const h = (barValues[i] / maxVal) * ch
      const grad = ctx.createLinearGradient(x, padT + ch - h, x, padT + ch)
      grad.addColorStop(0, 'rgba(203,166,247,0.85)')
      grad.addColorStop(1, 'rgba(203,166,247,0.35)')
      ctx.fillStyle = grad
      ctx.beginPath()
      const r = Math.min(3, bw / 2)
      ctx.roundRect(x, padT + ch - h, bw, h, [r, r, 0, 0])
      ctx.fill()
    }

    // X labels (show ~8 evenly spaced)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'center'; ctx.font = '8px JetBrains Mono, monospace'
    const step = Math.max(1, Math.floor(n / 8))
    for (let i = 0; i < n; i += step) {
      const x = padL + i * (bw + gap) + bw / 2
      ctx.fillText(shortDate(dateKeys[i]), x, H - 6)
    }
  }, [barValues, maxVal, dateKeys, range])

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto" style={{ maxWidth: 560 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Usage</p>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Token usage across all models</p>
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
          {(['all', '30d', '7d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="text-xs px-2 py-1 rounded-md font-medium transition-all"
              style={{ background: range === r ? 'var(--accent-mauve)' : 'transparent', color: range === r ? 'white' : 'var(--text-muted)' }}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg-surface0)' }}>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Total tokens</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{formatK(totalTokens)}</p>
        </div>
        <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg-surface0)' }}>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Requests</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{filtered.length}</p>
        </div>
        <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg-surface0)' }}>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Models used</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{modelRows.length}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-subtle)' }}>
            No usage data yet — start chatting with Kitsune to see stats here.
          </p>
        ) : (
          <canvas ref={canvasRef} style={{ width: '100%', height: 180, display: 'block' }} />
        )}
      </div>

      {/* Model breakdown */}
      {modelRows.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center px-3 py-2" style={{ background: 'var(--bg-surface0)', borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-bold flex-1" style={{ color: 'var(--text-muted)' }}>Model</span>
            <span className="text-xs font-bold w-32 text-right" style={{ color: 'var(--text-muted)' }}>Tokens (in · out)</span>
            <span className="text-xs font-bold w-14 text-right" style={{ color: 'var(--text-muted)' }}>%</span>
          </div>
          {modelRows.map(row => {
            const pct = totalTokens > 0 ? (row.total / totalTokens * 100) : 0
            const color = PROVIDER_COLORS[row.providerId] ?? 'var(--text-subtle)'
            return (
              <div key={row.model} className="flex items-center px-3 py-2 gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>{row.model}</span>
                <span className="text-xs w-32 text-right font-mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {formatK(row.tokensIn)} in · {formatK(row.tokensOut)} out
                </span>
                <span className="text-xs w-14 text-right font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
