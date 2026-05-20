import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { FileIcon } from '../Sidebar/FileIcon'

const TODO_PATTERNS = ['TODO', 'FIXME', 'HACK', 'BUG', 'NOTE', 'XXX', 'OPTIMIZE', 'REVIEW']
const BADGE_COLORS: Record<string, string> = {
  TODO: 'var(--accent-mauve)', FIXME: 'var(--accent-red)', BUG: 'var(--accent-red)',
  HACK: 'var(--accent-yellow)', NOTE: 'var(--accent-green)', XXX: 'var(--accent-red)',
  OPTIMIZE: 'var(--accent-mauve)', REVIEW: 'var(--accent-yellow)'
}

interface TodoItem {
  file: string
  fileName: string
  line: number
  col: number
  tag: string
  text: string
}

export function TodoPanel() {
  const { currentFolder, openTab } = useAppStore()
  const [items, setItems] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const scan = useCallback(async () => {
    if (!currentFolder) return
    setLoading(true)
    const pattern = TODO_PATTERNS.join('|')
    try {
      const results = await window.api.search.inFiles(currentFolder, pattern, { caseSensitive: false, useRegex: true })
      const todos: TodoItem[] = (results ?? []).map((r: any) => {
        const tagMatch = r.text.match(new RegExp(`(${pattern})`, 'i'))
        const tag = tagMatch ? tagMatch[1].toUpperCase() : 'TODO'
        const textAfter = r.text.replace(/.*?(TODO|FIXME|HACK|BUG|NOTE|XXX|OPTIMIZE|REVIEW)[:\s]*/i, '').trim()
        return {
          file: r.file,
          fileName: r.file.split(/[\\/]/).pop() ?? r.file,
          line: r.line,
          col: r.col ?? 0,
          tag,
          text: textAfter || r.text.trim()
        }
      }).filter((t: TodoItem) => t.text)
      setItems(todos)
    } catch {}
    setLoading(false)
  }, [currentFolder])

  useEffect(() => { scan() }, [scan])

  const filtered = items.filter(t => {
    const matchTag = filter === 'ALL' || t.tag === filter
    const matchSearch = !search || t.text.toLowerCase().includes(search.toLowerCase()) || t.fileName.toLowerCase().includes(search.toLowerCase())
    return matchTag && matchSearch
  })

  const grouped: Record<string, TodoItem[]> = {}
  filtered.forEach(t => {
    if (!grouped[t.file]) grouped[t.file] = []
    grouped[t.file].push(t)
  })

  const tagCounts: Record<string, number> = {}
  items.forEach(t => { tagCounts[t.tag] = (tagCounts[t.tag] ?? 0) + 1 })

  const handleJump = async (item: TodoItem) => {
    const r = await window.api.fs.readFile(item.file)
    if (r.content !== null) {
      openTab(item.file, item.fileName, r.content)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: item.line } }))
      }, 200)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          ✅ TODO / Tasks
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{items.length}</span>
          <button onClick={scan} disabled={loading} className="text-xs px-1.5 py-0.5 rounded ml-1 transition-colors"
            style={{ color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
            {loading ? '⟳' : '↻ Scan'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 pt-2 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search todos..."
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }} />
      </div>

      {/* Tag filter chips */}
      <div className="flex gap-1 px-2 pt-1.5 pb-1 flex-shrink-0 flex-wrap">
        {['ALL', ...TODO_PATTERNS.filter(t => tagCounts[t] > 0)].map(tag => (
          <button key={tag} onClick={() => setFilter(tag)}
            className="text-xs px-2 py-0.5 rounded-full transition-all font-semibold"
            style={{
              background: filter === tag ? (BADGE_COLORS[tag] ?? 'var(--accent-mauve)') : 'var(--bg-surface0)',
              color: filter === tag ? 'white' : 'var(--text-muted)',
              fontSize: 10
            }}>
            {tag} {tag !== 'ALL' && tagCounts[tag] ? `(${tagCounts[tag]})` : tag === 'ALL' ? `(${items.length})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      {!currentFolder ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-4">
          <span style={{ fontSize: 32 }}>📁</span>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open a folder to scan for TODOs</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center flex-1 gap-2">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent-mauve)', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scanning…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-4">
          <span style={{ fontSize: 28 }}>🎉</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>No TODOs found!</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Clean codebase 👏</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {Object.entries(grouped).map(([file, todos]) => {
            const fileName = file.split(/[\\/]/).pop() ?? file
            const relPath = file.replace(currentFolder + '/', '').replace(currentFolder + '\\', '')
            return (
              <div key={file} className="mt-2">
                <div className="flex items-center gap-1.5 py-1 sticky top-0" style={{ background: 'var(--bg-mantle)' }}>
                  <FileIcon name={fileName} size={12} />
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{fileName}</span>
                  <span className="text-xs ml-auto px-1 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontSize: 9 }}>{todos.length}</span>
                </div>
                {todos.map((t, i) => (
                  <button key={i} onClick={() => handleJump(t)}
                    className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left mb-0.5 transition-colors group"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 mt-px"
                      style={{ background: (BADGE_COLORS[t.tag] ?? 'var(--accent-mauve)') + '22', color: BADGE_COLORS[t.tag] ?? 'var(--accent-mauve)', fontSize: 9 }}>
                      {t.tag}
                    </span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>{t.text}</span>
                    <span className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>:{t.line}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
