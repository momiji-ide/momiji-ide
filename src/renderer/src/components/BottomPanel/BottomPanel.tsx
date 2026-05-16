import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { TerminalPanel } from './TerminalPanel'
import { OutputPanel } from './OutputPanel'
import { LivePreview } from './LivePreview'

type BottomTab = 'terminal' | 'output' | 'preview'

interface BottomPanelProps {
  height: number
}

export function BottomPanel({ height }: BottomPanelProps) {
  const { setBottomPanelHeight, toggleBottomPanel, currentFolder } = useAppStore()
  const [activeTab, setActiveTab] = useState<BottomTab>('terminal')
  const [outputRunning, setOutputRunning] = useState(false)
  const isResizing = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  // Listen for external tab switch requests
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const tab = e.detail?.tab as BottomTab
      if (tab) setActiveTab(tab)
    }
    window.addEventListener('bottomPanel:switchTab', handler as EventListener)
    window.addEventListener('_bottomPanel:switchTab', handler as EventListener)
    return () => {
      window.removeEventListener('bottomPanel:switchTab', handler as EventListener)
      window.removeEventListener('_bottomPanel:switchTab', handler as EventListener)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true
    startY.current = e.clientY
    startH.current = height
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      setBottomPanelHeight(Math.max(120, Math.min(600, startH.current + (startY.current - e.clientY))))
    }
    const onUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const tabs: { id: BottomTab; label: string; badge?: boolean }[] = [
    { id: 'terminal', label: '⚡ Terminal' },
    { id: 'output', label: '▶ Output', badge: outputRunning },
    { id: 'preview', label: '🌐 Preview' }
  ]

  return (
    <div style={{ height, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)' }}>
      {/* Resize handle */}
      <div className="h-1 cursor-row-resize w-full flex-shrink-0 transition-colors"
        style={{ background: 'transparent' }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-blue)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} />

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', height: '32px' }}>
        <div className="flex items-center flex-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 h-full text-xs transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                background: 'transparent'
              }}>
              {tab.label}
              {tab.badge && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-yellow)' }} />}
            </button>
          ))}
        </div>
        <button onClick={toggleBottomPanel}
          className="px-3 h-full text-xs flex items-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
          ✕
        </button>
      </div>

      {/* Panel content — keep all mounted to preserve state */}
      <div className="flex-1 overflow-hidden">
        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TerminalPanel processId="terminal-main" cwd={currentFolder ?? undefined} />
        </div>
        <div style={{ display: activeTab === 'output' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <OutputPanel processId="runner-main" onRunningChange={setOutputRunning} />
        </div>
        <div style={{ display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <LivePreview />
        </div>
      </div>
    </div>
  )
}
