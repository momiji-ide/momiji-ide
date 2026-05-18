import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'
import { NewFileDialog } from './NewFileDialog'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  danger?: boolean
}

interface MenuDef {
  label: string
  items: MenuItem[]
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const {
    tabs, activeTabId, currentFolder, settings, updateSettings,
    closeTab, closeAllTabs, toggleBottomPanel, toggleSidebar,
    setCurrentFolder, setFileTree, openTab
  } = useAppStore()

  const activeTab = tabs.find(t => t.id === activeTabId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const saveActive = useCallback(async () => {
    if (!activeTab) return
    const result = await window.api.fs.writeFile(activeTab.filePath, activeTab.content)
    if (result.success) {
      useAppStore.getState().markTabClean(activeTab.id)
      toast.success(`Saved: ${activeTab.fileName}`)
    } else {
      toast.error(`Save failed: ${result.error}`)
    }
  }, [activeTab])

  const saveAll = useCallback(async () => {
    const { tabs } = useAppStore.getState()
    const dirty = tabs.filter(t => t.isDirty && !t.filePath.startsWith('__'))
    for (const tab of dirty) {
      const r = await window.api.fs.writeFile(tab.filePath, tab.content)
      if (r.success) useAppStore.getState().markTabClean(tab.id)
    }
    toast.success(`Saved ${dirty.length} file${dirty.length !== 1 ? 's' : ''}`)
  }, [])

  const openFolder = useCallback(async () => {
    const folder = await window.api.dialog.openFolder()
    if (folder) {
      setCurrentFolder(folder)
      const tree = await window.api.fs.readDir(folder)
      if (tree) setFileTree(tree)
      toast.success(`Opened: ${folder.split(/[\\/]/).pop()}`)
    }
  }, [setCurrentFolder, setFileTree])

  const openFile = useCallback(async () => {
    const paths = await window.api.dialog.openFile()
    if (paths) {
      for (const fp of paths) {
        const name = fp.split(/[\\/]/).pop() ?? 'file'
        const r = await window.api.fs.readFile(fp)
        if (r.content !== null) openTab(fp, name, r.content)
      }
    }
  }, [openTab])

  const refreshExplorer = useCallback(async () => {
    if (!currentFolder) return
    const tree = await window.api.fs.readDir(currentFolder)
    if (tree) setFileTree(tree)
    toast.info('Explorer refreshed')
  }, [currentFolder, setFileTree])

  const MENUS: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New File…', shortcut: 'Ctrl+N', action: () => setShowNewFile(true) },
        { label: 'New Folder…', action: () => setShowNewFolder(true) },
        { separator: true, label: '' },
        { label: 'Open File…', shortcut: 'Ctrl+O', action: openFile },
        { label: 'Open Folder…', shortcut: 'Ctrl+Shift+O', action: openFolder },
        { separator: true, label: '' },
        { label: 'Save', shortcut: 'Ctrl+S', action: saveActive, disabled: !activeTab },
        { label: 'Save All', shortcut: 'Ctrl+Shift+S', action: saveAll, disabled: tabs.length === 0 },
        { separator: true, label: '' },
        { label: 'Refresh Explorer', shortcut: 'F5', action: refreshExplorer, disabled: !currentFolder },
        { separator: true, label: '' },
        { label: 'Close Tab', shortcut: 'Ctrl+W', action: () => activeTab && closeTab(activeTab.id), disabled: !activeTab },
        { label: 'Close All Tabs', action: closeAllTabs, disabled: tabs.length === 0 }
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
        { separator: true, label: '' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
        { separator: true, label: '' },
        { label: 'Find…', shortcut: 'Ctrl+F', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })) },
        { label: 'Find in Files', shortcut: 'Ctrl+Shift+F', action: () => useAppStore.getState().setActivePanel('search') },
        { separator: true, label: '' },
        { label: 'Go to Definition', shortcut: 'F12', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true })) },
        { label: 'Go to Line…', shortcut: 'Ctrl+G', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true })) }
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: toggleSidebar },
        { label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: toggleBottomPanel },
        { separator: true, label: '' },
        { label: 'Explorer', action: () => useAppStore.getState().setActivePanel('explorer') },
        { label: 'Search in Files', action: () => useAppStore.getState().setActivePanel('search') },
        { label: 'AI Assistant', action: () => useAppStore.getState().setActivePanel('ai') },
        { label: 'Block Editor', action: () => useAppStore.getState().setActivePanel('blocks') },
        { label: 'Flow Editor', action: () => useAppStore.getState().setActivePanel('flow') },
        { label: 'Time-Travel Debugger', action: () => useAppStore.getState().setActivePanel('debug') },
        { label: 'Template Gallery', action: () => useAppStore.getState().setActivePanel('templates') },
        { separator: true, label: '' },
        {
          label: settings.theme === 'dark' ? '☀️ Switch to Light Theme' : '🌙 Switch to Dark Theme',
          action: () => {
            const t = settings.theme === 'dark' ? 'light' : 'dark'
            updateSettings({ theme: t })
            document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '')
          }
        },
        { separator: true, label: '' },
        { label: 'Zoom In', shortcut: 'Ctrl++', action: () => updateSettings({ fontSize: Math.min(settings.fontSize + 1, 28) }) },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => updateSettings({ fontSize: Math.max(settings.fontSize - 1, 10) }) },
        { label: 'Reset Zoom', action: () => updateSettings({ fontSize: 14 }) }
      ]
    },
    {
      label: 'Run',
      items: [
        {
          label: '▶ Run File',
          shortcut: 'F5',
          action: () => {
            if (!activeTab) { toast.warning('Open a file to run'); return }
            window.dispatchEvent(new CustomEvent('menubar:runFile'))
          },
          disabled: !activeTab
        },
        {
          label: '■ Stop',
          shortcut: 'Shift+F5',
          action: () => window.api.process.kill('runner-main')
        },
        { separator: true, label: '' },
        {
          label: '🌐 Preview HTML',
          action: () => {
            if (!activeTab || activeTab.language !== 'html') { toast.warning('Open an HTML file first'); return }
            useAppStore.getState().showBottomPanel || useAppStore.getState().toggleBottomPanel()
            window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'preview' } }))
          }
        },
        { label: '🎨 Canvas Playground', shortcut: 'Ctrl+Shift+P', action: () => window.dispatchEvent(new CustomEvent('app:openPlayground')) },
        { label: '📸 Code Screenshot', shortcut: 'Ctrl+Shift+X', action: () => window.dispatchEvent(new CustomEvent('app:screenshot')) },
        { label: '⚡ Regex Playground', shortcut: 'Ctrl+Shift+R', action: () => window.dispatchEvent(new CustomEvent('app:regex')) },
        { label: '⚡ Open Terminal', shortcut: 'Ctrl+`', action: toggleBottomPanel },
      ]
    },
    {
      label: 'Debug',
      items: [
        {
          label: '⏱ Time-Travel Debugger',
          shortcut: 'Ctrl+Shift+D',
          action: () => useAppStore.getState().setActivePanel('debug')
        },
        { separator: true, label: '' },
        {
          label: '▶ Run & Debug',
          shortcut: 'F5',
          action: () => {
            useAppStore.getState().setActivePanel('debug')
            window.dispatchEvent(new CustomEvent('debug:start'))
          },
          disabled: !activeTab
        },
        {
          label: '⏸ Step Through Code',
          shortcut: 'F10',
          action: () => window.dispatchEvent(new CustomEvent('debug:step'))
        },
        {
          label: '⏹ Stop Debugging',
          shortcut: 'Shift+F5',
          action: () => window.dispatchEvent(new CustomEvent('debug:stop'))
        },
        { separator: true, label: '' },
        {
          label: '🔍 Inspect Variables',
          action: () => {
            useAppStore.getState().setActivePanel('debug')
            toast.info('Variable inspector is in the Time-Travel Debugger panel')
          }
        },
        {
          label: '🌐 Open DevTools',
          shortcut: 'Ctrl+Shift+I',
          action: () => (window.api as any).window?.openDevTools?.()
        }
      ]
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Keyboard Shortcuts',
          action: () => {
            const shortcuts = [
              'Ctrl+P      — Command Palette / Open File',
              'Ctrl+S      — Save File',
              'Ctrl+Shift+S— Save All',
              'Ctrl+W      — Close Tab',
              'Ctrl+B      — Toggle Sidebar',
              'Ctrl+`      — Toggle Terminal',
              'Ctrl+N      — New File',
              'Ctrl+O      — Open File',
              'F5          — Run File',
              'F12         — Go to Definition',
              'Ctrl+Click  — Go to Definition',
              'Ctrl+G      — Go to Line',
              'Ctrl+F      — Find in Editor',
              'Ctrl++/-    — Zoom In/Out',
              'Ctrl+Z/Y    — Undo/Redo',
            ].join('\n')
            toast.info('See Help > Keyboard Shortcuts panel')
            useAppStore.getState().openTab('__help__/shortcuts.txt', 'shortcuts.txt', shortcuts)
          }
        },
        {
          label: '🦊 Kitsune Setup Wizard',
          action: () => {
            localStorage.removeItem('momiji:onboarding-done')
            window.location.reload()
          }
        },
        { separator: true, label: '' },
        {
          label: 'About Momiji IDE',
          action: () => window.dispatchEvent(new CustomEvent('app:showAbout'))
        }
      ]
    }
  ]

  const toggle = (label: string) => setOpenMenu(prev => prev === label ? null : label)

  return (
    <>
      <div
        ref={barRef}
        className="flex items-center flex-shrink-0 no-drag"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '28px', paddingLeft: 4 }}
      >
        {MENUS.map(menu => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => toggle(menu.label)}
              onMouseEnter={() => openMenu && openMenu !== menu.label && setOpenMenu(menu.label)}
              className="px-3 h-7 text-xs rounded transition-colors"
              style={{
                color: openMenu === menu.label ? 'var(--text)' : 'var(--text-muted)',
                background: openMenu === menu.label ? 'var(--bg-surface0)' : 'transparent'
              }}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                <div
                  className="absolute left-0 z-50 py-1 rounded-lg shadow-2xl"
                  style={{
                    top: '100%',
                    minWidth: '220px',
                    background: 'var(--bg-surface0)',
                    border: '1px solid var(--border)',
                    animation: 'scaleIn 0.1s ease-out'
                  }}
                >
                  {menu.items.map((item, i) => {
                    if (item.separator) {
                      return <div key={i} className="my-1 mx-2" style={{ height: 1, background: 'var(--border)' }} />
                    }
                    return (
                      <button
                        key={i}
                        disabled={item.disabled}
                        onClick={() => { item.action?.(); setOpenMenu(null) }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors"
                        style={{
                          color: item.disabled ? 'var(--text-subtle)' : item.danger ? 'var(--accent-red)' : 'var(--text)',
                          background: 'transparent',
                          cursor: item.disabled ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'var(--bg-surface1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-8 opacity-50 text-xs">{item.shortcut}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* New File Dialog */}
      {(showNewFile || showNewFolder) && (
        <NewFileDialog
          isFolder={showNewFolder}
          currentFolder={currentFolder}
          onClose={() => { setShowNewFile(false); setShowNewFolder(false) }}
          onCreate={async (fullPath, isFolder) => {
            if (isFolder) {
              await window.api.fs.createFolder(fullPath)
            } else {
              await window.api.fs.createFile(fullPath)
              const name = fullPath.split(/[\\/]/).pop() ?? 'file'
              openTab(fullPath, name, '')
            }
            if (currentFolder) {
              const tree = await window.api.fs.readDir(currentFolder)
              if (tree) setFileTree(tree)
            }
            toast.success(`Created: ${fullPath.split(/[\\/]/).pop()}`)
            setShowNewFile(false)
            setShowNewFolder(false)
          }}
        />
      )}
    </>
  )
}
