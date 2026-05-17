import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'

interface TermTab { id: string; title: string; running: boolean }
let tabCounter = 0

const isWin  = navigator.userAgent.includes('Windows')
const SHELL  = isWin ? 'cmd'  : 'bash'
const mkArgs = (cmd: string) => isWin ? ['/c', cmd] : ['-c', cmd]

export function TerminalPanel() {
  const currentFolder  = useAppStore(s => s.currentFolder)
  const [tabs, setTabs]         = useState<TermTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput]       = useState('')
  const [history, setHistory]   = useState<string[]>([])
  const [histIdx, setHistIdx]   = useState(-1)

  const terminalsRef   = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef   = useRef<Map<string, FitAddon>>(new Map())
  const containerRef   = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  // ── Create tab ───────────────────────────────────────────────────────
  const createTab = useCallback(() => {
    const id = `term-${++tabCounter}`
    setTabs(prev => [...prev, { id, title: `Shell ${tabCounter}`, running: false }])
    setActiveId(id)
    setInput('')
    setHistIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    createTab()
  }, []) // eslint-disable-line

  // ── Mount xterm display ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return
    if (terminalsRef.current.has(activeId)) {
      setTimeout(() => { fitAddonsRef.current.get(activeId)?.fit(); inputRef.current?.focus() }, 50)
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
        fontSize: 13, lineHeight: 1.45, cursorBlink: false,
        scrollback: 5000, convertEol: true, allowProposedApi: true,
        disableStdin: true, // display only — input goes via the input bar
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(el)
      fitAddon.fit()

      terminalsRef.current.set(activeId, term)
      fitAddonsRef.current.set(activeId, fitAddon)

      const cwd = currentFolder || ''
      const shortCwd = cwd ? cwd.split(/[\\/]/).slice(-2).join('/') : '~'
      term.writeln(`\x1b[35m🦊 Parallax IDE Terminal\x1b[0m  \x1b[90m${shortCwd}\x1b[0m`)
      term.writeln('\x1b[90m' + '─'.repeat(40) + '\x1b[0m\r\n')

      setTimeout(() => inputRef.current?.focus(), 80)
    }
    requestAnimationFrame(tryMount)
    return () => { cancelled = true }
  }, [activeId, currentFolder]) // eslint-disable-line

  // ── stdout/stderr → xterm ────────────────────────────────────────────
  useEffect(() => {
    const offOut  = window.api.process.onStdout((id, data) => terminalsRef.current.get(id)?.write(data))
    const offErr  = window.api.process.onStderr((id, data) => terminalsRef.current.get(id)?.write(`\x1b[31m${data}\x1b[0m`))
    const offExit = window.api.process.onExit((id, code) => {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, running: false } : t))
      if (code !== 0) terminalsRef.current.get(id)?.write(`\x1b[33m[exit: ${code}]\x1b[0m\r\n`)
      // refocus input after command finishes
      if (id === activeId) setTimeout(() => inputRef.current?.focus(), 50)
    })
    return () => { offOut(); offErr(); offExit() }
  }, [activeId])

  // ── Resize ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => { if (activeId) fitAddonsRef.current.get(activeId)?.fit() })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [activeId])

  // ── Run command ──────────────────────────────────────────────────────
  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || !activeId) return
    const term = terminalsRef.current.get(activeId)
    if (!term) return

    if (cmd === 'clear' || cmd === 'cls') {
      term.clear(); setInput(''); setHistory(h => [cmd, ...h.slice(0,99)]); setHistIdx(-1); return
    }

    term.write(`\x1b[32m❯\x1b[0m \x1b[1m${cmd}\x1b[0m\r\n`)
    setHistory(h => [cmd, ...h.slice(0, 99)])
    setHistIdx(-1)
    setInput('')
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, running: true } : t))

    await window.api.process.run(activeId, SHELL, mkArgs(cmd), currentFolder ?? undefined)
  }, [activeId, currentFolder])

  // ── Keyboard handler on input ────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(input.trim())
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      const tab = tabs.find(t => t.id === activeId)
      if (tab?.running && activeId) {
        window.api.process.kill(activeId)
        terminalsRef.current.get(activeId)?.write('\x1b[31m^C\x1b[0m\r\n')
        setTabs(prev => prev.map(t => t.id === activeId ? { ...t, running: false } : t))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx); setInput(history[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx); setInput(idx === -1 ? '' : history[idx])
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      terminalsRef.current.get(activeId!)?.clear()
    }
  }

  // ── Close tab ────────────────────────────────────────────────────────
  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.process.kill(id)
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
    setInput(''); setHistIdx(-1)
    setTimeout(() => { fitAddonsRef.current.get(id)?.fit(); inputRef.current?.focus() }, 50)
  }

  const activeTab = tabs.find(t => t.id === activeId)

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
              <span style={{ fontSize: 8, color: tab.running ? '#f9e2af' : '#a6e3a1' }}>
                {tab.running ? '◉' : '●'}
              </span>
              {tab.title}
              <span onClick={e => closeTab(tab.id, e)}
                style={{ marginLeft: 4, width: 14, height: 14, fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3, color: 'var(--text-subtle)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >×</span>
            </button>
          ))}
        </div>

        <button onClick={createTab}
          title="New Terminal (Ctrl+`)"
          style={{ width: 30, height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)' }}
        >+</button>

        <button onClick={() => terminalsRef.current.get(activeId!)?.clear()}
          style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >Clear</button>

        {activeTab?.running && (
          <button onClick={() => { window.api.process.kill(activeId!); setTabs(p => p.map(t => t.id===activeId?{...t,running:false}:t)) }}
            style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#f38ba8', fontSize: 11, flexShrink: 0 }}
          >■ Stop</button>
        )}
      </div>

      {/* xterm output */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden"
        onClick={() => inputRef.current?.focus()}>
        {tabs.map(tab => (
          <div key={tab.id} id={`xterm-${tab.id}`}
            style={{
              position: 'absolute', inset: 0, padding: '2px 4px',
              visibility: activeId === tab.id ? 'visible' : 'hidden',
              pointerEvents: 'none',
            }}
          />
        ))}
        {tabs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <button onClick={createTab} style={{
              background: 'var(--accent-mauve)', color: 'var(--bg-base)', border: 'none',
              borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700
            }}>+ Open Terminal</button>
          </div>
        )}
      </div>

      {/* Input bar */}
      {activeId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', background: '#181825',
          borderTop: '1px solid rgba(203,166,247,0.15)',
        }}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Prompt */}
          <span style={{
            fontFamily: "'Cascadia Code',monospace", fontSize: 13, flexShrink: 0,
            color: activeTab?.running ? '#f9e2af' : '#a6e3a1',
            userSelect: 'none',
          }}>
            {activeTab?.running ? '⟳' : isWin ? '>' : '$'}
          </span>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={activeTab?.running}
            placeholder={activeTab?.running ? 'Running...  Ctrl+C to stop' : ''}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Cascadia Code','Fira Code',Consolas,monospace",
              fontSize: 13, color: 'var(--text)', caretColor: '#a6e3a1',
              opacity: activeTab?.running ? 0.4 : 1,
            }}
          />
        </div>
      )}
    </div>
  )
}
