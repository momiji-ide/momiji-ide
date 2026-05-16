import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'

interface Symbol {
  name: string
  kind: string
  line: number
  indent: number
}

const KIND_ICON: Record<string, string> = {
  class:     '◆',
  function:  'ƒ',
  method:    'ƒ',
  def:       'ƒ',
  const:     '■',
  let:       '■',
  var:       '■',
  interface: '◇',
  type:      '⬡',
  enum:      '≡',
  import:    '↗',
  struct:    '◈',
  impl:      '◈',
}

const KIND_COLOR: Record<string, string> = {
  class:     'var(--accent-yellow)',
  function:  'var(--accent-blue)',
  method:    'var(--accent-blue)',
  def:       'var(--accent-blue)',
  const:     'var(--accent-mauve)',
  let:       'var(--accent-mauve)',
  var:       'var(--text-muted)',
  interface: 'var(--accent-green)',
  type:      'var(--accent-green)',
  enum:      'var(--accent-yellow)',
  import:    'var(--text-subtle)',
  struct:    'var(--accent-yellow)',
  impl:      'var(--accent-green)',
}

// ── Language-specific symbol parsers ──────────────────────────────────────────
function parseSymbols(content: string, language: string): Symbol[] {
  const lines = content.split('\n')
  const symbols: Symbol[] = []

  const patterns: { re: RegExp; kind: string }[] = []

  if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(language)) {
    patterns.push(
      { re: /^(\s*)(?:export\s+)?(?:default\s+)?class\s+(\w+)/, kind: 'class' },
      { re: /^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: 'function' },
      { re: /^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w_]+)\s*=>/, kind: 'function' },
      { re: /^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*function/, kind: 'function' },
      { re: /^(\s*)(?:export\s+)?const\s+(\w+)\s*(?::\s*\w+)?\s*=(?!\s*(?:async\s+)?\(?.*=>)/, kind: 'const' },
      { re: /^(\s*)(?:export\s+)?(?:let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=/, kind: 'let' },
      { re: /^(\s*)(?:export\s+)?(?:type|interface)\s+(\w+)/, kind: 'interface' },
      { re: /^(\s*)(?:export\s+)?enum\s+(\w+)/, kind: 'enum' },
      { re: /^(\s*)(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/, kind: 'method' },
    )
  } else if (language === 'python') {
    patterns.push(
      { re: /^(\s*)class\s+(\w+)/, kind: 'class' },
      { re: /^(\s*)(?:async\s+)?def\s+(\w+)/, kind: 'def' },
      { re: /^(\s*)(\w+)\s*=(?!=)/, kind: 'var' },
    )
  } else if (language === 'go') {
    patterns.push(
      { re: /^(\s*)type\s+(\w+)\s+struct/, kind: 'struct' },
      { re: /^(\s*)type\s+(\w+)\s+interface/, kind: 'interface' },
      { re: /^(\s*)func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/, kind: 'function' },
      { re: /^(\s*)(?:var|const)\s+(\w+)/, kind: 'const' },
    )
  } else if (language === 'rust') {
    patterns.push(
      { re: /^(\s*)(?:pub\s+)?struct\s+(\w+)/, kind: 'struct' },
      { re: /^(\s*)(?:pub\s+)?enum\s+(\w+)/, kind: 'enum' },
      { re: /^(\s*)(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: 'function' },
      { re: /^(\s*)(?:pub\s+)?impl\s+(\w+)/, kind: 'impl' },
      { re: /^(\s*)(?:pub\s+)?(?:const|let)\s+(\w+)/, kind: 'const' },
    )
  } else if (['java', 'csharp'].includes(language)) {
    patterns.push(
      { re: /^(\s*)(?:public|private|protected|static|\s)*class\s+(\w+)/, kind: 'class' },
      { re: /^(\s*)(?:public|private|protected|static|void|\w+\s+)+(\w+)\s*\(/, kind: 'method' },
      { re: /^(\s*)(?:public|private|protected|static|final|\s)*(?:\w+)\s+(\w+)\s*(?:=|;)/, kind: 'var' },
    )
  } else if (language === 'css' || language === 'scss') {
    patterns.push(
      { re: /^(\s*)([.#][\w-]+|[\w-]+(?:\s*,\s*[\w.#-]+)*)\s*\{/, kind: 'class' },
      { re: /^(\s*)(@[\w-]+)\s/, kind: 'type' },
    )
  }

  if (patterns.length === 0) {
    // Generic fallback — catch anything that looks like a definition
    patterns.push(
      { re: /^(\s*)(?:function|class|def|func|fn|const|let|var|type)\s+(\w+)/, kind: 'function' },
    )
  }

  lines.forEach((line, i) => {
    for (const { re, kind } of patterns) {
      const m = line.match(re)
      if (m) {
        const indent = (m[1] ?? '').length
        const name = m[2]
        if (name && name.length > 1 && !/^(if|else|for|while|do|switch|try|catch|return|import|export)$/.test(name)) {
          symbols.push({ name, kind, line: i + 1, indent })
        }
        break
      }
    }
  })

  return symbols
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OutlinePanel() {
  const { tabs, activeTabId } = useAppStore()
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [search, setSearch] = useState('')
  const [activeSymbol, setActiveSymbol] = useState<number | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId)

  const refresh = useCallback(() => {
    if (!activeTab) { setSymbols([]); return }
    const syms = parseSymbols(activeTab.content, activeTab.language)
    setSymbols(syms)
  }, [activeTab])

  useEffect(() => { refresh() }, [refresh])

  // Listen for cursor position to highlight active symbol
  useEffect(() => {
    const handler = (e: Event) => {
      const { line } = (e as CustomEvent).detail
      const active = [...symbols].reverse().find(s => s.line <= line)
      setActiveSymbol(active?.line ?? null)
    }
    window.addEventListener('editor:cursor', handler)
    return () => window.removeEventListener('editor:cursor', handler)
  }, [symbols])

  const jumpTo = (line: number) => {
    window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line } }))
    setActiveSymbol(line)
  }

  const filtered = symbols.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4">
        <span style={{ fontSize: 28, opacity: 0.4 }}>◈</span>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Open a file to see its symbols</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Outline
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{symbols.length}</span>
          <button onClick={refresh} title="Refresh"
            className="text-xs px-1 rounded" style={{ color: 'var(--text-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
            ↻
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter symbols…"
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }} />
      </div>

      {/* File + language */}
      <div className="px-3 pb-1 flex-shrink-0">
        <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
          {activeTab.fileName} · <span style={{ color: 'var(--accent-blue)' }}>{activeTab.language}</span>
        </p>
      </div>

      {/* Symbol list */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>
            {search ? 'No matching symbols' : 'No symbols detected'}
          </p>
        ) : (
          filtered.map((sym, i) => {
            const icon  = KIND_ICON[sym.kind]  ?? '·'
            const color = KIND_COLOR[sym.kind] ?? 'var(--text-muted)'
            const isActive = sym.line === activeSymbol
            const leftPad  = Math.min(sym.indent, 16) * 6 + 8

            return (
              <button key={i} onClick={() => jumpTo(sym.line)}
                className="w-full flex items-center gap-1.5 py-1 rounded text-left transition-all"
                style={{
                  paddingLeft: leftPad,
                  background: isActive ? 'var(--accent-blue)15' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface0)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <span className="text-xs flex-shrink-0 w-4 text-center font-bold" style={{ color }}>{icon}</span>
                <span className="text-xs flex-1 truncate" style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {sym.name}
                </span>
                <span className="text-xs flex-shrink-0 mr-1" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>
                  {sym.line}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
