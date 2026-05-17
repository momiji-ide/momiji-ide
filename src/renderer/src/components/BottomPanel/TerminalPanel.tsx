import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'

interface TermTab { id: string; title: string; exited: boolean }

let tabCounter = 0

// Convert KeyboardEvent → terminal escape sequence
function keyToSeq(e: KeyboardEvent): string | null {
  const ctrl = e.ctrlKey
  const shift = e.shiftKey

  if (e.key === 'Enter')     return '\r'
  if (e.key === 'Backspace') return '\x7f'
  if (e.key === 'Tab')       return shift ? '\x1b[Z' : '\t'
  if (e.key === 'Escape')    return '\x1b'
  if (e.key === 'Delete')    return '\x1b[3~'
  if (e.key === 'Home')      return ctrl ? '\x1b[1;5H' : '\x1b[H'
  if (e.key === 'End')       return ctrl ? '\x1b[1;5F' : '\x1b[F'
  if (e.key === 'PageUp')    return '\x1b[5~'
  if (e.key === 'PageDown')  return '\x1b[6~'
  if (e.key === 'ArrowUp')   return ctrl ? '\x1b[1;5A' : '\x1b[A'
  if (e.key === 'ArrowDown') return ctrl ? '\x1b[1;5B' : '\x1b[B'
  if (e.key === 'ArrowRight')return ctrl ? '\x1b[1;5C' : '\x1b[C'
  if (e.key === 'ArrowLeft') return ctrl ? '\x1b[1;5D' : '\x1b[D'

  // F keys
  const fKeys: Record<string, string> = {
    F1:'\x1bOP', F2:'\x1bOQ', F3:'\x1bOR', F4:'\x1bOS',
    F5:'\x1b[15~', F6:'\x1b[17~', F7:'\x1b[18~', F8:'\x1b[19~',
    F9:'\x1b[20~', F10:'\x1b[21~', F11:'\x1b[23~', F12:'\x1b[24~',
  }
  if (fKeys[e.key]) return fKeys[e.key]

  // Ctrl + letter
  if (ctrl && e.key.length === 1) {
    const code = e.key.toLowerCase().charCodeAt(0) - 96
    if (code > 0 && code < 32) return String.fromCharCode(code)
  }

  // Regular printable character
  if (!ctrl && !e.metaKey && e.key.length === 1) return e.key

  return null
}

export function TerminalPanel() {
  const currentFolder = useAppStore(s => s.currentFolder)
  const [tabs, setTabs]       = useState<TermTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const terminalsRef   = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef   = useRef<Map<string, FitAddon>>(new Map())
  const containerRef   = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const isFocusedRef   = useRef(false)  // is terminal area focused?
  const activeIdRef    = useRef<string | null>(null)

  // Keep ref in sync with state
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // ── Global keyboard interceptor ──────────────────────────────────────
  // When terminal is focused, capture all key events and forward to shell
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isFocusedRef.current || !activeIdRef.current) return

      // Let Ctrl+C through as SIGINT, block other Ctrl shortcuts that
      // would steal focus (Ctrl+P, Ctrl+B, Ctrl+W, etc.)
      if ((e.ctrlKey || e.metaKey) && e.key !== 'c' && e.key !== 'v'
          && e.key !== 'd' && e.key !== 'z' && e.key !== 'l'
          && e.key !== 'a' && e.key.length > 1) {
        return // let IDE shortcuts still work
      }

      const seq = keyToSeq(e)
      if (seq === null) return

      e.preventDefault()
      e.stopImmediatePropagation()

      const id = activeIdRef.current
      // Write to xterm display
      // Note: shell echoes back, so we don't write to xterm directly
      // Just send to shell and let stdout come back
      window.api.terminal.write(id, seq)
    }

    // Use capture phase so we get events before Monaco/other handlers
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [])

  // ── Create tab ───────────────────────────────────────────────────────
  const createTab = useCallback(async (cwd?: string) => {
    const id = `term-${++tabCounter}`
    setTabs(prev => [...prev, { id, title: `Shell ${tabCounter}`, exited: false }])
    setActiveId(id)
    await window.api.terminal.create(id, cwd ?? currentFolder ?? undefined)
  }, [currentFolder])

  // ── Init once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    createTab()
  }, []) // eslint-disable-line

  // ── Mount xterm when tab becomes active ──────────────────────────────
  useEffect(() => {
    if (!activeId) return

    if (terminalsRef.current.has(activeId)) {
      setTimeout(() => {
        fitAddonsRef.current.get(activeId)?.fit()
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
          background: '#1e1e2e', foreground: '#cdd6f4',
          cursor: '#f5e0dc', cursorAccent: '#1e1e2e',
          black: '#45475a',    red: '#f38ba8',
          green: '#a6e3a1',    yellow: '#f9e2af',
          blue: '#89b4fa',     magenta: '#cba6f7',
          cyan: '#94e2d5',     white: '#bac2de',
          brightBlack: '#585b70',    brightRed: '#f38ba8',
          brightGreen: '#a6e3a1',    brightYellow: '#f9e2af',
          brightBlue: '#89b4fa',     brightMagenta: '#cba6f7',
          brightCyan: '#94e2d5',     brightWhite: '#a6adc8',
          selectionBackground: 'rgba(203,166,247,0.3)',
        },
        fontFamily: "'Cascadia Code','JetBrains Mono','Fira Code',Consolas,monospace",
        fontSize: 13, lineHeight: 1.45,
        cursorBlink: true, cursorStyle: 'block',
        scrollback: 5000, convertEol: true,
        allowProposedApi: true,
        // Disable xterm's own keyboard handling — we handle it globally
        customKeyEventHandler: () => false,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(el)
      fitAddon.fit()

      terminalsRef.current.set(activeId, term)
      fitAddonsRef.current.set(activeId, fitAddon)

      // Welcome
      term.writeln('\x1b[35m  🦊 Parallax IDE Terminal\x1b[0m')
      term.writeln('\x1b[90m  ─────────────────────────\x1b[0m\r\n')
    }

    requestAnimationFrame(tryMount)
    return () => { cancelled = true }
  }, [activeId]) // eslint-disable-line

  // ── Shell data → xterm display ───────────────────────────────────────
  useEffect(() => {
    const off = window.api.terminal.onData((id, data) => {
      terminalsRef.current.get(id)?.write(data)
    })
    return off
  }, [])

  // ── Shell exit ───────────────────────────────────────────────────────
  useEffect(() => {
    const off = window.api.terminal.onExit((id, code) => {
      terminalsRef.current.get(id)?.writeln(
        `\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`)
      setTabs(prev => prev.map(t => t.id === id ? { ...t, exited: true } : t))
    })
    return off
  }, [])

  // ── Resize observer ──────────────────────────────────────────────────
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
    setTimeout(() => fitAddonsRef.current.get(id)?.fit(), 50)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#1e1e2e' }}>

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{
        height: 33, background: 'var(--bg-mantle)',
        borderBottom: '1px solid var(--border)',
      }}>
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
              }}
            >
              <span style={{ fontSize: 8, color: tab.exited ? '#f38ba8' : '#a6e3a1' }}>●</span>
              {tab.title}
              <span onClick={e => closeTab(tab.id, e)}
                style={{
                  marginLeft: 4, width: 14, height: 14, fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3, color: 'var(--text-subtle)', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >×</span>
            </button>
          ))}
        </div>
        <button onClick={() => createTab()}
          style={{
            width: 30, height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)' }}
        >+</button>
        {activeId && terminalsRef.current.has(activeId) && (
          <button onClick={() => terminalsRef.current.get(activeId!)?.clear()}
            style={{
              padding: '0 10px', height: 33, background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
          >Clear</button>
        )}
      </div>

      {/* Terminal area — click to "focus" (activate keyboard capture) */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: 'text' }}
        onMouseDown={() => { isFocusedRef.current = true }}
        onBlur={() => { isFocusedRef.current = false }}
        tabIndex={0}
        onFocus={() => { isFocusedRef.current = true }}
      >
        {/* Thin border shows when "focused" */}
        {isFocusedRef.current && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            boxShadow: 'inset 0 0 0 1px rgba(203,166,247,0.3)',
          }} />
        )}

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
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 10,
            color: 'var(--text-subtle)', fontSize: 13,
          }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <span>No terminal open</span>
            <button onClick={() => createTab()} style={{
              background: 'var(--accent-mauve)', color: 'var(--bg-base)',
              border: 'none', borderRadius: 8, padding: '6px 16px',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>Open Terminal</button>
          </div>
        )}
      </div>
    </div>
  )
}
