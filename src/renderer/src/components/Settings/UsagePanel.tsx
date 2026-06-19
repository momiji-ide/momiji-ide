import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { getStats } from '../../utils/usageStats'

type Tab   = 'overview' | 'models'
type Range = 'all' | '30d' | '7d'

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#cba6f7', gemini: '#f97316', openai: '#4ade80', groq: '#facc15',
  deepseek: '#60a5fa', mistral: '#d4d4d8', openrouter: '#2dd4bf',
  sambanova: '#f59e0b', cerebras: '#a78bfa', ollama: '#89dceb', custom: '#94a3b8',
}

export function UsagePanel() {
  const [tab, setTab]     = useState<Tab>('overview')
  const [range, setRange] = useState<Range>('all')
  const usageHistory = useAppStore(s => s.usageHistory)
  const stats = getStats(16)

  // Filter usage history by range
  const cutoff = range === '7d' ? daysAgo(7) : range === '30d' ? daysAgo(30) : ''
  const filtered = cutoff ? usageHistory.filter(e => e.date >= cutoff) : usageHistory

  // Model breakdown for Models tab
  const byModel = new Map<string, { providerId: string; tokensIn: number; tokensOut: number }>()
  for (const e of filtered) {
    const prev = byModel.get(e.model) ?? { providerId: e.providerId, tokensIn: 0, tokensOut: 0 }
    prev.tokensIn += e.tokensIn; prev.tokensOut += e.tokensOut
    byModel.set(e.model, prev)
  }
  const modelRows = [...byModel.entries()]
    .map(([model, d]) => ({ model, ...d, total: d.tokensIn + d.tokensOut }))
    .sort((a, b) => b.total - a.total)
  const totalModelTokens = modelRows.reduce((s, r) => s + r.total, 0)

  // Heatmap max for color scaling
  const maxH = Math.max(1, ...stats.heatmap.flat())

  const statCards = [
    { label: 'Sessions',        val: String(stats.sessions) },
    { label: 'Messages',        val: fmtK(stats.aiMsgs) },
    { label: 'Total tokens',    val: fmtK(stats.tokens) },
    { label: 'Active days',     val: String(stats.activeDays) },
    { label: 'Current streak',  val: `${stats.streak}d` },
    { label: 'Longest streak',  val: `${stats.longestStreak}d` },
    { label: 'Peak hour',       val: stats.peakHour ?? '—' },
    { label: 'Favorite model',  val: stats.favModel?.replace('gemini-', '').replace('claude-', '').replace('Meta-Llama-', 'Llama ').slice(0, 14) ?? '—' },
  ]

  return (
    <div className="flex flex-col gap-0 p-0">
      {/* Header: tabs + range */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-base)' }}>
          {(['overview', 'models'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-all"
              style={{ background: tab === t ? 'var(--bg-surface1)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text-subtle)', border: tab === t ? '1px solid var(--border)' : '1px solid transparent' }}>
              {t === 'overview' ? 'Overview' : 'Models'}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-base)' }}>
          {(['all', '30d', '7d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="text-xs px-2.5 py-1.5 rounded-md font-medium transition-all"
              style={{ background: range === r ? 'var(--accent-mauve)' : 'transparent', color: range === r ? 'white' : 'var(--text-subtle)' }}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {/* 8-card grid (4×2) */}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {statCards.map(c => (
              <div key={c.label} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-base)' }}>
                <p className="truncate" style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 2 }}>{c.label}</p>
                <p className="font-bold truncate" style={{ fontSize: 17, lineHeight: 1.2, color: 'var(--text)' }}>{c.val}</p>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.heatmap.length}, 1fr)`, gap: 3 }}>
            {stats.heatmap.map((col, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 3 }}>
                {col.map((n, di) => (
                  <div key={di} style={{
                    aspectRatio: '1', borderRadius: 2, width: '100%',
                    background: n === 0 ? 'var(--bg-surface1)' : `rgba(203,166,247,${0.2 + 0.8 * (n / maxH)})`,
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-0 px-4 pb-4">
          {modelRows.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-subtle)' }}>
              No model usage data yet — start chatting with Kitsune.
            </p>
          ) : (
            <div className="flex flex-col gap-0 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {modelRows.map(row => {
                const pct = totalModelTokens > 0 ? (row.total / totalModelTokens * 100) : 0
                const color = PROVIDER_COLORS[row.providerId] ?? 'var(--text-subtle)'
                return (
                  <div key={row.model} className="flex items-center px-3 py-2.5 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>
                      {row.model.replace('Meta-Llama-', '').replace('DeepSeek-R1-Distill-Llama-', 'DeepSeek R1 ')}
                    </span>
                    <span className="text-xs font-mono text-right" style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 120 }}>
                      {fmtK(row.tokensIn)} in · {fmtK(row.tokensOut)} out
                    </span>
                    <span className="text-xs font-bold text-right" style={{ color, minWidth: 40 }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
