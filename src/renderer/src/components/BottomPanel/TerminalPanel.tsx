import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'

interface TermTab {
  id: string
  title: string
  exited: boolean
}

let tabCounter = 0

export function TerminalPanel() {
  const currentFolder = useAppStore(s => s.currentFolder)
  const [tabs, setTabs] = useState<TermTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const terminalsRef = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef = useRef<Map<string, FitAddon>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Create a new terminal tab ─────────────────────────────────────────
  const createTab = useCallback(async (cwd?: string) => {
    const id = `term-${++tabCounter}`
    const newTab: TermTab = { id, title: `Shell ${tabCounter}`, exited: false }

    setTabs(prev => [...prev, newTab])
    setActiveId(id)

    const result = await window.api.terminal.create(id, cwd ?? currentFolder ?? undefined)
    if (!result?.success) {
      console.error('[Terminal] Failed to create shell:', result?.error)
    }
  }, [currentFolder])

  // ── Init: open first terminal on mount ───────────────────────────────
  useEffect(() => {
    createTab()
  }, []) // eslint-disable-line

  // ── Mount xterm into DOM whenever activeId changes ───────────────────
  useEffect(() => {
    if (!activeId) return

    // Already mounted → just refit + focus
    if (terminalsRef.current.has(activeId)) {
      setTimeout(() => {
        fitAddonsRef.current.get(activeId)?.fit()
        terminalsRef.current.get(activeId)?.focus()
      }, 50)
      return
    }

    // Wait for DOM to render the container div before mounting xterm
    const mountTerminal = () => {
      const el = document.getElementById(`xterm-${activeId}`)
      if (!el) {
        // DOM not ready yet, retry
        requestAnimationFrame(mountTerminal)
        return
      }

      const term = new Terminal({
        theme: {
          background:   '#1e1e2e',
          foreground:   '#cdd6f4',
          cursor:       '#f5e0dc',
          cursorAccent: '#1e1e2e',
          black:        '#45475a', red:     '#f38ba8',
          green:        '#a6e3a1', yellow:  '#f9e2af',
          blue:         '#89b4fa', magenta: '#cba6f7',
          cyan:         '#94e2d5', white:   '#bac2de',
          brightBlack:  '#585b70', brightRed:     '#f38ba8',
          brightGreen:  '#a6e3a1', brightYellow:  '#f9e2af',
          brightBlue:   '#89b4fa', brightMagenta: '#cba6f7',
          brightCyan:   '#94e2d5', brightWhite:   '#a6adc8',
          selectionBackground: 'rgba(203,166,247,0.3)',
        },
        fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.45,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        allowProposedApi: true,
        convertEol: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(el)

      // Give xterm a frame to layout before fitting
      requestAnimationFrame(() => {
        fitAddon.fit()
        term.focus()
      })

      terminalsRef.current.set(activeId, term)
      fitAddonsRef.current.set(activeId, fitAddon)

      // User types → send raw to shell
      term.onData(data => window.api.terminal.write(activeId, data))

      // Welcome banner
      term.writeln('\x1b[35m  🦊 Parallax IDE Terminal\x1b[0m')
      term.writeln('\x1b[90m  ─────────────────────────\x1b[0m')
      term.write('\r\n')
    }

    requestAnimationFrame(mountTerminal)

  }, [activeId]) // eslint-disable-line

  // ── Stream data from shell → xterm ───────────────────────────────────
  useEffect(() => {
    const off = window.api.terminal.onData((id, data) => {
      terminalsRef.current.get(id)?.write(data)
    })
    return off
  }, [])

  // ── Shell exit ────────────────────────────────────────────────────────
  useEffect(() => {
    const off = window.api.terminal.onExit((id, code) => {
      terminalsRef.current.get(id)?.writeln(
        `\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`
      )
      setTabs(prev => prev.map(t => t.id === id ? { ...t, exited: true } : t))
    })
    return off
  }, [])

  // ── Refit when container resizes ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      if (activeId) fitAddonsRef.current.get(activeId)?.fit()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [activeId])

  // ── Close a tab ──────────────────────────────────────────────────────
  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.terminal.kill(id)
    terminalsRef.current.get(id)?.dispose()
    terminalsRef.current.delete(id)
    fitAddonsRef.current.delete(id)

    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id) {
        const newActive = next.at(-1) ?? null
        setActiveId(newActive?.id ?? null)
      }
      return next
    })
  }

  // ── Switch tab ───────────────────────────────────────────────────────
  const switchTab = (id: string) => {
    setActiveId(id)
    setTimeout(() => {
      fitAddonsRef.current.get(id)?.fit()
      terminalsRef.current.get(id)?.focus()
    }, 50)
  }

  // ── Focus active terminal on click ───────────────────────────────────
  const handleContainerClick = () => {
    if (activeId) terminalsRef.current.get(activeId)?.focus()
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
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className="flex items-center gap-1.5 px-3 text-xs flex-shrink-0 transition-all"
              style={{
                height: 33,
                background: activeId === tab.id ? '#1e1e2e' : 'transparent',
                color: activeId === tab.id ? 'var(--text)' : 'var(--text-subtle)',
                borderRight: '1px solid var(--border)',
                borderTop: activeId === tab.id ? '1px solid var(--accent-mauve)' : '1px solid transparent',
                borderBottom: 'none',
              }}
            >
              <span style={{ fontSize: 8, color: tab.exited ? 'var(--accent-red)' : 'var(--accent-green)' }}>●</span>
              {tab.title}
              <span
                onClick={e => closeTab(tab.id, e)}
                className="flex items-center justify-center rounded transition-colors ml-1"
                style={{
                  width: 14, height: 14, fontSize: 12,
                  color: 'var(--text-subtle)', cursor: 'pointer',
                  lineHeight: '14px', textAlign: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >×</span>
            </button>
          ))}
        </div>

        {/* New terminal */}
        <button
          onClick={() => createTab()}
          title="New Terminal"
          className="flex items-center justify-center transition-colors flex-shrink-0"
          style={{
            width: 30, height: 33, background: 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-subtle)', fontSize: 18, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)' }}
        >+</button>

        {/* Clear button */}
        {activeId && terminalsRef.current.has(activeId) && (
          <button
            onClick={() => terminalsRef.current.get(activeId!)?.clear()}
            title="Clear"
            className="flex items-center px-2 text-xs transition-colors flex-shrink-0"
            style={{ height: 33, color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)' }}
          >Clear</button>
        )}
      </div>

      {/* xterm containers */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden" onClick={handleContainerClick}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            id={`xterm-${tab.id}`}
            style={{
              position: 'absolute', inset: 0,
              padding: '2px 4px',
              display: activeId === tab.id ? 'block' : 'none',
            }}
          />
        ))}

        {tabs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2"
            style={{ color: 'var(--text-subtle)', fontSize: 13 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <span>No terminal open</span>
            <button
              onClick={() => createTab()}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer' }}
            >Open Terminal</button>
          </div>
        )}
      </div>
    </div>
  )
}
