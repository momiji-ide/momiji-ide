import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'

interface TermTab { id: string; title: string; exited: boolean }
let tabCounter = 0

export function TerminalPanel() {
  const currentFolder = useAppStore(s => s.currentFolder)
  const [tabs, setTabs]         = useState<TermTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const terminalsRef = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef = useRef<Map<string, FitAddon>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  // ── Create tab ───────────────────────────────────────────────────────
  const createTab = useCallback(async (cwd?: string) => {
    const id = `term-${++tabCounter}`
    setTabs(prev => [...prev, { id, title: `Shell ${tabCounter}`, exited: false }])
    setActiveId(id)
    await window.api.terminal.create(id, cwd ?? currentFolder ?? undefined)
  }, [currentFolder])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    createTab()
  }, []) // eslint-disable-line

  // ── Mount xterm and wire to PTY ──────────────────────────────────────
  useEffect(() => {
    if (!activeId) return

    if (terminalsRef.current.has(activeId)) {
      setTimeout(() => {
        fitAddonsRef.current.get(activeId)?.fit()
        terminalsRef.current.get(activeId)?.focus()
      }, 50)
      return
    }

    let cancelled = false
    const tryMount = () => {
      if (cancelled) return
      const el = document.getElementById(`xterm-${activeId}`)
      if (!el || el.offsetWidth === 0) { requestAnimationFrame(tryMount); return }

      const term = new Terminal({
        theme: {
          background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc',
          black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
          blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
          brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
          brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
          brightCyan: '#94e2d5', brightWhite: '#a6adc8',
          selectionBackground: 'rgba(203,166,247,0.3)',
        },
        fontFamily: "'Cascadia Code','JetBrains Mono','Fira Code',Consolas,monospace",
        fontSize: 13, lineHeight: 1.45,
        cursorBlink: true, cursorStyle: 'block',
        scrollback: 5000, allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(el)
      fitAddon.fit()
      term.focus()

      terminalsRef.current.set(activeId, term)
      fitAddonsRef.current.set(activeId, fitAddon)

      // User types → PTY (node-pty handles it like a real terminal)
      const termId = activeId
      term.onData(data => window.api.terminal.write(termId, data))

      // Resize xterm → resize PTY
      term.onResize(({ cols, rows }) => {
        window.api.terminal.resize(termId, cols, rows)
      })
    }

    requestAnimationFrame(tryMount)
    return () => { cancelled = true }
  }, [activeId]) // eslint-disable-line

  // ── PTY output → xterm ───────────────────────────────────────────────
  useEffect(() => {
    const off = window.api.terminal.onData((id, data) => {
      terminalsRef.current.get(id)?.write(data)
    })
    return off
  }, [])

  useEffect(() => {
    const off = window.api.terminal.onExit((id, code) => {
      terminalsRef.current.get(id)?.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`)
      setTabs(prev => prev.map(t => t.id === id ? { ...t, exited: true } : t))
    })
    return off
  }, [])

  // ── Refit on resize ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      if (activeId) fitAddonsRef.current.get(activeId)?.fit()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [activeId])

  // ── Close tab ────────────────────────────────────────────────────────
  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.terminal.kill(id)
    terminalsRef.current.get(id)?.dispose()
    terminalsRef.current.delete(id)
    fitAddonsRef.current.delete(id)
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id) setActiveId(next.at(-1)?.id ?? null)
      return next
    })
  }

  const switchTab = (id: string) => {
    setActiveId(id)
    setTimeout(() => {
      fitAddonsRef.current.get(id)?.fit()
      terminalsRef.current.get(id)?.focus()
    }, 50)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#1e1e2e' }}>

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0"
        style={{ height: 33, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)}
              className="flex items-center gap-1.5 px-3 text-xs flex-shrink-0"
              style={{
                height: 33, cursor: 'pointer', border: 'none',
                background: activeId === tab.id ? '#1e1e2e' : 'transparent',
                color: activeId === tab.id ? 'var(--text)' : 'var(--text-subtle)',
                borderRight: '1px solid var(--border)',
                borderTop: activeId === tab.id ? '1px solid var(--accent-mauve)' : '1px solid transparent',
              }}>
              <span style={{ fontSize: 8, color: tab.exited ? '#f38ba8' : '#a6e3a1' }}>●</span>
              {tab.title}
              <span onClick={e => closeTab(tab.id, e)}
                style={{ marginLeft: 4, width: 14, height: 14, fontSize: 14, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', borderRadius: 3,
                  color: 'var(--text-subtle)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >×</span>
            </button>
          ))}
        </div>

        <button onClick={() => createTab()}
          style={{ width: 30, height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)' }}
        >+</button>

        {/* Kill process (Ctrl+C) — keeps terminal open */}
        <button
          onClick={() => terminalsRef.current.get(activeId!)?.write('\x03')}
          title="Kill running process (Ctrl+C)"
          style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--accent-red)', fontSize: 11, flexShrink: 0, fontWeight: 600 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >⊘ Kill</button>

        {/* Clear */}
        <button onClick={() => terminalsRef.current.get(activeId!)?.clear()}
          style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >Clear</button>
      </div>

      {/* xterm — click to focus */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden"
        onClick={() => {
          if (activeId) {
            terminalsRef.current.get(activeId)?.focus()
          }
        }}
        style={{ cursor: 'text' }}>
        {tabs.map(tab => (
          <div key={tab.id} id={`xterm-${tab.id}`}
            style={{
              position: 'absolute', inset: 0, padding: '2px 4px',
              visibility: activeId === tab.id ? 'visible' : 'hidden',
              pointerEvents: activeId === tab.id ? 'auto' : 'none',
            }}
          />
        ))}
        {tabs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <button onClick={() => createTab()} style={{
              background: 'var(--accent-mauve)', color: 'var(--bg-base)', border: 'none',
              borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700
            }}>+ Open Terminal</button>
          </div>
        )}
      </div>
    </div>
  )
}
