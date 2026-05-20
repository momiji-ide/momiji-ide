import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { getRunConfig } from '../../utils/codeRunner'
import { startVoiceRecognition, processVoiceCommand } from '../../utils/voiceToCode'
import { toast } from '../../utils/toast'
import { VoiceCommandInput } from './VoiceCommandInput'

export function EditorToolbar() {
  const { tabs, activeTabId, currentFolder, showBottomPanel, toggleBottomPanel, updateTabContent, splitTabId, setSplitTabId, settings } = useAppStore()
  const [isRunning, setIsRunning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showVoiceInput, setShowVoiceInput] = useState(false)
  const [showArgs, setShowArgs] = useState(false)
  const [runArgs, setRunArgs] = useState('')
  const stopVoiceRef = useRef<(() => void) | null>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Load saved args when active tab changes
  useEffect(() => {
    if (activeTab) {
      const saved = localStorage.getItem(`momiji:run-args:${activeTab.filePath}`) ?? ''
      setRunArgs(saved)
    } else {
      setRunArgs('')
    }
  }, [activeTab?.filePath])

  const runConfig = activeTab ? getRunConfig(activeTab.filePath, activeTab.language, settings.pythonPath ?? 'python') : null
  const isHtml = activeTab?.language === 'html' || activeTab?.language === 'css'

  const handleRun = useCallback(async () => {
    if (!activeTab || isRunning || !runConfig) return

    // Compute cwd FIRST before anything else
    const filePath = activeTab.filePath
    const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
    const fileDir = lastSlash > 0 ? filePath.substring(0, lastSlash) : currentFolder ?? ''
    const cwd = fileDir || currentFolder || ''

    // Open bottom panel + switch to output
    if (!showBottomPanel) toggleBottomPanel()
    window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'output' } }))

    // Dispatch run info (cwd is now defined)
    window.dispatchEvent(new CustomEvent('runner:start', {
      detail: {
        processId: 'runner-main',
        command:   runConfig.command,
        args:      runConfig.args,
        cwd,
        label:     runConfig.label,
        fileName:  activeTab.fileName
      }
    }))

    setIsRunning(true)

    // Save file before running
    if (activeTab.isDirty && !filePath.startsWith('__')) {
      await window.api.fs.writeFile(filePath, activeTab.content)
    }

    // Merge extra run args from user input
    const extraArgs = runArgs.trim() ? runArgs.trim().split(/\s+/) : []
    await window.api.process.run('runner-main', runConfig.command, [...runConfig.args, ...extraArgs], cwd)

    // onExit handler in OutputPanel handles setIsRunning(false)
    const unsub = window.api.process.onExit((id, code) => {
      if (id === 'runner-main') {
        setIsRunning(false)
        window.dispatchEvent(new CustomEvent('runner:exit', { detail: { code } }))
        unsub()
      }
    })
  }, [activeTab, isRunning, showBottomPanel, toggleBottomPanel, currentFolder, runConfig])

  const handlePreview = useCallback(() => {
    if (!showBottomPanel) toggleBottomPanel()
    window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'preview' } }))
  }, [showBottomPanel, toggleBottomPanel])

  const handleStopRun = () => {
    window.api.process.kill('runner-main')
    setIsRunning(false)
  }

  if (!activeTab) return null

  return (
    <div className="flex flex-col flex-shrink-0"
      style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
    <div className="flex items-center gap-2 px-3 py-1" style={{ height: '34px' }}>
      {/* File path breadcrumb */}
      <div className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
        {activeTab.filePath.split(/[\\/]/).slice(-3).map((part, i, arr) => (
          <span key={i} className="flex items-center gap-1">
            {i < arr.length - 1 ? (
              <span className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{part}</span>
            ) : (
              <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{part}</span>
            )}
            {i < arr.length - 1 && <span style={{ color: 'var(--text-subtle)' }}>›</span>}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Voice Command text input popup */}
        {showVoiceInput && activeTab && (
          <VoiceCommandInput
            language={activeTab.language}
            onInsert={(code, desc) => {
              const newContent = activeTab.content + (activeTab.content.endsWith('\n') ? '' : '\n') + code
              updateTabContent(activeTab.id, newContent)
              toast.success(`🎙️ ${desc}`)
              setShowVoiceInput(false)
            }}
            onClose={() => setShowVoiceInput(false)}
          />
        )}

        {/* Voice-to-Code button */}
        <button
          onClick={() => {
            if (isListening) {
              stopVoiceRef.current?.()
              setIsListening(false)
              return
            }

            const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (!SR) {
              setShowVoiceInput(true)
              return
            }

            setIsListening(true)
            toast.info('🎙️ Listening... speak a command in English')

            const stop = startVoiceRecognition(
              (transcript) => {
                if (!activeTab) return
                const result = processVoiceCommand(transcript, activeTab.language)
                const newContent = activeTab.content + (activeTab.content.endsWith('\n') ? '' : '\n') + result.code
                updateTabContent(activeTab.id, newContent)
                toast.success(`🎙️ "${transcript}" → ${result.description}`)
              },
              () => { setIsListening(false) },
              (error) => {
                if (error === 'network' || error === 'not-allowed' || error === 'audio-capture') {
                  // Fallback to text mode
                  setShowVoiceInput(true)
                  if (error === 'network') toast.info('🎙️ Voice API unavailable — use text command mode instead')
                  else if (error === 'not-allowed') toast.warning('🎙️ Mic permission denied — use text command mode instead')
                  else if (error === 'audio-capture') toast.warning('🎙️ No microphone found — use text command mode instead')
                } else if (error === 'no-speech') {
                  toast.warning('🎙️ No speech detected. Try again or use text mode (⌨️ button).')
                } else if (error !== 'aborted') {
                  toast.warning(`🎙️ Voice error: ${error}. Try text mode.`)
                  setShowVoiceInput(true)
                }
              }
            )
            stopVoiceRef.current = stop
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
          title="Voice-to-Code (speak to insert code)"
          style={{
            background: isListening ? 'var(--accent-red)' : 'var(--bg-surface0)',
            color: isListening ? 'white' : 'var(--text-muted)',
            border: `1px solid ${isListening ? 'var(--accent-red)' : 'var(--border)'}`,
            animation: isListening ? 'pulse 1s infinite' : 'none'
          }}>
          {isListening ? '🔴' : '🎙️'}
        </button>

        {/* Split editor button */}
        <button
          onClick={() => setSplitTabId(splitTabId ? null : (activeTabId ?? null))}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
          title={splitTabId ? 'Close split view' : 'Split editor'}
          style={{
            background: splitTabId ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
            color: splitTabId ? 'white' : 'var(--text-muted)',
            border: `1px solid ${splitTabId ? 'var(--accent-mauve)' : 'var(--border)'}`
          }}>
          ⫴
        </button>

        {/* Git Blame toggle */}
        {activeTab && !activeTab.filePath.startsWith('__') && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:toggleBlame'))}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
            title="Toggle Git Blame"
            id="blame-btn"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-green)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-green)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
            🔍 Blame
          </button>
        )}

        {/* Kitsune Review button */}
        {activeTab && !activeTab.filePath.startsWith('__') && (
          <button
            onClick={() => {
              const code = activeTab.content
              if (!code.trim()) { toast.warning('Nothing to review!'); return }
              const prompt = `Please review this ${activeTab.language} code using the Mentor Mode format:

\`\`\`${activeTab.language}
${code.slice(0, 6000)}
\`\`\`

Respond with this exact JSON structure:
{
  "score": { "quality": "X/10", "style": "X/10" },
  "praise": ["what was done well 1", "what was done well 2"],
  "tips": [{ "line": 0, "head": "tip title", "body": "explanation" }],
  "challenge": "One specific thing to improve next"
}

Be encouraging first, then constructive. Adapt tone to the active persona.`
              window.dispatchEvent(new CustomEvent('kitsune:askWithPrompt', { detail: { prompt } }))
              toast.info('🦊 Kitsune is reviewing your code…')
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
            style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-mauve)22' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface0)' }}
            title="Ask Kitsune to review this file (Mentor Mode)">
            🦊 Review
          </button>
        )}

        {/* HTML Preview button */}
        {isHtml && (
          <button
            onClick={handlePreview}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
            style={{ background: 'var(--accent-sapphire)', color: 'var(--bg-base)' }}
          >
            🌐 Preview
          </button>
        )}

        {/* Run button group */}
        {runConfig && (
          <div className="flex items-center gap-0.5">
            {isRunning ? (
              <button onClick={handleStopRun}
                className="flex items-center gap-1 px-3 py-1 rounded-l text-xs font-medium"
                style={{ background: 'var(--accent-red)', color: 'white' }}>
                ■ Stop
              </button>
            ) : (
              <button onClick={handleRun}
                className="flex items-center gap-1.5 px-3 py-1 rounded-l text-xs font-medium transition-all"
                style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}
                title={`Run with ${runConfig.label}${runArgs ? ' — args: ' + runArgs : ''}`}>
                ▶ Run
                <span className="opacity-70">({runConfig.label})</span>
                {runArgs && <span className="opacity-60 max-w-16 truncate">{runArgs}</span>}
              </button>
            )}
            {/* Args toggle */}
            <button
              onClick={() => setShowArgs(v => !v)}
              className="flex items-center justify-center px-1.5 py-1 rounded-r text-xs transition-all"
              title="Run arguments"
              style={{
                background: showArgs || runArgs ? 'var(--accent-yellow)' : 'var(--bg-surface0)',
                color: showArgs || runArgs ? 'var(--bg-base)' : 'var(--text-muted)',
                borderLeft: '1px solid rgba(0,0,0,0.15)'
              }}>
              ⚙
            </button>
          </div>
        )}
      </div>

      {/* Args input row */}
      </div>{/* end inner toolbar row */}

      {showArgs && runConfig && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-crust)' }}>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
            Args:
          </span>
          <input
            value={runArgs}
            onChange={e => {
              setRunArgs(e.target.value)
              const key = `momiji:run-args:${activeTab.filePath}`
              if (e.target.value) localStorage.setItem(key, e.target.value)
              else localStorage.removeItem(key)
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleRun() }}
            placeholder={`e.g. --input file.csv --verbose  (Enter to run)`}
            className="flex-1 px-2 py-0.5 rounded text-xs outline-none font-mono"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
            autoFocus
          />
          {runArgs && (
            <button onClick={() => {
              setRunArgs('')
              localStorage.removeItem(`momiji:run-args:${activeTab.filePath}`)
            }}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: 'var(--accent-red)', border: '1px solid var(--border)' }}>
              ✕ Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
