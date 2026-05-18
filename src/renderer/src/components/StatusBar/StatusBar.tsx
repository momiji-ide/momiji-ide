import { useAppStore } from '../../store/appStore'
import { MomijiLogo } from '../Logo/MomijiLogo'
import { useState, useEffect, useCallback } from 'react'
import { PythonPicker } from './PythonPicker'

interface Props { onCommandPalette: () => void }

export function StatusBar({ onCommandPalette }: Props) {
  const { tabs, activeTabId, settings, toggleBottomPanel, showBottomPanel } = useAppStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [showPythonPicker, setShowPythonPicker] = useState(false)
  const [pythonVersion, setPythonVersion] = useState<string | null>(null)
  const [kitsuneInline, setKitsuneInline] = useState(true)

  useEffect(() => {
    const handler = (e: CustomEvent) => setCursor(e.detail)
    window.addEventListener('editor:cursor', handler as EventListener)
    return () => window.removeEventListener('editor:cursor', handler as EventListener)
  }, [])

  // Detect active Python version for display
  useEffect(() => {
    if (activeTab?.language !== 'python') { setPythonVersion(null); return }
    ;(window.api as any).python.detect().then((list: { path: string; version: string; type: string }[]) => {
      const match = list.find(i => i.path === settings.pythonPath)
      setPythonVersion(match ? match.version : null)
    }).catch(() => setPythonVersion(null))
  }, [activeTab?.language, settings.pythonPath])

  const handleTerminal = useCallback(() => {
    toggleBottomPanel()
    if (!showBottomPanel) {
      setTimeout(() => window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'terminal' } })), 50)
    }
  }, [toggleBottomPanel, showBottomPanel])

  const isPython = activeTab?.language === 'python'

  return (
    <>
      <div
        className="flex items-center justify-between px-2 h-6 text-xs flex-shrink-0 select-none"
        style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}
      >
        {/* Left */}
        <div className="flex items-center gap-0.5">
          <StatusBtn onClick={() => {}} title="Momiji IDE">
            <MomijiLogo size={12} />
            <span className="font-bold tracking-widest" style={{ letterSpacing: '0.1em' }}>MOMIJI</span>
          </StatusBtn>

          {activeTab && (
            <>
              <span className="opacity-40 mx-0.5">|</span>
              <StatusBtn onClick={() => {}} title="Language">
                {activeTab.language}
              </StatusBtn>
              {activeTab.isDirty && (
                <StatusBtn onClick={() => {}} title="Unsaved changes">
                  ● unsaved
                </StatusBtn>
              )}
            </>
          )}

          {/* Python interpreter indicator */}
          {isPython && (
            <>
              <span className="opacity-40 mx-0.5">|</span>
              <StatusBtn
                onClick={() => setShowPythonPicker(v => !v)}
                title="Python interpreter — click to change">
                🐍 {pythonVersion
                  ? `Python ${pythonVersion}`
                  : (settings.pythonPath ?? 'python') === 'python' || (settings.pythonPath ?? 'python') === 'python3'
                    ? (settings.pythonPath ?? 'python')
                    : (settings.pythonPath ?? 'python').split(/[\\/]/).pop()}
              </StatusBtn>
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-0.5">
          <StatusBtn onClick={onCommandPalette} title="Command Palette (Ctrl+P)">
            🔍 Ctrl+P
          </StatusBtn>
          {activeTab && (
            <StatusBtn onClick={() => {}} title="Font size">
              {settings.fontSize}px
            </StatusBtn>
          )}
          <StatusBtn onClick={() => {}} title="Tab size">
            Tab: {settings.tabSize}
          </StatusBtn>
          <StatusBtn onClick={() => {}} title="Encoding">
            UTF-8
          </StatusBtn>
          {activeTab && (
            <StatusBtn onClick={() => {}} title="Cursor position">
              Ln {cursor.line}, Col {cursor.col}
            </StatusBtn>
          )}
          <StatusBtn
            onClick={() => {
              setKitsuneInline(v => !v)
              window.dispatchEvent(new CustomEvent('kitsune:toggleInline'))
            }}
            title={kitsuneInline ? 'Kitsune AI Inline — ON (click to disable)' : 'Kitsune AI Inline — OFF (click to enable)'}
          >
            🦊 {kitsuneInline ? 'AI ✓' : 'AI ✗'}
          </StatusBtn>
          <StatusBtn onClick={handleTerminal} title="Toggle Terminal (Ctrl+`)">
            ⚡ Terminal
          </StatusBtn>
        </div>
      </div>

      {/* Python picker popup */}
      {showPythonPicker && (
        <PythonPicker onClose={() => setShowPythonPicker(false)} />
      )}
    </>
  )
}

function StatusBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 px-2 h-6 rounded transition-colors"
      style={{ color: 'var(--bg-base)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.15)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      {children}
    </button>
  )
}
