import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'

interface Interpreter { path: string; version: string; type: string }

interface Props { onClose: () => void }

export function PythonPicker({ onClose }: Props) {
  const { settings, updateSettings, currentFolder } = useAppStore()
  const [interpreters, setInterpreters] = useState<Interpreter[]>([])
  const [loading, setLoading] = useState(true)
  const [custom, setCustom] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(window.api as any).python.detect(currentFolder ?? undefined).then((list: Interpreter[]) => {
      setInterpreters(list)
      setLoading(false)
    })
  }, [currentFolder])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => window.addEventListener('mousedown', handler), 0)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const select = (path: string) => {
    updateSettings({ pythonPath: path })
    onClose()
  }

  const isActive = (path: string) => settings.pythonPath === path

  return (
    <div ref={ref}
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl"
      style={{
        bottom: 36, left: 8, width: 380,
        background: 'var(--bg-mantle)',
        border: '1px solid var(--border)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)'
      }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            🐍 Select Python Interpreter
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            {currentFolder ? 'Scanning project folder…' : 'No project folder open'}
          </p>
        </div>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded"
          style={{ color: 'var(--text-subtle)' }}>✕</button>
      </div>

      {/* Interpreter list */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 justify-center">
            <div className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scanning for interpreters…</span>
          </div>
        ) : interpreters.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>No Python found</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Install Python from python.org or enter a custom path below.
            </p>
          </div>
        ) : (
          interpreters.map((it) => (
            <button key={it.path} onClick={() => select(it.path)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
              style={{
                background: isActive(it.path) ? 'var(--bg-surface0)' : 'transparent',
                borderLeft: isActive(it.path) ? '3px solid var(--accent-blue)' : '3px solid transparent'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
              onMouseLeave={e => (e.currentTarget.style.background = isActive(it.path) ? 'var(--bg-surface0)' : 'transparent')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                    Python {it.version}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: it.type.includes('venv') || it.type.includes('conda')
                        ? 'var(--accent-mauve)22' : 'var(--bg-surface1)',
                      color: it.type.includes('venv') || it.type.includes('conda')
                        ? 'var(--accent-mauve)' : 'var(--text-subtle)',
                      fontSize: 9
                    }}>
                    {it.type}
                  </span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                  {it.path}
                </p>
              </div>
              {isActive(it.path) && (
                <span className="text-sm flex-shrink-0" style={{ color: 'var(--accent-blue)' }}>✓</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Custom path */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          Enter interpreter path manually:
        </p>
        <div className="flex gap-2">
          <input value={custom} onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && custom.trim() && select(custom.trim())}
            placeholder="/usr/bin/python3  or  C:\Python311\python.exe"
            className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 10 }} />
          <button onClick={() => custom.trim() && select(custom.trim())}
            disabled={!custom.trim()}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              background: custom.trim() ? 'var(--accent-blue)' : 'var(--bg-surface1)',
              color: custom.trim() ? 'white' : 'var(--text-muted)'
            }}>
            Use
          </button>
        </div>
      </div>
    </div>
  )
}
