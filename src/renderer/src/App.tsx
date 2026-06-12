import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { TitleBar } from './components/TitleBar/TitleBar'
import { ActivityBar } from './components/ActivityBar/ActivityBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TabBar } from './components/Editor/TabBar'
import { EditorToolbar } from './components/Editor/EditorToolbar'
import { CodeEditor } from './components/Editor/CodeEditor'
import { StatusBar } from './components/StatusBar/StatusBar'
import { BottomPanel } from './components/BottomPanel/BottomPanel'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { ToastSystem } from './components/Toast/ToastSystem'
import { toast } from './utils/toast'
import { MenuBar } from './components/MenuBar/MenuBar'
import { OnboardingWizard } from './components/Onboarding/OnboardingWizard'
import { AboutDialog } from './components/About/AboutDialog'
import { CanvasPlayground } from './components/Playground/CanvasPlayground'
import { CreativeHub } from './components/Playground/CreativeHub'
import { CodeScreenshot } from './components/Editor/CodeScreenshot'
import { RegexPlayground } from './components/Playground/RegexPlayground'
import { AIPanel } from './components/AI/AIPanel'

export default function App() {
  const { settings, showBottomPanel, showSecondarySidebar, bottomPanelHeight, activePanel, setActivePanel, setPendingAIPrompt, restoreLastFolder } = useAppStore()

  // ── Auto-restore last folder on startup ──────────────────────────────────
  useEffect(() => {
    restoreLastFolder()
  }, []) // eslint-disable-line

  // ── Global handler for right-click "Ask Kitsune" — always mounted ──────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { prompt } = (e as CustomEvent).detail as { prompt: string }
      if (!prompt) return
      setActivePanel('ai')         // open sidebar to AI panel (sets showSidebar:true)
      setPendingAIPrompt(prompt)   // AIPanel picks this up when it mounts
    }
    window.addEventListener('kitsune:askWithPrompt', handler)
    return () => window.removeEventListener('kitsune:askWithPrompt', handler)
  }, [setActivePanel, setPendingAIPrompt])
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('momiji:onboarding-done')
  })
  const [showAbout, setShowAbout] = useState(false)
  const [showPlayground, setShowPlayground] = useState(false)
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [showRegex, setShowRegex] = useState(false)

  // Apply theme on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : '')
  }, [settings.theme])

  // Apply UI zoom via webFrame (scales everything — fonts, icons, layout)
  useEffect(() => {
    const factor = settings.uiZoom ?? 1.15
    window.api.zoom?.setFactor(factor)
  }, [settings.uiZoom])

  // Apply zoom on first mount
  useEffect(() => {
    window.api.zoom?.setFactor(settings.uiZoom ?? 1.15)
  }, []) // eslint-disable-line

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'p' && !e.shiftKey) { e.preventDefault(); setCmdPaletteOpen(true) }
      if (ctrl && e.key === '`') { e.preventDefault(); useAppStore.getState().toggleBottomPanel() }
      if (ctrl && e.key === 'b') { e.preventDefault(); useAppStore.getState().toggleSidebar() }
      if (ctrl && e.shiftKey && e.key === 'D') { e.preventDefault(); useAppStore.getState().setActivePanel('debug') }
      if (ctrl && e.shiftKey && e.key === 'P') { e.preventDefault(); setShowPlayground(true) }
      if (ctrl && e.shiftKey && e.key === 'X') { e.preventDefault(); setShowScreenshot(true) }
      if (ctrl && e.shiftKey && e.key === 'R') { e.preventDefault(); setShowRegex(true) }
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        const { tabs, activeTabId, markTabClean } = useAppStore.getState()
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab && tab.isDirty && !tab.filePath.startsWith('__')) {
          window.api.fs.writeFile(tab.filePath, tab.content).then(r => {
            if (r.success) markTabClean(tab.id)
          })
        }
      }
      if (ctrl && e.key === 'S' && e.shiftKey) {
        e.preventDefault()
        const { tabs, markTabClean } = useAppStore.getState()
        tabs.filter(t => t.isDirty && !t.filePath.startsWith('__')).forEach(async tab => {
          const r = await window.api.fs.writeFile(tab.filePath, tab.content)
          if (r.success) markTabClean(tab.id)
        })
      }
      if (ctrl && e.key === 'w') {
        e.preventDefault()
        const { tabs, activeTabId, closeTab } = useAppStore.getState()
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab) closeTab(tab.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Bottom panel tab switch from EditorToolbar
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      window.dispatchEvent(new CustomEvent('_bottomPanel:switchTab', { detail: e.detail }))
    }
    window.addEventListener('bottomPanel:switchTab', handler as EventListener)
    return () => window.removeEventListener('bottomPanel:switchTab', handler as EventListener)
  }, [])

  const closeCmdPalette = useCallback(() => setCmdPaletteOpen(false), [])

  // Listen for about dialog trigger from MenuBar
  useEffect(() => {
    const handler = () => setShowAbout(true)
    window.addEventListener('app:showAbout', handler)
    return () => window.removeEventListener('app:showAbout', handler)
  }, [])

  // Listen for Canvas Playground trigger
  useEffect(() => {
    const handler = () => setShowPlayground(true)
    window.addEventListener('app:openPlayground', handler)
    return () => window.removeEventListener('app:openPlayground', handler)
  }, [])

  // Listen for Code Screenshot trigger
  useEffect(() => {
    const h = () => setShowScreenshot(true)
    window.addEventListener('app:screenshot', h)
    return () => window.removeEventListener('app:screenshot', h)
  }, [])

  // Listen for Regex Playground trigger
  useEffect(() => {
    const h = () => setShowRegex(true)
    window.addEventListener('app:regex', h)
    return () => window.removeEventListener('app:regex', h)
  }, [])

  // Auto-update notifications
  useEffect(() => {
    const unsub = (window.api as any).updater?.onStatus?.((status: string, info?: string) => {
      if (status === 'available') {
        toast.info(`🆕 Update v${info ?? 'new'} available — downloading in background...`)
      } else if (status === 'downloaded') {
        toast.success('✅ Update downloaded! Restart to apply.', 8000)
      }
    })
    return () => unsub?.()
  }, [])

  const isFullPanel = ['blocks', 'flow', 'debug', 'http', 'den'].includes(activePanel)

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Title Bar */}
      <TitleBar onCommandPalette={() => setCmdPaletteOpen(true)} />

      {/* Menu Bar */}
      <MenuBar />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar (contains BlockEditor when blocks mode) */}
        <Sidebar />

        {/* Editor area — hidden when full-screen panels are active */}
        {!isFullPanel && (
          <>
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <TabBar />
              <EditorToolbar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <CodeEditor />
                </div>
                {showBottomPanel && <BottomPanel height={bottomPanelHeight} />}
              </div>
            </div>
            {/* Secondary Right Sidebar — displays AIPanel (Kitsune Chat) */}
            {showSecondarySidebar && (
              <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: 300, background: 'var(--bg-mantle)', borderLeft: '1px solid var(--border)' }}>
                <AIPanel />
              </div>
            )}
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar onCommandPalette={() => setCmdPaletteOpen(true)} />

      {/* Overlays */}
      <CommandPalette open={cmdPaletteOpen} onClose={closeCmdPalette} />
      <ToastSystem />

      {/* About dialog */}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {/* Canvas Playground */}
      {showPlayground && <CreativeHub onClose={() => setShowPlayground(false)} />}

      {/* Code Screenshot */}
      {showScreenshot && <CodeScreenshot onClose={() => setShowScreenshot(false)} />}

      {/* Regex Playground */}
      {showRegex && <RegexPlayground onClose={() => setShowRegex(false)} />}

      {/* Onboarding — first launch only */}
      {showOnboarding && (
        <OnboardingWizard onComplete={() => {
          localStorage.setItem('momiji:onboarding-done', '1')
          setShowOnboarding(false)
        }} />
      )}
    </div>
  )
}
