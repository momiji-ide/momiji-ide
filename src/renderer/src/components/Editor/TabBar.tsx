import { useRef, useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { FileIcon } from '../Sidebar/FileIcon'

interface CtxMenu { x: number; y: number; tabId: string }

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeAllTabs, setSplitTabId } = useAppStore()
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [ctx])

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY
  }

  const closeOthers = useCallback((tabId: string) => {
    tabs.filter(t => t.id !== tabId).forEach(t => closeTab(t.id))
    setActiveTab(tabId)
  }, [tabs, closeTab, setActiveTab])

  const closeToRight = useCallback((tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId)
    tabs.slice(idx + 1).forEach(t => closeTab(t.id))
  }, [tabs, closeTab])

  const closeSaved = useCallback(() => {
    tabs.filter(t => !t.isDirty).forEach(t => closeTab(t.id))
  }, [tabs, closeTab])

  const copyPath = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab) navigator.clipboard.writeText(tab.filePath)
  }, [tabs])

  const revealInExplorer = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab && !tab.filePath.startsWith('__')) {
      // Open folder containing the file
      const dir = tab.filePath.replace(/[\\/][^\\/]+$/, '')
      const { setCurrentFolder, setFileTree } = useAppStore.getState()
      window.api.fs.readDir(dir).then(tree => {
        if (tree) { setCurrentFolder(dir); setFileTree(tree) }
      })
      useAppStore.getState().setActivePanel('explorer')
    }
  }, [tabs])

  if (tabs.length === 0) return null

  const ctxTab = ctx ? tabs.find(t => t.id === ctx.tabId) : null

  return (
    <>
      <div ref={scrollRef} onWheel={handleWheel}
        className="flex items-end overflow-x-auto overflow-y-hidden flex-shrink-0 gap-px"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '36px', scrollbarWidth: 'none' }}>

        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id}
              className="flex items-center gap-1.5 px-3 h-full cursor-pointer flex-shrink-0 group transition-colors relative"
              style={{
                background: isActive ? 'var(--bg-base)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                borderTop: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                borderRight: '1px solid var(--border)',
                maxWidth: 200, minWidth: 80
              }}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCtx({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface0)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>

              <FileIcon name={tab.fileName} size={13} />

              <span className="text-xs truncate flex-1 min-w-0">
                {tab.fileName}
              </span>

              {tab.isDirty
                ? <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs rounded"
                    style={{ color: 'var(--accent-yellow)' }}
                    title="Unsaved changes"
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}>
                    ●
                  </span>
                : <button className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    ×
                  </button>
              }
            </div>
          )
        })}
      </div>

      {/* Context menu */}
      {ctx && ctxTab && (
        <div onClick={(e) => e.stopPropagation()}
          className="fixed z-50 rounded-xl overflow-hidden py-1 shadow-2xl"
          style={{ top: ctx.y, left: ctx.x, background: 'var(--bg-mantle)', border: '1px solid var(--border)', minWidth: 200, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>

          <CtxItem onClick={() => { closeTab(ctx.tabId); setCtx(null) }}
            label="Close" shortcut="Ctrl+W" />
          <CtxItem onClick={() => { closeOthers(ctx.tabId); setCtx(null) }}
            label="Close Others" />
          <CtxItem onClick={() => { closeToRight(ctx.tabId); setCtx(null) }}
            label="Close to the Right" />
          <CtxItem onClick={() => { closeSaved(); setCtx(null) }}
            label="Close Saved" />
          <CtxItem onClick={() => { closeAllTabs(); setCtx(null) }}
            label="Close All" danger />

          <div className="my-1" style={{ height: 1, background: 'var(--border)' }} />

          <CtxItem onClick={() => { setSplitTabId(ctx.tabId); setCtx(null) }}
            label="Split Editor ⫴" />

          <div className="my-1" style={{ height: 1, background: 'var(--border)' }} />

          <CtxItem onClick={() => { copyPath(ctx.tabId); setCtx(null) }}
            label="Copy File Path" />
          <CtxItem onClick={() => {
            navigator.clipboard.writeText(ctxTab.fileName); setCtx(null)
          }} label="Copy File Name" />
          {!ctxTab.filePath.startsWith('__') && (
            <CtxItem onClick={() => { revealInExplorer(ctx.tabId); setCtx(null) }}
              label="Reveal in Explorer" />
          )}
        </div>
      )}
    </>
  )
}

function CtxItem({ label, shortcut, onClick, danger }: {
  label: string; shortcut?: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors"
      style={{ color: danger ? 'var(--accent-red)' : 'var(--text)', background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span>{label}</span>
      {shortcut && <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{shortcut}</span>}
    </button>
  )
}
