import { useState, useEffect, useRef, useCallback } from 'react'
import { ansiToHtml } from '../../utils/codeRunner'
import { callKitsune, parseErrorLine, hasError } from '../../utils/callKitsune'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'

interface OutputLine {
  id: number
  html: string
  type: 'stdout' | 'stderr' | 'system'
  ts: number
}

let oid = 0

interface Props {
  processId: string
  onRunningChange?: (running: boolean) => void
}

export function OutputPanel({ processId, onRunningChange }: Props) {
  const [lines, setLines]           = useState<OutputLine[]>([])
  const [isRunning, setIsRunning]   = useState(false)
  const [elapsed, setElapsed]       = useState<number | null>(null)

  // Kitsune explain state
  const [kitVisible, setKitVisible] = useState(false)
  const [kitLoading, setKitLoading] = useState(false)
  const [kitText, setKitText]       = useState('')
  const [kitErrorLine, setKitErrorLine] = useState<number | null>(null)
  const [kitFixing, setKitFixing]   = useState(false)
  const [kitFixed, setKitFixed]     = useState(false)

  const stderrBuf  = useRef('')
  const exitCode   = useRef(0)
  const startTime  = useRef(0)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)

  const addLine = useCallback((text: string, type: OutputLine['type']) => {
    setLines((prev) => [
      ...prev,
      ...text.split('\n')
        .filter((_, i, arr) => !(i === arr.length - 1 && arr[arr.length - 1] === ''))
        .map((chunk) => ({ id: oid++, html: ansiToHtml(chunk), type, ts: Date.now() }))
    ])
  }, [])

  // ── Kitsune auto-explain ────────────────────────────────────────────
  const explainError = useCallback(async (stderr: string) => {
    const { aiProviders, tabs, activeTabId } = useAppStore.getState()
    const hasProvider = aiProviders.some((p) => p.enabled && p.apiKey)
    const activeTab = tabs.find((t) => t.id === activeTabId)

    setKitVisible(true)
    setKitFixed(false)

    if (!hasProvider) {
      setKitText('__NO_PROVIDER__')
      return
    }

    setKitLoading(true)
    const line = parseErrorLine(stderr)
    setKitErrorLine(line)

    const codeSnippet = activeTab
      ? `\n\nFile: ${activeTab.fileName}\nLanguage: ${activeTab.language}\n\`\`\`\n${activeTab.content.slice(0, 1500)}\n\`\`\``
      : ''

    try {
      const reply = await callKitsune(
        `A student ran their code and got this error:\n\n${stderr.slice(0, 800)}${codeSnippet}\n\nExplain what went wrong in 2-3 friendly sentences. No jargon. Be encouraging. If you can see the fix clearly, show it briefly (e.g. "Change line X from ... to ...").`,
        `You are Kitsune 🦊, the friendly AI guide inside Momiji IDE. You help beginners understand errors. Speak like a patient teacher, not a manual. Keep answers short, warm, and actionable.`
      )
      setKitText(reply)
    } catch {
      setKitText('Could not get explanation. Check your internet and AI configuration in Settings.')
    }
    setKitLoading(false)
  }, [])

  const handleAutoFix = useCallback(async () => {
    const { tabs, activeTabId, updateTabContent, markTabClean } = useAppStore.getState()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return

    setKitFixing(true)
    try {
      const fixed = await callKitsune(
        `Fix the following ${activeTab.language} code so it runs without errors.
Return ONLY the corrected code — no explanation, no markdown fences.

Error:\n${stderrBuf.current.slice(0, 600)}

Code:\n${activeTab.content}`,
        'You are a code fixer. Return only the corrected source code, nothing else.'
      )
      // Strip accidental markdown fences
      const clean = fixed.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
      updateTabContent(activeTab.id, clean)
      await window.api.fs.writeFile(activeTab.filePath, clean)
      markTabClean(activeTab.id)
      setKitFixed(true)
      setKitText('✅ Fixed! The corrected code has been applied. Press ▶ Run to try again.')
    } catch {
      setKitText('Could not auto-fix. Try fixing manually based on the explanation above.')
    }
    setKitFixing(false)
  }, [])

  const handleJumpToLine = useCallback(() => {
    if (kitErrorLine) {
      window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: kitErrorLine } }))
    }
  }, [kitErrorLine])

  // ── Process listeners ───────────────────────────────────────────────
  useEffect(() => {
    const offOut = window.api.process.onStdout((id, data) => {
      if (id === processId) addLine(data, 'stdout')
    })
    const offErr = window.api.process.onStderr((id, data) => {
      if (id === processId) { addLine(data, 'stderr'); stderrBuf.current += data }
    })
    const offExit = window.api.process.onExit((id, code) => {
      if (id !== processId) return
      if (timerRef.current) clearInterval(timerRef.current)
      const ms = Date.now() - startTime.current
      exitCode.current = code
      setIsRunning(false)
      onRunningChange?.(false)
      setElapsed(ms)
      if (code === 0) {
        addLine('\x1b[32m\n✓ Done in ' + (ms / 1000).toFixed(2) + 's\x1b[0m', 'system')
      } else {
        addLine('\x1b[31m\n✗ Exited with code ' + code + ' in ' + (ms / 1000).toFixed(2) + 's\x1b[0m', 'system')
        if (hasError(stderrBuf.current, code)) {
          addLine('\x1b[90m  Analyzing error with Kitsune...\x1b[0m', 'system')
        }
      }

      // Trigger Kitsune if error
      if (hasError(stderrBuf.current, code)) {
        explainError(stderrBuf.current)
      }
    })
    return () => { offOut(); offErr(); offExit() }
  }, [processId, addLine, onRunningChange, explainError])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  // Listen for run trigger
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail.processId !== processId) return
      setLines([])
      setIsRunning(true)
      setElapsed(null)
      setKitVisible(false)
      setKitText('')
      setKitFixed(false)
      stderrBuf.current = ''
      onRunningChange?.(true)
      startTime.current = Date.now()
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTime.current), 100)

      // Show VS Code-style run header
      const { command, args = [], cwd, label, fileName } = e.detail
      if (command) {
        const cmdStr = [command, ...args].join(' ')
        const now = new Date().toLocaleTimeString()
        addLine(`\x1b[36m▶ [${now}] Running ${label ?? command}: ${fileName ?? cmdStr}\x1b[0m`, 'system')
        if (cwd) addLine(`\x1b[90m  cwd: ${cwd}\x1b[0m`, 'system')
        addLine('', 'system')
      }
    }
    window.addEventListener('runner:start', handler as EventListener)
    return () => window.removeEventListener('runner:start', handler as EventListener)
  }, [processId, onRunningChange, addLine])

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>OUTPUT</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs animate-pulse" style={{ color: 'var(--accent-yellow)' }}>
              <span className="animate-spin">⟳</span>
              {elapsed !== null ? `${(elapsed / 1000).toFixed(1)}s` : 'running'}
            </span>
          )}
          {!isRunning && elapsed !== null && (
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{(elapsed / 1000).toFixed(2)}s</span>
          )}
        </div>
        <div className="flex gap-2">
          {isRunning && (
            <button onClick={() => window.api.process.kill(processId)}
              className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-red)', color: 'white' }}>
              ■ Stop
            </button>
          )}
          <button onClick={() => { setLines([]); setKitVisible(false) }}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Clear
          </button>
        </div>
      </div>

      {/* Raw output */}
      <div className="overflow-y-auto p-3 text-xs leading-relaxed"
        style={{ background: 'var(--bg-crust)', flex: kitVisible ? '0 0 auto' : 1, maxHeight: kitVisible ? '45%' : undefined }}>
        {lines.length === 0 && (
          <p style={{ color: 'var(--text-subtle)' }}>Press ▶ Run to execute the current file.</p>
        )}
        {lines.map((line) => (
          <div key={line.id}
            style={{ color: line.type === 'stderr' ? 'var(--accent-red)' : 'var(--text)', whiteSpace: 'pre' }}
            dangerouslySetInnerHTML={{ __html: line.html || '&nbsp;' }} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Kitsune Error Explanation ── */}
      {kitVisible && (
        <div className="flex-1 flex flex-col overflow-hidden"
          style={{ borderTop: '2px solid var(--accent-mauve)', background: 'var(--bg-mantle)' }}>
          {/* Kitsune header */}
          <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <KitsuneLogo size={18} />
              <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--accent-mauve)' }}>
                KITSUNE
              </span>
              {kitLoading && <span className="text-xs animate-pulse" style={{ color: 'var(--text-subtle)' }}>analyzing…</span>}
              {!kitLoading && kitText && !kitFixed && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)', fontSize: '9px' }}>
                  ERROR DETECTED
                </span>
              )}
              {kitFixed && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', fontSize: '9px' }}>
                  FIXED ✓
                </span>
              )}
            </div>
            <button onClick={() => setKitVisible(false)} className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-subtle)' }} title="Dismiss">✕</button>
          </div>

          {/* Explanation body */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {kitLoading ? (
              <div className="flex items-start gap-3">
                <KitsuneLogo size={32} className="flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1.5">
                  {[90, 75, 55].map((w, i) => (
                    <div key={i} className="h-3 rounded animate-pulse"
                      style={{ width: `${w}%`, background: 'var(--bg-surface1)' }} />
                  ))}
                </div>
              </div>
            ) : kitText === '__NO_PROVIDER__' ? (
              <div className="flex items-start gap-3">
                <KitsuneLogo size={32} className="flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                    Configure Kitsune AI to get error explanations
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Go to ⚙️ Settings → AI & API Keys, or run the setup wizard from Help menu.
                    The free Gemini tier is enough — just needs a Google account.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <KitsuneLogo size={32} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {kitText}
                  </p>

                  {/* Action buttons */}
                  {!kitFixed && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {kitErrorLine && (
                        <button onClick={handleJumpToLine}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
                          📍 Jump to line {kitErrorLine}
                        </button>
                      )}
                      <button onClick={handleAutoFix} disabled={kitFixing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: kitFixing ? 'var(--bg-surface0)' : 'var(--accent-mauve)',
                          color: kitFixing ? 'var(--text-muted)' : 'white',
                          border: 'none'
                        }}>
                        {kitFixing ? '🦊 Fixing…' : '🦊 Fix automatically'}
                      </button>
                      <button
                        onClick={() => {
                          // Re-explain with more detail
                          setKitText('')
                          explainError(stderrBuf.current)
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs transition-all"
                        style={{ background: 'transparent', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                        Explain more
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
