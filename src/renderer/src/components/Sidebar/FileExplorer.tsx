import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { FileNode } from '../../types'
import { FileIcon } from './FileIcon'
import { addRecentFolder } from '../Editor/CodeEditor'

export function FileExplorer() {
  const { currentFolder, fileTree, setCurrentFolder, setFileTree, openTab } = useAppStore()
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadFolder = useCallback(async (folderPath: string) => {
    const tree = await window.api.fs.readDir(folderPath)
    if (tree) setFileTree(tree)
  }, [setFileTree])

  const handleOpenFolder = async () => {
    const folder = await window.api.dialog.openFolder()
    if (folder) {
      setCurrentFolder(folder)
      await loadFolder(folder)
      addRecentFolder(folder)
    }
  }

  const handleFileClick = async (node: FileNode) => {
    if (node.type === 'directory') {
      setExpandedDirs((prev) => {
        const next = new Set(prev)
        if (next.has(node.path)) {
          next.delete(node.path)
        } else {
          next.add(node.path)
          // Lazy load children
          window.api.fs.readDir(node.path).then((children) => {
            if (children) {
              setFileTree(updateTreeNode(fileTree, node.path, children))
            }
          })
        }
        return next
      })
    } else {
      const result = await window.api.fs.readFile(node.path)
      if (result.content !== null) {
        openTab(node.path, node.name, result.content)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const handleDelete = async (node: FileNode) => {
    setContextMenu(null)
    await window.api.fs.delete(node.path)
    if (currentFolder) await loadFolder(currentFolder)
  }

  const startRename = (node: FileNode) => {
    setContextMenu(null)
    setRenaming(node.path)
    setRenameValue(node.name)
  }

  const handleRename = async (node: FileNode) => {
    if (!renameValue.trim() || renameValue === node.name) {
      setRenaming(null)
      return
    }
    const parent = node.path.substring(0, node.path.length - node.name.length - 1)
    const newPath = parent + '\\' + renameValue
    await window.api.fs.rename(node.path, newPath)
    setRenaming(null)
    if (currentFolder) await loadFolder(currentFolder)
  }

  const handleNewFile = async (dirPath?: string) => {
    setContextMenu(null)
    const basePath = dirPath || currentFolder
    if (!basePath) return
    const newPath = basePath + '\\untitled.txt'
    await window.api.fs.createFile(newPath)
    if (currentFolder) await loadFolder(currentFolder)
    startRename({ name: 'untitled.txt', path: newPath, type: 'file' })
  }

  const handleNewFolder = async (dirPath?: string) => {
    setContextMenu(null)
    const basePath = dirPath || currentFolder
    if (!basePath) return
    const newPath = basePath + '\\new-folder'
    await window.api.fs.createFolder(newPath)
    if (currentFolder) await loadFolder(currentFolder)
    startRename({ name: 'new-folder', path: newPath, type: 'directory' })
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
      >
        <span>Explorer</span>
        <div className="flex gap-1">
          {currentFolder && (
            <>
              <IconButton title="New File" onClick={() => handleNewFile()}>+📄</IconButton>
              <IconButton title="New Folder" onClick={() => handleNewFolder()}>+📁</IconButton>
              <IconButton title="Refresh" onClick={() => currentFolder && loadFolder(currentFolder)}>↻</IconButton>
            </>
          )}
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {!currentFolder ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <span className="text-3xl">📂</span>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No folder open
            </p>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}
            >
              Open Folder
            </button>
          </div>
        ) : (
          <FileTree
            nodes={fileTree}
            depth={0}
            expandedDirs={expandedDirs}
            renaming={renaming}
            renameValue={renameValue}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            onRename={handleRename}
            onRenameChange={setRenameValue}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onDelete={handleDelete}
          onRename={startRename}
          onNewFile={() => handleNewFile(contextMenu.node?.type === 'directory' ? contextMenu.node.path : undefined)}
          onNewFolder={() => handleNewFolder(contextMenu.node?.type === 'directory' ? contextMenu.node.path : undefined)}
        />
      )}
    </div>
  )
}

function FileTree({
  nodes, depth, expandedDirs, renaming, renameValue,
  onFileClick, onContextMenu, onRename, onRenameChange
}: {
  nodes: FileNode[]
  depth: number
  expandedDirs: Set<string>
  renaming: string | null
  renameValue: string
  onFileClick: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  onRename: (node: FileNode) => void
  onRenameChange: (val: string) => void
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer rounded mx-1 group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onFileClick(node)}
            onContextMenu={(e) => onContextMenu(e, node)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileIcon
              name={node.name}
              isDir={node.type === 'directory'}
              isOpen={node.type === 'directory' && expandedDirs.has(node.path)}
              size={15}
            />
            {renaming === node.path ? (
              <input
                className="flex-1 text-xs px-1 rounded outline-none min-w-0"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--accent-blue)' }}
                value={renameValue}
                autoFocus
                onChange={(e) => onRenameChange(e.target.value)}
                onBlur={() => onRename(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRename(node)
                  if (e.key === 'Escape') onRenameChange(node.name)
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--text)' }}>
                {node.name}
              </span>
            )}
          </div>

          {node.type === 'directory' && expandedDirs.has(node.path) && node.children && (
            <FileTree
              nodes={node.children}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              renaming={renaming}
              renameValue={renameValue}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              onRename={onRename}
              onRenameChange={onRenameChange}
            />
          )}
        </div>
      ))}
    </>
  )
}

function ContextMenu({
  x, y, node, onClose, onDelete, onRename, onNewFile, onNewFolder
}: {
  x: number; y: number; node: FileNode | null
  onClose: () => void
  onDelete: (node: FileNode) => void
  onRename: (node: FileNode) => void
  onNewFile: () => void
  onNewFolder: () => void
}) {
  const items = [
    { label: '📄 New File', action: onNewFile },
    { label: '📁 New Folder', action: onNewFolder },
    ...(node ? [
      { label: '✏️ Rename', action: () => onRename(node) },
      { label: '🗑️ Delete', action: () => onDelete(node), danger: true }
    ] : [])
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg shadow-xl py-1 min-w-40"
        style={{ left: x, top: y, background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            className="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style={{ color: (item as { danger?: boolean }).danger ? 'var(--accent-red)' : 'var(--text)' }}
            onClick={() => { item.action(); onClose() }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="text-xs px-1 py-0.5 rounded transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
      {children}
    </button>
  )
}

function updateTreeNode(tree: FileNode[], targetPath: string, children: FileNode[]): FileNode[] {
  return tree.map((node) => {
    if (node.path === targetPath) return { ...node, children }
    if (node.children) return { ...node, children: updateTreeNode(node.children, targetPath, children) }
    return node
  })
}
