/**
 * ProblemsPanel — Shows TypeScript/ESLint errors from Monaco editor
 * Listens for 'editor:markers' custom event dispatched by CodeEditor
 */
import { useState, useEffect } from 'react'

export interface MarkerItem {
  severity: 1 | 2 | 4 | 8  // hint=1 info=2 warn=4 error=8
  message: string
  file: string
  startLineNumber: number
  startColumn: number
  code?: string | number
}

export function ProblemsPanel() {
  const [markers, setMarkers] = useState<MarkerItem[]>([])
  const [filter, setFilter]   = useState<'all' | 'error' | 'warning'>('all')

  useEffect(() => {
    const handler = (e: Event) => {
      const items = (e as CustomEvent<MarkerItem[]>).detail ?? []
      setMarkers(items)
    }
    window.addEventListener('editor:markers', handler)
    return () => window.removeEventListener('editor:markers', handler)
  }, [])

  const jump = (m: MarkerItem) => {
    window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: m.startLineNumber } }))
  }

  const shown = markers.filter(m => {
    if (filter === 'error')   return m.severity === 8
    if (filter === 'warning') return m.severity === 4
    return true
  })

  const errors   = markers.filter(m => m.severity === 8).length
  const warnings = markers.filter(m => m.severity === 4).length

  const sev = (s: number) => {
    if (s === 8) return { icon: '●', color: 'var(--accent-red)',    label: 'Error' }
    if (s === 4) return { icon: '●', color: 'var(--accent-yellow)', label: 'Warning' }
    if (s === 2) return { icon: '●', color: 'var(--accent-blue)',   label: 'Info' }
    return        { icon: '●', color: 'var(--text-subtle)',         label: 'Hint' }
  }

  return (
    <div className="flex flex-col h-full" style={{ fontSize: 12 }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-crust)' }}>
        {/* Counts */}
        <button onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
          className="flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: errors > 0 ? 'var(--accent-red)' : 'var(--text-subtle)', fontWeight: filter === 'error' ? 700 : 400 }}>
          <span style={{ fontSize: 10 }}>●</span>
          <span className="text-xs">{errors} Error{errors !== 1 ? 's' : ''}</span>
        </button>
        <button onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className="flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: warnings > 0 ? 'var(--accent-yellow)' : 'var(--text-subtle)', fontWeight: filter === 'warning' ? 700 : 400 }}>
          <span style={{ fontSize: 10 }}>●</span>
          <span className="text-xs">{warnings} Warning{warnings !== 1 ? 's' : ''}</span>
        </button>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 11 }}>✕ Clear filter</button>
        )}
        <span className="ml-auto text-xs" style={{ color: 'var(--text-subtle)' }}>
          {markers.length === 0 ? 'Open a TS/JS file to see problems' : `${shown.length} shown`}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <p className="text-xs">{markers.length === 0 ? 'No problems detected' : 'No problems match filter'}</p>
          </div>
        ) : (
          shown.map((m, i) => {
            const { icon, color, label } = sev(m.severity)
            const fileName = m.file.split(/[/\\]/).pop() ?? m.file
            return (
              <div key={i}
                onClick={() => jump(m)}
                className="flex items-start gap-2 px-3 py-1.5 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)22' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface0)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <span style={{ color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'var(--text)' }}>{m.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                    {fileName} <span style={{ color: 'var(--accent-blue)' }}>:{m.startLineNumber}:{m.startColumn}</span>
                    {m.code != null && <span style={{ color: 'var(--text-subtle)', marginLeft: 6 }}>[{m.code}]</span>}
                  </p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color, opacity: 0.7 }}>{label}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
