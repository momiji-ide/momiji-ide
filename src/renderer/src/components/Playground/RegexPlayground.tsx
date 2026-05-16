import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'

const EXAMPLES = [
  { name: 'Email', pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', flags: 'gi', test: 'Contact us at hello@parallax.dev or support@kitsune.ai' },
  { name: 'URL', pattern: 'https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[\\/\\w\\-@:%+~#?&=]*', flags: 'gi', test: 'Visit https://parallax.dev or http://kitsune.ai/docs' },
  { name: 'Date', pattern: '\\d{4}[-/]\\d{2}[-/]\\d{2}', flags: 'g', test: 'Dates: 2024-01-15, 2025/06/30, not 24-1-5' },
  { name: 'Hex Color', pattern: '#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', flags: 'g', test: 'Colors: #fff, #1e1e2e, #cba6f7, not #xyz' },
  { name: 'IP Address', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', test: 'Server at 192.168.1.1, DNS: 8.8.8.8, invalid: 999.x.1.1' },
]

interface Props { onClose: () => void }

export function RegexPlayground({ onClose }: Props) {
  const { settings } = useAppStore()
  const [pattern, setPattern] = useState('[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}')
  const [flags, setFlags] = useState('gi')
  const [testStr, setTestStr] = useState('Contact us at hello@parallax.dev or support@kitsune.ai for help!')
  const [selected, setSelected] = useState(0)

  const { matches, error, highlighted } = useCallback(() => {
    if (!pattern) return { matches: [], error: '', highlighted: testStr }
    try {
      const rx = new RegExp(pattern, flags.replace(/[^gimsuy]/g, ''))
      const matches: RegExpExecArray[] = []
      if (flags.includes('g')) {
        let m: RegExpExecArray | null
        rx.lastIndex = 0
        while ((m = rx.exec(testStr)) !== null) { matches.push(m); if (!flags.includes('g')) break }
      } else {
        const m = rx.exec(testStr)
        if (m) matches.push(m)
      }

      // Build highlighted HTML
      let out = '', pos = 0
      matches.forEach(m => {
        if (m.index > pos) out += escHtml(testStr.slice(pos, m.index))
        out += `<mark style="background:#cba6f744;color:#cba6f7;border-radius:2px">${escHtml(m[0])}</mark>`
        pos = m.index + m[0].length
      })
      out += escHtml(testStr.slice(pos))

      return { matches, error: '', highlighted: out }
    } catch (e: any) {
      return { matches: [], error: e.message, highlighted: escHtml(testStr) }
    }
  }, [pattern, flags, testStr])()

  const loadExample = (i: number) => {
    const ex = EXAMPLES[i]
    setSelected(i); setPattern(ex.pattern); setFlags(ex.flags); setTestStr(ex.test)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--accent-mauve)' }}>⚡ Regex Playground</span>
        <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
          style={{ background: matches.length > 0 ? 'var(--accent-green)22' : 'var(--bg-surface0)', color: matches.length > 0 ? 'var(--accent-green)' : 'var(--text-subtle)', border: `1px solid ${matches.length > 0 ? 'var(--accent-green)44' : 'var(--border)'}` }}>
          {matches.length > 0 ? `● ${matches.length} match${matches.length !== 1 ? 'es' : ''}` : '○ no matches'}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Examples:</span>
        {EXAMPLES.map((ex, i) => (
          <button key={ex.name} onClick={() => loadExample(i)}
            className="text-xs px-2 py-0.5 rounded transition-all"
            style={{ background: selected === i ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: selected === i ? 'white' : 'var(--text-muted)', border: `1px solid ${selected === i ? 'var(--accent-mauve)' : 'var(--border)'}` }}>
            {ex.name}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={onClose} className="px-3 py-1 rounded text-xs" style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>✕ Close</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — editor */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
          {/* Pattern input */}
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Pattern</p>
            <div className="flex gap-2 items-center">
              <span style={{ color: 'var(--text-subtle)', fontSize: 18 }}>/</span>
              <input value={pattern} onChange={e => setPattern(e.target.value)} spellCheck={false}
                className="flex-1 px-2 py-1.5 rounded text-sm outline-none font-mono"
                style={{ background: 'var(--bg-surface0)', color: error ? 'var(--accent-red)' : 'var(--accent-mauve)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}` }} />
              <span style={{ color: 'var(--text-subtle)', fontSize: 18 }}>/</span>
              <input value={flags} onChange={e => setFlags(e.target.value)} placeholder="gi"
                className="w-16 px-2 py-1.5 rounded text-sm outline-none font-mono text-center"
                style={{ background: 'var(--bg-surface0)', color: 'var(--accent-blue)', border: '1px solid var(--border)' }} />
            </div>
            {error && <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>⚠ {error}</p>}
          </div>

          {/* Test string */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Test string</p>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{testStr.length} chars</span>
            </div>
            <div className="relative flex-1 overflow-hidden">
              {/* Highlighted layer */}
              <div className="absolute inset-0 px-4 py-3 text-sm font-mono whitespace-pre-wrap break-words pointer-events-none overflow-auto"
                style={{ color: 'transparent', fontFamily: settings.fontFamily, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: highlighted }} />
              {/* Textarea */}
              <textarea value={testStr} onChange={e => setTestStr(e.target.value)} spellCheck={false}
                className="absolute inset-0 w-full h-full px-4 py-3 text-sm font-mono outline-none resize-none bg-transparent"
                style={{ color: 'var(--text)', fontFamily: settings.fontFamily, lineHeight: 1.7, caretColor: 'var(--accent-blue)' }} />
            </div>
          </div>
        </div>

        {/* Right — matches panel */}
        <div className="flex flex-col overflow-hidden" style={{ width: 300, background: 'var(--bg-mantle)' }}>
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Matches <span style={{ color: 'var(--accent-mauve)' }}>({matches.length})</span>
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {matches.length === 0 && !error && (
              <p className="text-xs text-center py-8" style={{ color: 'var(--text-subtle)' }}>No matches yet</p>
            )}
            {matches.map((m, i) => (
              <div key={i} className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface0)' }}>
                <div className="flex items-center justify-between px-2 py-1" style={{ background: 'var(--accent-mauve)22' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>Match {i + 1}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>idx: {m.index}</span>
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--accent-green)' }}>{m[0] || '(empty)'}</p>
                  {m.length > 1 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {Array.from({ length: m.length - 1 }, (_, j) => (
                        <p key={j} className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--accent-blue)' }}>Group {j + 1}:</span> {m[j + 1] ?? 'undefined'}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick reference */}
          <div className="px-3 py-2 flex-shrink-0 overflow-y-auto" style={{ borderTop: '1px solid var(--border)', maxHeight: 200 }}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Quick Reference</p>
            {[
              ['.', 'any char'],['\\d', 'digit'],['\\w', 'word char'],['\\s', 'whitespace'],
              ['^', 'start'],['$', 'end'],['*', '0 or more'],['+', '1 or more'],
              ['?', '0 or 1'],['|', 'or'],['()', 'group'],['[]', 'character class'],
              ['{n,m}', 'repeat n–m times'],['(?:)', 'non-capturing'],['\\b', 'word boundary'],
            ].map(([sym, desc]) => (
              <div key={sym} className="flex gap-2 py-0.5">
                <code className="text-xs flex-shrink-0 w-16" style={{ color: 'var(--accent-mauve)', fontFamily: 'monospace' }}>{sym}</code>
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
