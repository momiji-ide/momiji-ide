import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '../../store/appStore'
import '@xterm/xterm/css/xterm.css'

interface TermTab { id: string; title: string; running: boolean; exited: boolean }
let tabCounter = 0

const SHELL = { win32: 'cmd.exe', darwin: '/bin/zsh', linux: '/bin/bash' }

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
  const cwdRef         = useRef<string>(currentFolder || '')

  useEffect(() => { cwdRef.current = currentFolder || '' }, [currentFolder])

  // ── Create tab ───────────────────────────────────────────────────────
  const createTab = useCallback(async () => {
    const id = `term-${++tabCounter}`
    setTabs(prev => [...prev, { id, title: `Shell ${tabCounter}`, running: false, exited: false }])
    setActiveId(id)
    setInput('')
    setHistory([])
    setHistIdx(-1)
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    createTab()
  }, []) // eslint-disable-line

  // ── Mount xterm ──────────────────────────────────────────────────────
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
          black: '#45475a',     red: '#f38ba8',
          green: '#a6e3a1',     yellow: '#f9e2af',
          blue: '#89b4fa',      magenta: '#cba6f7',
          cyan: '#94e2d5',      white: '#bac2de',
          brightBlack: '#585b70',    brightRed: '#f38ba8',
          brightGreen: '#a6e3a1',    brightYellow: '#f9e2af',
          brightBlue: '#89b4fa',     brightMagenta: '#cba6f7',
          brightCyan: '#94e2d5',     brightWhite: '#a6adc8',
          selectionBackground: 'rgba(203,166,247,0.3)',
        },
        fontFamily: "'Cascadia Code','JetBrains Mono','Fira Code',Consolas,monospace",
        fontSize: 13, lineHeight: 1.45,
        cursorBlink: false, // we use our own input, no xterm cursor needed
        scrollback: 5000, convertEol: true, allowProposedApi: true,
        disableStdin: true, // input goes through our input bar
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
      term.writeln('\x1b[90m  ─────────────────────────\x1b[0m')
      term.write('\r\n')

      setTimeout(() => inputRef.current?.focus(), 80)
    }
    requestAnimationFrame(tryMount)
    return () => { cancelled = true }
  }, [activeId]) // eslint-disable-line

  // ── Process output → xterm ───────────────────────────────────────────
  useEffect(() => {
    const offOut = window.api.process.onStdout((id, data) => {
      terminalsRef.current.get(id)?.write(data)
    })
    const offErr = window.api.process.onStderr((id, data) => {
      terminalsRef.current.get(id)?.write(`\x1b[31m${data}\x1b[0m`)
    })
    const offExit = window.api.process.onExit((id, code) => {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, running: false } : t))
      if (code !== 0) {
        terminalsRef.current.get(id)?.write(`\x1b[33m\r\n[exited: ${code}]\x1b[0m\r\n`)
      }
    })
    return () => { offOut(); offErr(); offExit() }
  }, [])

  // ── Resize ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      if (activeId) fitAddonsRef.current.get(activeId)?.fit()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [activeId])

  // ── Run command ──────────────────────────────────────────────────────
  const runCommand = useCallback(async (cmd: string) => {
    if (!activeId || !cmd.trim()) return
    const term = terminalsRef.current.get(activeId)
    if (!term) return

    const shell = SHELL[process.platform as keyof typeof SHELL] ?? 'bash'
    const args  = process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd]
    const cwd   = cwdRef.current || undefined

    // Echo command
    term.write(`\x1b[32m❯\x1b[0m \x1b[1m${cmd}\x1b[0m\r\n`)

    setHistory(h => [cmd, ...h.slice(0, 99)])
    setHistIdx(-1)
    setInput('')
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, running: true } : t))

    await window.api.process.run(activeId, shell, args, cwd)
  }, [activeId])

  // ── Input handlers ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = input.trim()
      if (!cmd) return
      // Handle clear
      if (cmd === 'clear' || cmd === 'cls') {
        terminalsRef.current.get(activeId!)?.clear()
        setInput('')
        setHistory(h => [cmd, ...h.slice(0,99)])
        setHistIdx(-1)
        return
      }
      runCommand(cmd)
    } else if (e.key === 'c' && e.ctrlKey) {
      if (activeId) {
        window.api.process.kill(activeId)
        terminalsRef.current.get(activeId)?.write('\x1b[31m^C\x1b[0m\r\n')
        setTabs(prev => prev.map(t => t.id === activeId ? { ...t, running: false } : t))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setInput(history[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : history[idx])
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
              <span style={{ fontSize: 8, color: tab.running ? '#f9e2af' : tab.exited ? '#f38ba8' : '#a6e3a1' }}>●</span>
              {tab.title}
              {tab.running && <span className="animate-pulse" style={{ fontSize: 8, color: '#f9e2af' }}>⟳</span>}
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

        <button onClick={createTab}
          style={{ width: 30, height: 33, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)' }}
        >+</button>

        {activeId && (
          <button onClick={() => terminalsRef.current.get(activeId)?.clear()}
            style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
          >Clear</button>
        )}

        {activeTab?.running && (
          <button onClick={() => activeId && window.api.process.kill(activeId)}
            style={{ padding: '0 10px', height: 33, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#f38ba8', fontSize: 11, flexShrink: 0 }}
          >■ Stop</button>
        )}
      </div>

      {/* xterm output area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden"
        onClick={() => inputRef.current?.focus()}>
        {tabs.map(tab => (
          <div key={tab.id} id={`xterm-${tab.id}`}
            style={{
              position: 'absolute', inset: 0, padding: '2px 4px',
              visibility: activeId === tab.id ? 'visible' : 'hidden',
              pointerEvents: 'none', // output only, no interaction needed
            }}
          />
        ))}
        {tabs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-subtle)' }}>
            <button onClick={createTab} style={{
              background: 'var(--accent-mauve)', color: 'var(--bg-base)',
              border: 'none', borderRadius: 8, padding: '8px 20px',
              cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              + Open Terminal
            </button>
          </div>
        )}
      </div>

      {/* Input bar — always visible, always focusable */}
      {activeId && (
        <div className="flex items-center gap-2 flex-shrink-0"
          style={{
            padding: '6px 12px', background: '#181825',
            borderTop: '1px solid var(--border)',
          }}>
          <span style={{
            color: activeTab?.running ? '#f9e2af' : '#a6e3a1',
            fontFamily: 'monospace', fontSize: 14, flexShrink: 0
          }}>
            {activeTab?.running ? '⟳' : '❯'}
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={activeTab?.running}
            placeholder={activeTab?.running ? 'Running... (Ctrl+C to stop)' : 'Type a command...'}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: activeTab?.running ? 'var(--text-subtle)' : 'var(--text)',
              fontFamily: "'Cascadia Code','Fira Code',Consolas,monospace",
              fontSize: 13, caretColor: '#a6e3a1',
            }}
          />
          {input && !activeTab?.running && (
            <button onClick={() => runCommand(input)}
              style={{ background: 'var(--accent-mauve)', border: 'none', borderRadius: 4,
                padding: '2px 8px', color: 'var(--bg-base)', cursor: 'pointer', fontSize: 11 }}>
              ↵
            </button>
          )}
        </div>
      )}
    </div>
  )
}
