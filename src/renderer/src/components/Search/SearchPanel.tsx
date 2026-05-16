import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { getFileIcon } from '../../utils/languageDetect'

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GroupedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [totalMatches, setTotalMatches] = useState(0)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !currentFolder) { setResults([]); setSearched(false); return }
    setLoading(true)
    setError('')
    try {
      const raw = await window.api.search.inFiles(currentFolder, q, { caseSensitive, useRegex })
      const grouped: Record<string, GroupedResult> = {}
      for (const r of raw) {
        if (!grouped[r.file]) grouped[r.file] = { file: r.file, fileName: r.fileName, results: [] }
        grouped[r.file].results.push(r)
      }
      const g = Object.values(grouped)
      setResults(g)
      setTotalMatches(raw.length)
      setSearched(true)
    } catch (e: unknown) {
      setError(useRegex ? 'Invalid regex pattern' : String(e))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [currentFolder, caseSensitive, useRegex])

  const handleInput = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { if (debounceRef.current) clearTimeout(debounceRef.current); doSearch(query) }
  }

  const openResult = async (result: SearchResult) => {
    const r = await window.api.fs.readFile(result.file)
    if (r.content !== null) {
      openTab(result.file, result.fileName, r.content)
      // TODO: jump to line once editor is ready
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
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Search</p>

        {/* Search input */}
        <div className="relative">
          <input
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentFolder ? 'Search in files...' : 'Open a folder first'}
            disabled={!currentFolder}
            className="w-full px-2 py-1.5 rounded text-xs outline-none pr-6"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}` }}
          />
          {loading && (
            <span className="absolute right-2 top-1.5 animate-spin text-xs" style={{ color: 'var(--text-subtle)' }}>⟳</span>
          )}
        </div>

        {error && <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{error}</p>}

        {/* Options */}
        <div className="flex gap-2 mt-2">
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
            <div className="px-3 py-1.5 text-xs sticky top-0" style={{ background: 'var(--bg-mantle)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
              {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
              {totalMatches >= 200 && <span style={{ color: 'var(--accent-yellow)' }}> (limited to 200)</span>}
            </div>
            {results.map(group => (
              <FileGroup key={group.file} group={group} onOpen={openResult}
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

function FileGroup({ group, onOpen, highlightMatch }: {
  group: GroupedResult
  onOpen: (r: SearchResult) => void
  highlightMatch: (text: string, match: string) => React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const relativePath = group.file.split(/[\\/]/).slice(-2).join('/')

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
        style={{ background: 'var(--bg-surface0)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
        <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>
        <span className="text-sm">{getFileIcon(group.fileName)}</span>
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{group.fileName}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}>
          {group.results.length}
        </span>
      </button>

      {!collapsed && group.results.map((r, i) => (
        <button key={i} onClick={() => onOpen(r)}
          className="w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span className="text-xs flex-shrink-0 w-8 text-right" style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
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
        background: active ? 'var(--accent-blue)' : 'var(--bg-surface0)',
        color: active ? 'var(--bg-base)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border)'}`
      }}>
      {label}
    </button>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>{children}</p>
}
