import { useState, useEffect, useRef, useCallback } from 'react'
import { ansiToHtml } from '../../utils/codeRunner'
import { useAppStore } from '../../store/appStore'

interface OutputLine {
  id: number
  html: string
  type: 'stdout' | 'stderr' | 'system'
}

interface TerminalPanelProps {
  processId: string
  cwd?: string
}

let lineId = 0

const SHELLS = [
  { id: 'powershell', label: '⚡ PowerShell', cmd: 'powershell', argsFn: (c: string) => ['-Command', c] },
  { id: 'cmd',        label: '> CMD',         cmd: 'cmd',        argsFn: (c: string) => ['/c', c] },
  { id: 'bash',       label: '$ Bash',        cmd: 'bash',       argsFn: (c: string) => ['-c', c] },
  { id: 'zsh',        label: '$ Zsh',         cmd: 'zsh',        argsFn: (c: string) => ['-c', c] },
]

export function TerminalPanel({ processId, cwd }: TerminalPanelProps) {
  const { settings } = useAppStore()
  const [lines, setLines] = useState<OutputLine[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [shell, setShell] = useState(settings.terminalShell ?? 'powershell')
  const [shellOpen, setShellOpen] = useState(false)
  const shellBtnRef = useRef<HTMLButtonElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addLine = useCallback((text: string, type: OutputLine['type']) => {
    const chunks = text.split('\n')
    setLines((prev) => [
      ...prev,
      ...chunks
        .filter((_, i) => i < chunks.length - 1 || chunks[chunks.length - 1] !== '')
        .map((chunk) => ({
          id: lineId++,
          html: ansiToHtml(chunk),
          type
        }))
    ])
  }, [])

  useEffect(() => {
    const offOut = window.api.process.onStdout((id, data) => {
      if (id === processId) addLine(data, 'stdout')
    })
    const offErr = window.api.process.onStderr((id, data) => {
      if (id === processId) addLine(data, 'stderr')
    })
    const offExit = window.api.process.onExit((id, code) => {
      if (id === processId) {
        setIsRunning(false)
        const msg = code === 0
          ? '\x1b[32m\n[Process exited with code 0]\x1b[0m'
          : `\x1b[31m\n[Process exited with code ${code}]\x1b[0m`
        addLine(msg, 'system')
      }
    })
    return () => { offOut(); offErr(); offExit() }
  }, [processId, addLine])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return
    const shellCfg = SHELLS.find(s => s.id === shell) ?? SHELLS[0]
    addLine(`\x1b[90m[${shellCfg.label}]\x1b[0m \x1b[34m${cmd}\x1b[0m`, 'system')
    setHistory((h) => [cmd, ...h.slice(0, 49)])
    setHistIdx(-1)
    setIsRunning(true)
    await window.api.process.run(processId, shellCfg.cmd, shellCfg.argsFn(cmd), cwd)
  }, [processId, cwd, addLine, shell])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRunning) {
      window.api.process.stdin(processId, input + '\n')
      addLine(input, 'stdout')
      setInput('')
    } else {
      runCommand(input)
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setInput(history[idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : history[idx])
    } else if (e.key === 'c' && e.ctrlKey && isRunning) {
      e.preventDefault()
      window.api.process.kill(processId)
    }
  }

  const clearTerminal = () => setLines([])

  // Close shell dropdown on outside click
  useEffect(() => {
    if (!shellOpen) return
    const close = () => setShellOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [shellOpen])

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>TERMINAL</span>

          {/* Shell selector — custom dropdown */}
          <div className="relative">
            <button
              ref={shellBtnRef}
              onClick={(e) => { e.stopPropagation(); setShellOpen(v => !v) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
              style={{
                background: shellOpen ? 'var(--bg-surface1)' : 'var(--bg-surface0)',
                color: 'var(--text)',
                border: '1px solid var(--border)'
              }}>
              {SHELLS.find(s => s.id === shell)?.label ?? shell}
              <span style={{ color: 'var(--text-subtle)', fontSize: 9 }}>▾</span>
            </button>

            {shellOpen && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute left-0 z-50 rounded-lg overflow-hidden py-1 shadow-xl"
                style={{
                  top: '100%', marginTop: 4, minWidth: 140,
                  background: 'var(--bg-mantle)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                {SHELLS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setShell(s.id); setShellOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                    style={{
                      background: shell === s.id ? 'var(--bg-surface0)' : 'transparent',
                      color: shell === s.id ? 'var(--accent-blue)' : 'var(--text)',
                      fontWeight: shell === s.id ? 600 : 400
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                    onMouseLeave={e => (e.currentTarget.style.background = shell === s.id ? 'var(--bg-surface0)' : 'transparent')}>
                    {shell === s.id && <span style={{ color: 'var(--accent-blue)' }}>✓</span>}
                    {shell !== s.id && <span style={{ width: 12 }} />}
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isRunning && (
            <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>running</span>
          )}
          {cwd && (
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {cwd.split(/[\\/]/).slice(-2).join('/')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={() => window.api.process.kill(processId)}
              className="text-xs px-2 py-0.5 rounded transition-colors"
              style={{ background: 'var(--accent-red)', color: 'white' }}
              title="Kill process (Ctrl+C)"
            >
              ■ Stop
            </button>
          )}
          <button
            onClick={clearTerminal}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="Clear"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed"
        style={{ background: 'var(--bg-crust)' }}>
        {lines.length === 0 && (
          <p style={{ color: 'var(--text-subtle)' }}>
            Terminal ready. Type a command and press Enter.{'\n'}
            Ctrl+C to kill running process · ↑↓ for history
          </p>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            style={{ color: line.type === 'stderr' ? 'var(--accent-red)' : 'var(--text)' }}
            dangerouslySetInnerHTML={{ __html: line.html || '&nbsp;' }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-crust)', borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs mr-2 flex-shrink-0" style={{ color: 'var(--accent-green)' }}>
          {isRunning ? '>' : '$'}
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-xs"
          style={{ color: 'var(--text)', caretColor: 'var(--accent-green)', fontFamily: 'inherit' }}
          placeholder={isRunning ? 'Send input...' : 'Enter command...'}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  )
}
