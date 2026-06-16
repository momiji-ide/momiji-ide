import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { FileNode } from '../../types'
import { getFileIcon } from '../../utils/languageDetect'
import { toast } from '../../utils/toast'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: string
  action: () => void
  category: 'command'
}

interface FileItem {
  id: string
  label: string
  description: string
  icon: string
  filePath: string
  category: 'file' | 'recent'
}

type PaletteItem = CommandItem | FileItem

const RECENT_KEY = 'momiji:recent-files'
const MAX_RECENT = 8

function getRecentFiles(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') }
  catch { return [] }
}

export function addRecentFile(filePath: string) {
  const recent = getRecentFiles().filter((f) => f !== filePath)
  localStorage.setItem(RECENT_KEY, JSON.stringify([filePath, ...recent].slice(0, MAX_RECENT)))
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((n) => n.type === 'file' ? [n] : flattenTree(n.children ?? []))
}

function fuzzyScore(pattern: string, str: string): number {
  if (!pattern) return 50
  const p = pattern.toLowerCase()
  const s = str.toLowerCase()
  if (s === p) return 200
  if (s.startsWith(p)) return 150
  if (s.includes(p)) return 100 - s.indexOf(p)
  // Fuzzy: check all chars in order
  let pi = 0, score = 0
  for (let si = 0; si < s.length && pi < p.length; si++) {
    if (s[si] === p[pi]) { score += (pi === si ? 10 : 3); pi++ }
  }
  return pi === p.length ? score : -1
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const { fileTree, tabs, openTab, toggleBottomPanel, updateSettings, settings, setActivePanel } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const isCommand = query.startsWith('>')
  const searchQuery = isCommand ? query.slice(1).trim() : query.trim()

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const commands: CommandItem[] = [
    { id: 'cmd-new-file', label: 'New File', icon: '📄', description: 'Create a new file', category: 'command', action: () => { toast.info('Use the Explorer panel to create files'); onClose() } },
    { id: 'cmd-open-folder', label: 'Open Folder', icon: '📁', description: 'Open a project folder', category: 'command', action: async () => { onClose(); const f = await window.api.dialog.openFolder(); if (f) { useAppStore.getState().setCurrentFolder(f); const tree = await window.api.fs.readDir(f); if (tree) useAppStore.getState().setFileTree(tree); toast.success(`Opened: ${f.split(/[\\/]/).pop()}`) } } },
    { id: 'cmd-terminal', label: 'Toggle Terminal', icon: '⚡', description: 'Show/hide terminal panel', category: 'command', action: () => { toggleBottomPanel(); onClose() } },
    { id: 'cmd-theme', label: `Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} Theme`, icon: settings.theme === 'dark' ? '☀️' : '🌙', description: 'Toggle color theme', category: 'command', action: () => { const t = settings.theme === 'dark' ? 'light' : 'dark'; updateSettings({ theme: t }); document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : ''); onClose() } },
    { id: 'cmd-ai', label: 'Open AI Assistant', icon: '✨', description: 'Open AI chat panel', category: 'command', action: () => { setActivePanel('kitsune'); onClose() } },
    { id: 'cmd-blocks', label: 'Open Block Editor', icon: '🧩', description: 'Visual block programming', category: 'command', action: () => { setActivePanel('blocks'); onClose() } },
    { id: 'cmd-git', label: 'Open Git Panel', icon: '🔀', description: 'Git source control', category: 'command', action: () => { setActivePanel('git'); onClose() } },
    { id: 'cmd-snippets', label: 'Open Snippets', icon: '📋', description: 'Code snippet manager', category: 'command', action: () => { setActivePanel('snippets'); onClose() } },
    { id: 'cmd-settings', label: 'Open Settings', icon: '⚙️', description: 'Editor preferences', category: 'command', action: () => { setActivePanel('settings'); onClose() } },
    { id: 'cmd-font-up', label: 'Increase Font Size', icon: '🔤', description: `Current: ${settings.fontSize}px`, category: 'command', action: () => { updateSettings({ fontSize: Math.min(settings.fontSize + 1, 28) }); onClose() } },
    { id: 'cmd-font-down', label: 'Decrease Font Size', icon: '🔤', description: `Current: ${settings.fontSize}px`, category: 'command', action: () => { updateSettings({ fontSize: Math.max(settings.fontSize - 1, 10) }); onClose() } },
    { id: 'cmd-close-all', label: 'Close All Tabs', icon: '✕', description: 'Close all open editor tabs', category: 'command', action: () => { useAppStore.getState().closeAllTabs(); onClose() } }
  ]

  const allFiles = flattenTree(fileTree)
  const recentPaths = getRecentFiles()
  const recentFiles: FileItem[] = recentPaths
    .map((fp) => {
      const node = allFiles.find((f) => f.path === fp)
      const name = fp.split(/[\\/]/).pop() ?? fp
      return { id: `recent-${fp}`, label: name, description: fp, icon: getFileIcon(name), filePath: fp, category: 'recent' as const }
    })
    .filter((f) => !searchQuery || fuzzyScore(searchQuery, f.label) >= 0)

  const fileItems: FileItem[] = allFiles
    .filter((n) => !recentPaths.includes(n.path))
    .map((n) => ({ id: `file-${n.path}`, label: n.name, description: n.path, icon: getFileIcon(n.name), filePath: n.path, category: 'file' as const }))
    .filter((f) => !searchQuery || fuzzyScore(searchQuery, f.label) >= 0)
    .sort((a, b) => fuzzyScore(searchQuery, b.label) - fuzzyScore(searchQuery, a.label))
    .slice(0, 15)

  const commandItems: CommandItem[] = commands.filter((c) =>
    !searchQuery || fuzzyScore(searchQuery, c.label) >= 0
  )

  const items: PaletteItem[] = isCommand
    ? commandItems
    : [...(searchQuery ? [] : recentFiles.slice(0, 5)), ...fileItems, ...(searchQuery ? [] : commandItems.slice(0, 3))]

  const filteredItems = searchQuery
    ? (isCommand ? commandItems : [...fileItems, ...commandItems])
        .filter((i) => fuzzyScore(searchQuery, i.label) >= 0)
        .sort((a, b) => fuzzyScore(searchQuery, b.label) - fuzzyScore(searchQuery, a.label))
    : items

  const handleSelect = useCallback((item: PaletteItem) => {
    if (item.category === 'command') {
      (item as CommandItem).action()
    } else {
      const fi = item as FileItem
      addRecentFile(fi.filePath)
      window.api.fs.readFile(fi.filePath).then((result) => {
        if (result.content !== null) {
          openTab(fi.filePath, fi.label, result.content)
        }
      })
      onClose()
    }
  }, [openTab, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filteredItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filteredItems[activeIdx]) {
      handleSelect(filteredItems[activeIdx])
    }
  }

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  const grouped = !searchQuery && !isCommand

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', animation: 'scaleIn 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{isCommand ? '⌘' : '🔍'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files or type > for commands..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '380px' }}>
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
              No results for "{searchQuery}"
            </div>
          ) : (
            <>
              {grouped && recentFiles.length > 0 && (
                <SectionHeader label="Recent" />
              )}
              {filteredItems.map((item, idx) => {
                const showFileHeader = grouped && idx === Math.min(recentFiles.length, 5) && fileItems.length > 0
                const showCmdHeader = grouped && idx === Math.min(recentFiles.length, 5) + fileItems.slice(0, 15).length && commandItems.length > 0
                return (
                  <div key={item.id}>
                    {showFileHeader && <SectionHeader label="Files" />}
                    {showCmdHeader && <SectionHeader label="Commands" />}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{
                        background: idx === activeIdx ? 'var(--bg-surface1)' : 'transparent',
                        color: 'var(--text)'
                      }}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{item.label}</div>
                        {item.description && (
                          <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      {item.category === 'recent' && (
                        <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)' }}>
                          recent
                        </span>
                      )}
                      {item.category === 'command' && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>↵</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-subtle)' }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>ESC close</span>
          <span className="ml-auto">Type <kbd className="px-1 rounded" style={{ background: 'var(--bg-surface1)' }}>&gt;</kbd> for commands</span>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-subtle)', background: 'var(--bg-mantle)' }}>
      {label}
    </div>
  )
}
