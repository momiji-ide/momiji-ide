import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { getFileIcon } from '../../utils/languageDetect'
import { toast } from '../../utils/toast'

interface SearchResult {
  file: string
  fileName: string
  line: number
  col: number
  text: string
  match: string
}

interface GroupedResult {
  file: string
  fileName: string
  results: SearchResult[]
}

export function SearchPanel() {
  const { currentFolder, openTab } = useAppStore()
  const [query, setQuery]           = useState('')
  const [replace, setReplace]       = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [results, setResults]       = useState<GroupedResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [replacing, setReplacing]   = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex]     = useState(false)
  const [totalMatches, setTotalMatches] = useState(0)
  const [searched, setSearched]     = useState(false)
  const [error, setError]           = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !currentFolder) { setResults([]); setSearched(false); return }
    setLoading(true); setError('')
    try {
      const raw = await window.api.search.inFiles(currentFolder, q, { caseSensitive, useRegex })
      const grouped: Record<string, GroupedResult> = {}
      for (const r of raw) {
        if (!grouped[r.file]) grouped[r.file] = { file: r.file, fileName: r.fileName, results: [] }
        grouped[r.file].results.push(r)
      }
      setResults(Object.values(grouped))
      setTotalMatches(raw.length)
      setSearched(true)
    } catch (e: unknown) {
      setError(useRegex ? 'Invalid regex pattern' : String(e))
      setResults([])
    } finally { setLoading(false) }
  }, [currentFolder, caseSensitive, useRegex])

  const handleInput = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  // ── Replace helpers ───────────────────────────────────────────────────────
  const replaceInContent = (content: string, from: string, to: string, cs: boolean, regex: boolean): string => {
    if (regex) {
      try { return content.replace(new RegExp(from, cs ? 'g' : 'gi'), to) } catch { return content }
    }
    const flags = cs ? 'g' : 'gi'
    return content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), to)
  }

  const handleReplaceInFile = async (file: string, fileName: string) => {
    if (!replace && replace !== '') return
    const r = await window.api.fs.readFile(file)
    if (r.content === null) return
    const newContent = replaceInContent(r.content, query, replace, caseSensitive, useRegex)
    if (newContent === r.content) return
    await window.api.fs.writeFile(file, newContent)
    // Update open tab if file is open
    const tabs = useAppStore.getState().tabs
    const tab = tabs.find(t => t.filePath === file)
    if (tab) {
      useAppStore.getState().updateTabContent(tab.id, newContent)
      useAppStore.getState().markTabClean(tab.id)
    }
    toast.success(`Replaced in ${fileName}`)
    doSearch(query)
  }

  const handleReplaceAll = async () => {
    if (!query.trim() || results.length === 0) return
    setReplacing(true)
    let count = 0
    for (const group of results) {
      const r = await window.api.fs.readFile(group.file)
      if (r.content === null) continue
      const newContent = replaceInContent(r.content, query, replace, caseSensitive, useRegex)
      if (newContent !== r.content) {
        await window.api.fs.writeFile(group.file, newContent)
        count++
        const tabs = useAppStore.getState().tabs
        const tab = tabs.find(t => t.filePath === group.file)
        if (tab) {
          useAppStore.getState().updateTabContent(tab.id, newContent)
          useAppStore.getState().markTabClean(tab.id)
        }
      }
    }
    toast.success(`Replaced in ${count} file${count !== 1 ? 's' : ''}`)
    setReplacing(false)
    doSearch(query)
  }

  const openResult = async (result: SearchResult) => {
    const r = await window.api.fs.readFile(result.file)
    if (r.content !== null) {
      openTab(result.file, result.fileName, r.content)
      setTimeout(() => window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: result.line } })), 200)
    }
  }

  const highlightMatch = (text: string, match: string, cs: boolean) => {
    const idx = cs ? text.indexOf(match) : text.toLowerCase().indexOf(match.toLowerCase())
    if (idx < 0) return <span>{text}</span>
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(249,226,175,0.35)', color: 'var(--accent-yellow)', borderRadius: 2 }}>
          {text.slice(idx, idx + match.length)}
        </mark>
        {text.slice(idx + match.length)}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Search</p>
          <button onClick={() => setShowReplace(v => !v)}
            className="text-xs px-1.5 py-0.5 rounded transition-all"
            title="Toggle replace"
            style={{ background: showReplace ? 'var(--accent-mauve)22' : 'transparent', color: showReplace ? 'var(--accent-mauve)' : 'var(--text-subtle)', border: `1px solid ${showReplace ? 'var(--accent-mauve)44' : 'transparent'}` }}>
            ⇄ Replace
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-1.5">
          <input
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { if (debounceRef.current) clearTimeout(debounceRef.current); doSearch(query) } }}
            placeholder={currentFolder ? 'Search in files...' : 'Open a folder first'}
            disabled={!currentFolder}
            className="w-full px-2 py-1.5 rounded text-xs outline-none pr-6"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}` }}
          />
          {loading && <span className="absolute right-2 top-1.5 animate-spin text-xs" style={{ color: 'var(--text-subtle)' }}>⟳</span>}
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="flex gap-1 mb-1.5">
            <input
              value={replace}
              onChange={e => setReplace(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleReplaceAll() }}
              placeholder="Replace with..."
              className="flex-1 px-2 py-1.5 rounded text-xs outline-none"
              style={{ background: 'var(--bg-surface0)', color: 'var(--accent-yellow)', border: '1px solid var(--border)' }}
            />
            <button onClick={handleReplaceAll}
              disabled={replacing || results.length === 0 || !query}
              className="px-2 py-1 rounded text-xs font-semibold flex-shrink-0 transition-all"
              style={{
                background: results.length > 0 && query ? 'var(--accent-yellow)' : 'var(--bg-surface0)',
                color: results.length > 0 && query ? 'var(--bg-base)' : 'var(--text-muted)'
              }}
              title="Replace all matches">
              {replacing ? '…' : 'All'}
            </button>
          </div>
        )}

        {error && <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{error}</p>}

        {/* Options */}
        <div className="flex gap-2 mt-1">
          <Toggle label="Aa" title="Case sensitive" active={caseSensitive} onChange={v => { setCaseSensitive(v); doSearch(query) }} />
          <Toggle label=".*" title="Use regex" active={useRegex} onChange={v => { setUseRegex(v); doSearch(query) }} />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!currentFolder ? (
          <Hint>Open a folder to search</Hint>
        ) : searched && results.length === 0 ? (
          <Hint>No results for "{query}"</Hint>
        ) : searched ? (
          <>
            <div className="px-3 py-1.5 text-xs sticky top-0 flex items-center justify-between"
              style={{ background: 'var(--bg-mantle)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
              <span>{totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}</span>
              {totalMatches >= 200 && <span style={{ color: 'var(--accent-yellow)' }}>limited to 200</span>}
            </div>
            {results.map(group => (
              <FileGroup key={group.file} group={group} onOpen={openResult}
                showReplace={showReplace}
                onReplaceFile={() => handleReplaceInFile(group.file, group.fileName)}
                highlightMatch={(t, m) => highlightMatch(t, m, caseSensitive)} />
            ))}
          </>
        ) : (
          <Hint>Type to search across all files</Hint>
        )}
      </div>
    </div>
  )
}

function FileGroup({ group, onOpen, highlightMatch, showReplace, onReplaceFile }: {
  group: GroupedResult
  onOpen: (r: SearchResult) => void
  highlightMatch: (text: string, match: string) => React.ReactNode
  showReplace: boolean
  onReplaceFile: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
        style={{ background: 'var(--bg-surface0)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
        <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>
        <span className="text-sm">{getFileIcon(group.fileName)}</span>
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{group.fileName}</span>
        {showReplace && (
          <button onClick={e => { e.stopPropagation(); onReplaceFile() }}
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 transition-all"
            style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)44' }}
            title="Replace in this file">
            ⇄
          </button>
        )}
        <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)' }}>
          {group.results.length}
        </span>
      </button>

      {!collapsed && group.results.map((r, i) => (
        <button key={i} onClick={() => onOpen(r)}
          className="w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span className="text-xs flex-shrink-0 w-8 text-right" style={{ color: 'var(--accent-mauve)', fontFamily: 'monospace' }}>
            {r.line}
          </span>
          <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {highlightMatch(r.text, r.match)}
          </span>
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, title, active, onChange }: {
  label: string; title: string; active: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button onClick={() => onChange(!active)} title={title}
      className="px-2 py-0.5 rounded text-xs font-mono font-bold transition-all"
      style={{
        background: active ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
        color: active ? 'var(--bg-base)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent-mauve)' : 'var(--border)'}`
      }}>
      {label}
    </button>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>{children}</p>
}
