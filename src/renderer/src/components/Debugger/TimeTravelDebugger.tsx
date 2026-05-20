import { useState, useRef, useCallback, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useAppStore } from '../../store/appStore'
import { buildInstrumentedCode, buildSandboxHTML, type DebugSnapshot } from '../../utils/codeInstrumentor'
import { toast } from '../../utils/toast'

export function TimeTravelDebugger() {
  const { tabs, activeTabId, settings } = useAppStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

  const [snapshots, setSnapshots] = useState<DebugSnapshot[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalOutput, setFinalOutput] = useState<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  const current = snapshots[currentStep]

  // Highlight current line in editor
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !current) return

    decorationsRef.current?.clear()
    decorationsRef.current = editor.createDecorationsCollection([{
      range: new monaco.Range(current.line, 1, current.line, 1),
      options: {
        isWholeLine: true,
        className: undefined,
        linesDecorationsClassName: 'debug-line-gutter',
        inlineClassName: 'debug-line-highlight'
      }
    }])

    editor.revealLineInCenterIfOutsideViewport(current.line)
  }, [current])

  const runDebug = useCallback(async () => {
    if (!activeTab || activeTab.language !== 'javascript') {
      toast.warning('Time-travel debugger supports JavaScript only (for now)')
      return
    }

    setRunning(true)
    setError(null)
    setSnapshots([])
    setCurrentStep(0)

    try {
      const instrumented = buildInstrumentedCode(activeTab.content)
      const html = buildSandboxHTML(instrumented)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === 'snapshots') {
          const snaps = e.data.data as DebugSnapshot[]
          setSnapshots(snaps)
          setFinalOutput(e.data.finalOutput ?? [])
          setCurrentStep(0)
          setRunning(false)
          URL.revokeObjectURL(url)
          window.removeEventListener('message', handleMessage)
          toast.success(`Captured ${snaps.length} snapshots — use the timeline to travel!`)
        } else if (e.data?.type === 'error') {
          setError(`Line ${e.data.line}: ${e.data.message}`)
          setRunning(false)
          URL.revokeObjectURL(url)
          window.removeEventListener('message', handleMessage)
          toast.error(`Runtime error: ${e.data.message}`)
        }
      }

      window.addEventListener('message', handleMessage)

      if (iframeRef.current) {
        iframeRef.current.src = url
      }

      // Timeout safety
      setTimeout(() => {
        if (running) {
          setRunning(false)
          setError('Execution timed out (5s)')
          window.removeEventListener('message', handleMessage)
        }
      }, 5000)
    } catch (e: unknown) {
      setError(String(e))
      setRunning(false)
    }
  }, [activeTab])

  const goTo = (step: number) => setCurrentStep(Math.max(0, Math.min(snapshots.length - 1, step)))
  const prev = () => goTo(currentStep - 1)
  const next = () => goTo(currentStep + 1)

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (snapshots.length === 0) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [snapshots.length, currentStep])

  const isJS = activeTab?.language === 'javascript'

  if (!activeTab) {
    return <Empty icon="🕐" title="No file open" desc="Open a JavaScript file to use the Time-Travel Debugger" />
  }

  if (!isJS) {
    return <Empty icon="🕐" title="JavaScript only" desc="Time-Travel Debugger currently supports JavaScript. Python support coming soon!" />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '40px' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>⏱ Time-Travel Debugger</span>
        {snapshots.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)' }}>
            {snapshots.length} snapshots
          </span>
        )}
        <div className="flex-1" />
        <button onClick={runDebug} disabled={running}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
          style={{ background: running ? 'var(--bg-surface0)' : 'var(--accent-green)', color: running ? 'var(--text-muted)' : 'var(--bg-base)' }}>
          {running ? <><span className="animate-spin">⟳</span> Running...</> : '▶ Run & Capture'}
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Code editor with line highlight */}
        <div className="flex flex-col" style={{ flex: '0 0 50%', borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center px-3 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '32px' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {activeTab.fileName}
              {current && <span style={{ color: 'var(--accent-yellow)' }}> — Line {current.line}</span>}
            </span>
          </div>
          <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
            <MonacoEditor
              language={activeTab.language}
              value={activeTab.content}
              theme={monacoTheme}
              onMount={(ed, mo) => { editorRef.current = ed; monacoRef.current = mo }}
              options={{
                readOnly: true, fontSize: settings.fontSize - 1,
                fontFamily: settings.fontFamily, fontLigatures: true,
                minimap: { enabled: false }, lineNumbers: 'on',
                scrollBeyondLastLine: false, padding: { top: 8 },
                scrollbar: { verticalScrollbarSize: 4 }
              }}
            />
            {/* Debug line CSS */}
            <style>{`
              .debug-line-highlight { background: rgba(249, 226, 175, 0.15) !important; }
              .debug-line-gutter::before { content: '▶'; color: #f9e2af; font-size: 10px; }
            `}</style>
          </div>
        </div>

        {/* Right: Debug panel */}
        <div className="flex flex-col" style={{ flex: '0 0 50%' }}>
          {snapshots.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <span style={{ fontSize: 48 }}>⏱</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Time-Travel Debugger</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click <strong>▶ Run & Capture</strong> to execute your code and capture state at every line.
                Then use the timeline to travel back in time and inspect variables.
              </p>
              <div className="text-xs p-3 rounded-lg text-left w-full" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }}>
                <p>⌨️ <strong>←→</strong> Arrow keys to step</p>
                <p>🔍 Variables panel shows state at each step</p>
                <p>📤 Output panel shows console.log calls</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <span style={{ fontSize: 40 }}>💥</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>Runtime Error</p>
              <pre className="text-xs p-3 rounded-lg w-full overflow-auto"
                style={{ background: 'var(--bg-crust)', color: 'var(--accent-red)', fontFamily: 'monospace' }}>
                {error}
              </pre>
              <button onClick={runDebug}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)' }}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Timeline */}
              <div className="px-4 py-3 flex-shrink-0"
                style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    TIMELINE
                  </span>
                  <span className="text-xs" style={{ color: 'var(--accent-mauve)' }}>
                    Step {currentStep + 1} / {snapshots.length} — Line {current?.line ?? '?'}
                  </span>
                </div>
                <input type="range" min={0} max={snapshots.length - 1} value={currentStep}
                  onChange={e => goTo(+e.target.value)}
                  className="w-full" style={{ accentColor: 'var(--accent-mauve)' }} />
                <div className="flex items-center justify-between mt-2 gap-2">
                  <button onClick={() => goTo(0)}
                    className="flex-1 py-1 rounded text-xs"
                    style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }}
                    title="Jump to start">
                    ⏮ Start
                  </button>
                  <button onClick={prev} disabled={currentStep === 0}
                    className="flex-1 py-1 rounded text-xs font-medium"
                    style={{ background: 'var(--bg-surface0)', color: currentStep === 0 ? 'var(--text-subtle)' : 'var(--text)' }}>
                    ◀ Prev
                  </button>
                  <button onClick={next} disabled={currentStep === snapshots.length - 1}
                    className="flex-1 py-1 rounded text-xs font-medium"
                    style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)' }}>
                    Next ▶
                  </button>
                  <button onClick={() => goTo(snapshots.length - 1)}
                    className="flex-1 py-1 rounded text-xs"
                    style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }}
                    title="Jump to end">
                    End ⏭
                  </button>
                </div>
              </div>

              {/* Variables */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Variables at Step {currentStep + 1}
                  </p>
                  {current && Object.keys(current.vars).length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {Object.entries(current.vars).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
                          <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--accent-mauve)', fontFamily: 'monospace' }}>{k}</span>
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>=</span>
                          <span className="text-xs flex-1 break-all" style={{
                            color: v === null ? 'var(--text-subtle)'
                              : typeof v === 'number' ? 'var(--accent-peach)'
                              : typeof v === 'string' ? 'var(--accent-green)'
                              : typeof v === 'boolean' ? 'var(--accent-mauve)'
                              : 'var(--text)',
                            fontFamily: 'monospace'
                          }}>
                            {v === undefined ? 'undefined' : v === null ? 'null' : JSON.stringify(v)}
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
                            {v === null ? 'null' : typeof v}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>No variables declared yet</p>
                  )}
                </div>

                {/* Console output up to this step */}
                {current?.output && current.output.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Console Output (up to this step)
                    </p>
                    <div className="p-2 rounded-lg" style={{ background: 'var(--bg-crust)', fontFamily: 'monospace' }}>
                      {current.output.map((line, i) => (
                        <div key={i} className="text-xs" style={{ color: 'var(--accent-green)' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden sandbox iframe */}
      <iframe ref={iframeRef} sandbox="allow-scripts" style={{ display: 'none', width: 0, height: 0 }} title="debug-sandbox" />
    </div>
  )
}

function Empty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <span style={{ fontSize: 48 }}>{icon}</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  )
}
