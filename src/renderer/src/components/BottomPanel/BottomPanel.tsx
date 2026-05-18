import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { TerminalPanel }    from './TerminalPanel'
import { OutputPanel }      from './OutputPanel'
import { LivePreview }      from './LivePreview'
import { NpmScriptsPanel }  from './NpmScriptsPanel'
import { ProblemsPanel }    from './ProblemsPanel'

type BottomTab = 'terminal' | 'output' | 'problems' | 'scripts' | 'preview'

interface BottomPanelProps { height: number }

export function BottomPanel({ height }: BottomPanelProps) {
  const { setBottomPanelHeight, toggleBottomPanel } = useAppStore()
  const [activeTab,     setActiveTab]     = useState<BottomTab>('terminal')
  const [outputRunning, setOutputRunning] = useState(false)
  const [errorCount,    setErrorCount]    = useState(0)
  const isResizing = useRef(false)
  const startY     = useRef(0)
  const startH     = useRef(0)

  // External tab-switch requests (e.g. from status bar)
  useEffect(() => {
    const handler = (e: CustomEvent) => { if (e.detail?.tab) setActiveTab(e.detail.tab) }
    window.addEventListener('bottomPanel:switchTab', handler as EventListener)
    return () => window.removeEventListener('bottomPanel:switchTab', handler as EventListener)
  }, [])

  // Track error count from Problems panel for badge
  useEffect(() => {
    const handler = (e: Event) => {
      const items = (e as CustomEvent).detail ?? []
      setErrorCount(items.filter((m: any) => m.severity === 8).length)
    }
    window.addEventListener('editor:markers', handler)
    return () => window.removeEventListener('editor:markers', handler)
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

  const tabs: { id: BottomTab; label: string; badge?: number | boolean }[] = [
    { id: 'terminal',  label: '⚡ Terminal' },
    { id: 'scripts',   label: '▶ Scripts' },
    { id: 'problems',  label: '⚠ Problems', badge: errorCount > 0 ? errorCount : undefined },
    { id: 'output',    label: '📋 Output',  badge: outputRunning },
    { id: 'preview',   label: '🌐 Preview' },
  ]

  return (
    <div style={{ height, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)' }}>

      {/* Resize handle */}
      <div className="h-1 cursor-row-resize w-full flex-shrink-0 transition-colors"
        style={{ background: 'transparent' }}
        onMouseDown={handleMouseDown}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-blue)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', height: 32 }}>
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 h-full text-xs whitespace-nowrap transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                background: 'transparent', cursor: 'pointer',
              }}>
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="px-1 rounded text-xs font-bold" style={{ background: 'var(--accent-red)', color: 'white', fontSize: 9 }}>{tab.badge}</span>
              )}
              {tab.badge === true && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-yellow)' }} />
              )}
            </button>
          ))}
        </div>
        <button onClick={toggleBottomPanel}
          className="px-3 h-full text-xs flex items-center"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          ✕
        </button>
      </div>

      {/* Panel content — keep all mounted to preserve state */}
      <div className="flex-1 overflow-hidden">
        <div style={{ display: activeTab === 'terminal'  ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TerminalPanel />
        </div>
        <div style={{ display: activeTab === 'scripts'   ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <NpmScriptsPanel />
        </div>
        <div style={{ display: activeTab === 'problems'  ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <ProblemsPanel />
        </div>
        <div style={{ display: activeTab === 'output'    ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <OutputPanel processId="runner-main" onRunningChange={setOutputRunning} />
        </div>
        <div style={{ display: activeTab === 'preview'   ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <LivePreview />
        </div>
      </div>
    </div>
  )
}
