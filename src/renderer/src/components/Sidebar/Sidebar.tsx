import { useRef, useCallback, lazy, Suspense } from 'react'
import { useAppStore } from '../../store/appStore'
import { FileExplorer }   from './FileExplorer'
import { SettingsPanel }  from '../Settings/SettingsPanel'
import { SearchPanel }    from '../Search/SearchPanel'
import { AIPanel }        from '../AI/AIPanel'
import { GitPanel }       from '../Git/GitPanel'
import { TodoPanel }      from '../Todo/TodoPanel'
import { OutlinePanel }   from '../Outline/OutlinePanel'

// Heavy panels — lazy loaded on first access
const BlockEditor     = lazy(() => import('../BlockEditor/BlockEditor').then(m => ({ default: m.BlockEditor })))
const FlowEditor      = lazy(() => import('../FlowEditor/FlowEditor').then(m => ({ default: m.FlowEditor })))
const TimeTravelDebugger = lazy(() => import('../Debugger/TimeTravelDebugger').then(m => ({ default: m.TimeTravelDebugger })))
const HttpClient      = lazy(() => import('../HttpClient/HttpClient').then(m => ({ default: m.HttpClient })))
const PackageManager  = lazy(() => import('../PackageManager/PackageManager').then(m => ({ default: m.PackageManager })))
const ProjectScaffold = lazy(() => import('../Scaffold/ProjectScaffold').then(m => ({ default: m.ProjectScaffold })))
const SQLitePanel     = lazy(() => import('../Database/SQLitePanel').then(m => ({ default: m.SQLitePanel })))
const ExtensionsPanel = lazy(() => import('../Extensions/ExtensionsPanel').then(m => ({ default: m.ExtensionsPanel })))
const SnippetManager  = lazy(() => import('../Snippets/SnippetManager').then(m => ({ default: m.SnippetManager })))
const TemplateGallery = lazy(() => import('../Templates/TemplateGallery').then(m => ({ default: m.TemplateGallery })))

function PanelLoader() {
  return (
    <div className="flex items-center justify-center h-full gap-2"
      style={{ color: 'var(--text-subtle)' }}>
      <div className="w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent-mauve)', borderTopColor: 'transparent' }} />
      <span className="text-xs">Loading…</span>
    </div>
  )
}

const FULL_WIDTH_PANELS = new Set(['blocks', 'flow', 'debug', 'http'])

export function Sidebar() {
  const { activePanel, showSidebar, sidebarWidth, setSidebarWidth } = useAppStore()
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      setSidebarWidth(Math.max(160, Math.min(500, startWidth.current + e.clientX - startX.current)))
    }
    const onUp = () => { isResizing.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth, setSidebarWidth])

  if (!showSidebar) return null

  // Full-width panels (take entire editor area)
  if (FULL_WIDTH_PANELS.has(activePanel)) {
    const fullPanels: Record<string, React.ReactNode> = {
      blocks: <Suspense fallback={<PanelLoader />}><BlockEditor /></Suspense>,
      flow:   <Suspense fallback={<PanelLoader />}><FlowEditor /></Suspense>,
      debug:  <Suspense fallback={<PanelLoader />}><TimeTravelDebugger /></Suspense>,
      http:   <Suspense fallback={<PanelLoader />}><HttpClient /></Suspense>,
    }
    return (
      <div className="flex flex-col flex-1 overflow-hidden"
        style={{ background: 'var(--bg-mantle)', borderRight: '1px solid var(--border)' }}>
        {fullPanels[activePanel]}
      </div>
    )
  }

  const panels: Record<string, React.ReactNode> = {
    explorer:   <FileExplorer />,
    ai:         <AIPanel />,
    settings:   <SettingsPanel />,
    search:     <SearchPanel />,
    git:        <GitPanel />,
    todo:       <TodoPanel />,
    outline:    <OutlinePanel />,
    snippets:   <Suspense fallback={<PanelLoader />}><SnippetManager /></Suspense>,
    templates:  <Suspense fallback={<PanelLoader />}><TemplateGallery /></Suspense>,
    packages:   <Suspense fallback={<PanelLoader />}><PackageManager /></Suspense>,
    scaffold:   <Suspense fallback={<PanelLoader />}><ProjectScaffold /></Suspense>,
    database:   <Suspense fallback={<PanelLoader />}><SQLitePanel /></Suspense>,
    extensions: <Suspense fallback={<PanelLoader />}><ExtensionsPanel /></Suspense>,
  }

  return (
    <div className="flex flex-shrink-0" style={{ width: sidebarWidth }}>
      <div className="flex-1 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-mantle)', borderRight: '1px solid var(--border)' }}>
        {panels[activePanel] ?? null}
      </div>
      <div className="w-1 cursor-col-resize flex-shrink-0 transition-colors"
        style={{ background: 'transparent' }}
        onMouseDown={handleMouseDown}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-mauve)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
    </div>
  )
}

