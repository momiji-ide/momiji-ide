import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { detectLanguage } from '../../utils/languageDetect'

interface Snippet {
  id: string
  title: string
  description: string
  code: string
  language: string
  tags: string[]
  createdAt: number
}

const STORAGE_KEY = 'parallax:snippets'

function loadSnippets(): Snippet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveSnippets(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
}

export function SnippetManager() {
  const { tabs, activeTabId, openTab } = useAppStore()
  const [snippets, setSnippets] = useState<Snippet[]>(loadSnippets)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'create'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', code: '', language: 'javascript', tags: '' })
  const [copied, setCopied] = useState<string | null>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  useEffect(() => {
    saveSnippets(snippets)
  }, [snippets])

  const filteredSnippets = snippets.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.title.toLowerCase().includes(q) || s.language.includes(q) || s.tags.some((t) => t.includes(q)) || s.description.toLowerCase().includes(q)
  })

  const handleCreate = () => {
    if (!form.title.trim() || !form.code.trim()) return
    const snippet: Snippet = {
      id: `snippet-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      code: form.code.trim(),
      language: form.language,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now()
    }
    if (editingId) {
      setSnippets((prev) => prev.map((s) => s.id === editingId ? { ...snippet, id: editingId } : s))
    } else {
      setSnippets((prev) => [snippet, ...prev])
    }
    setForm({ title: '', description: '', code: '', language: 'javascript', tags: '' })
    setEditingId(null)
    setView('list')
  }

  const handleDelete = (id: string) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id))
  }

  const handleEdit = (snippet: Snippet) => {
    setForm({
      title: snippet.title,
      description: snippet.description,
      code: snippet.code,
      language: snippet.language,
      tags: snippet.tags.join(', ')
    })
    setEditingId(snippet.id)
    setView('create')
  }

  const handleInsert = (snippet: Snippet) => {
    if (!activeTab) return
    const newContent = activeTab.content + '\n\n' + snippet.code
    openTab(activeTab.filePath, activeTab.fileName, newContent)
  }

  const handleCopyFromEditor = () => {
    if (!activeTab) return
    setForm({
      title: activeTab.fileName,
      description: '',
      code: activeTab.content,
      language: activeTab.language,
      tags: activeTab.language
    })
    setView('create')
  }

  const handleCopy = async (snippet: Snippet) => {
    await navigator.clipboard.writeText(snippet.code)
    setCopied(snippet.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleNewSnippet = () => {
    setForm({ title: '', description: '', code: '', language: activeTab?.language ?? 'javascript', tags: '' })
    setEditingId(null)
    setView('create')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-3 py-2 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          📋 Snippets
        </span>
        <div className="flex gap-1">
          {activeTab && (
            <button onClick={handleCopyFromEditor}
              className="text-xs px-2 py-0.5 rounded transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              title="Save current file as snippet">
              + From Editor
            </button>
          )}
          <button onClick={handleNewSnippet}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}>
            + New
          </button>
        </div>
      </div>

      {view === 'list' && (
        <>
          {/* Search */}
          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search snippets..."
              className="w-full px-2 py-1.5 rounded text-xs outline-none"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {filteredSnippets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <span className="text-3xl">📋</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {snippets.length === 0 ? 'No snippets yet.\nCreate one to get started!' : 'No results found.'}
                </p>
              </div>
            )}
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="rounded-lg p-2.5 flex flex-col gap-2 group"
                style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {snippet.title}
                    </p>
                    {snippet.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {snippet.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--accent-blue)' }}
                  >
                    {snippet.language}
                  </span>
                </div>

                <pre
                  className="text-xs p-2 rounded overflow-hidden"
                  style={{
                    background: 'var(--bg-crust)',
                    color: 'var(--accent-green)',
                    fontFamily: 'monospace',
                    maxHeight: '80px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {snippet.code.slice(0, 200)}{snippet.code.length > 200 ? '...' : ''}
                </pre>

                {snippet.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {snippet.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)' }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-1">
                  <button onClick={() => handleCopy(snippet)}
                    className="flex-1 py-1 rounded text-xs transition-all"
                    style={{ background: copied === snippet.id ? 'var(--accent-green)' : 'var(--bg-surface1)', color: copied === snippet.id ? 'var(--bg-base)' : 'var(--text-muted)' }}>
                    {copied === snippet.id ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  {activeTab && (
                    <button onClick={() => handleInsert(snippet)}
                      className="flex-1 py-1 rounded text-xs transition-all"
                      style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--bg-base)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                      Insert
                    </button>
                  )}
                  <button onClick={() => handleEdit(snippet)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)' }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(snippet.id)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--accent-red)' }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'create' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {editingId ? 'Edit Snippet' : 'New Snippet'}
          </p>

          {[
            { key: 'title', label: 'Title *', placeholder: 'My snippet' },
            { key: 'description', label: 'Description', placeholder: 'What does this do?' },
            { key: 'tags', label: 'Tags (comma separated)', placeholder: 'react, hooks, typescript' }
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="px-2 py-1.5 rounded text-xs outline-none"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="px-2 py-1.5 rounded text-xs outline-none"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {['javascript', 'typescript', 'python', 'go', 'rust', 'html', 'css', 'json', 'shell', 'plaintext'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Code *</label>
            <textarea
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="// paste your code here..."
              rows={8}
              className="px-2 py-1.5 rounded text-xs outline-none resize-none"
              style={{ background: 'var(--bg-surface0)', color: 'var(--accent-green)', border: '1px solid var(--border)', fontFamily: 'monospace' }}
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setView('list'); setEditingId(null) }}
              className="flex-1 py-2 rounded text-xs transition-all"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button onClick={handleCreate}
              className="flex-1 py-2 rounded text-xs font-medium transition-all"
              style={{
                background: form.title && form.code ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                color: form.title && form.code ? 'var(--bg-base)' : 'var(--text-muted)'
              }}>
              {editingId ? 'Save Changes' : 'Create Snippet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
