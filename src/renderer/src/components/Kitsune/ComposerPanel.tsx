import { useState } from 'react'
import type { ComposerChange } from '../../types'

interface Props {
  changes: ComposerChange[]
  onRevertFile: (path: string) => void
  onAcceptAll: () => void
  onRevertAll: () => void
}

function computeDiff(before: string, after: string): { type: 'same' | 'add' | 'del'; line: string }[] {
  const oL = before.split('\n'), sL = after.split('\n')
  const rows: { type: 'same' | 'add' | 'del'; line: string }[] = []
  for (let i = 0; i < Math.max(oL.length, sL.length); i++) {
    const o = oL[i], s = sL[i]
    if (o === s) rows.push({ type: 'same', line: s ?? '' })
    else { if (o !== undefined) rows.push({ type: 'del', line: o }); if (s !== undefined) rows.push({ type: 'add', line: s }) }
  }
  return rows
}

export function ComposerPanel({ changes, onRevertFile, onAcceptAll, onRevertAll }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = changes[activeIdx]

  if (!changes.length) return null

  const totalAdded = changes.reduce((s, c) => s + c.after.split('\n').length, 0)
  const totalRemoved = changes.reduce((s, c) => s + c.before.split('\n').length, 0)
  const diff = active ? computeDiff(active.before, active.after) : []
  const added = diff.filter(r => r.type === 'add').length
  const removed = diff.filter(r => r.type === 'del').length

  return (
    <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: '1px solid var(--accent-mauve)55', background: 'var(--bg-surface0)', maxHeight: 360 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>Composer</span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{changes.length} file{changes.length > 1 ? 's' : ''} changed</span>
        <div className="flex-1" />
        <button onClick={onAcceptAll}
          className="text-xs px-2 py-0.5 rounded font-semibold"
          style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
          ✓ Accept all
        </button>
        <button onClick={onRevertAll}
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          ✕ Revert all
        </button>
      </div>

      {/* File tabs */}
      <div className="flex gap-0 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {changes.map((c, i) => {
          const name = c.path.split(/[\\/]/).pop() ?? c.path
          const isActive = i === activeIdx
          return (
            <button key={c.path} onClick={() => setActiveIdx(i)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? 'var(--bg-surface0)' : 'var(--bg-mantle)',
                color: isActive ? 'var(--text)' : 'var(--text-subtle)',
                borderBottom: isActive ? '2px solid var(--accent-mauve)' : '2px solid transparent',
                fontWeight: isActive ? 600 : 400,
              }}>
              <span style={{ color: c.before ? 'var(--accent-yellow)' : 'var(--accent-green)', fontSize: 10 }}>
                {c.before ? '~' : '+'}
              </span>
              {name}
              <button onClick={e => { e.stopPropagation(); onRevertFile(c.path) }}
                className="ml-1 rounded-full w-4 h-4 flex items-center justify-center"
                style={{ color: 'var(--text-subtle)', fontSize: 9 }}
                title="Revert this file">✕</button>
            </button>
          )
        })}
      </div>

      {/* Diff view */}
      {active && (
        <div className="flex-1 overflow-auto font-mono" style={{ fontSize: 11, background: 'var(--bg-crust)' }}>
          <div className="flex items-center gap-2 px-3 py-1" style={{ background: 'var(--bg-surface0)', borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{active.path}</span>
            <div className="flex-1" />
            <span className="text-xs px-1.5 rounded" style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', fontSize: 9 }}>+{added}</span>
            <span className="text-xs px-1.5 rounded" style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)', fontSize: 9 }}>-{removed}</span>
          </div>
          {diff.map((r, i) => {
            const bg = r.type === 'add' ? '#a6e3a10d' : r.type === 'del' ? '#f38ba80d' : 'transparent'
            const color = r.type === 'add' ? 'var(--accent-green)' : r.type === 'del' ? 'var(--accent-red)' : 'var(--text-muted)'
            return (
              <div key={i} className="flex" style={{ background: bg }}>
                <span className="w-6 text-center flex-shrink-0 select-none" style={{ color, borderRight: '1px solid var(--border)', fontSize: 10, lineHeight: '20px' }}>
                  {r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '}
                </span>
                <span className="px-2 whitespace-pre" style={{ color, lineHeight: '20px' }}>{r.line}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
