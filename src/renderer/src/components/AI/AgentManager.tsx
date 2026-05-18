import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AgentConfig } from '../../types'

// ─── Built-in agents (read-only, always available) ────────────────────────────
export const BUILTIN_AGENTS: AgentConfig[] = [
  {
    id: 'builtin-kitsune',
    name: 'Kitsune',
    emoji: '🦊',
    color: '#fb923c',
    description: 'General-purpose coding assistant. Sharp, precise, and a little playful.',
    systemPrompt: `You are Kitsune AI, the intelligent coding assistant built into Momiji IDE. You are sharp, precise, and a little playful — like a clever fox. You have full access to the filesystem and can read, write, and modify files to complete tasks autonomously. Plan before acting: think about what files to read first, then write changes. Always verify your work.`,
    tools: [],
    isBuiltIn: true,
  },
  {
    id: 'builtin-reviewer',
    name: 'Code Reviewer',
    emoji: '🔍',
    color: '#60a5fa',
    description: 'Expert code reviewer. Checks quality, performance, and best practices.',
    systemPrompt: `You are an expert code reviewer. Your job is to thoroughly review code and provide structured, actionable feedback. For each issue, classify it as: Critical / High / Medium / Low. Cover: correctness, performance, security, readability, maintainability, and test coverage. Be specific — point to exact lines and explain WHY it's an issue and HOW to fix it. End with a summary score 1–10 and top 3 priorities.`,
    tools: ['read_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-tester',
    name: 'Test Writer',
    emoji: '🧪',
    color: '#34d399',
    description: 'Writes comprehensive unit and integration tests for your code.',
    systemPrompt: `You are an expert test engineer. Your job is to write comprehensive, well-structured tests. Read the source code first, then write tests that cover: happy paths, edge cases, error cases, and boundary conditions. Use the appropriate test framework for the language (Jest/Vitest for JS/TS, pytest for Python, go test for Go, etc.). Write descriptive test names. Mock external dependencies. Aim for >90% coverage of critical paths.`,
    tools: ['read_file', 'write_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-docwriter',
    name: 'Doc Writer',
    emoji: '📝',
    color: '#a78bfa',
    description: 'Writes clear documentation, JSDoc, and README files.',
    systemPrompt: `You are a technical documentation expert. Your job is to write clear, accurate, and helpful documentation. For code: write JSDoc/docstrings for all public functions and classes. For projects: write README with setup instructions, usage examples, and API reference. Keep docs concise but complete. Use good examples. Assume the reader is an experienced developer unfamiliar with this specific codebase.`,
    tools: ['read_file', 'write_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-security',
    name: 'Security',
    emoji: '🔒',
    color: '#f87171',
    description: 'Scans for vulnerabilities, injection risks, and security issues.',
    systemPrompt: `You are a cybersecurity expert performing a security audit. Scan code for: SQL injection, XSS, CSRF, authentication flaws, hardcoded secrets, insecure dependencies, path traversal, command injection, broken access control, sensitive data exposure, and OWASP Top 10 issues. For each finding: severity (Critical/High/Medium/Low), description, affected code, and remediation steps. Also check dependencies for known CVEs if package.json/requirements.txt exists.`,
    tools: ['read_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-refactor',
    name: 'Refactor',
    emoji: '⚡',
    color: '#fbbf24',
    description: 'Refactors code for better structure, performance, and readability.',
    systemPrompt: `You are a refactoring expert. Your job is to improve code structure, readability, and performance without changing behavior. Apply: SOLID principles, DRY (Don't Repeat Yourself), extract functions/modules, improve naming, remove dead code, optimize loops and data structures, reduce complexity (cyclomatic complexity < 10 per function), and modernize syntax. Always read files first to understand context. Write the refactored code directly to files. Explain key changes made.`,
    tools: ['read_file', 'write_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
  {
    id: 'builtin-debugger',
    name: 'Bug Hunter',
    emoji: '🐛',
    color: '#f97316',
    description: 'Tracks down and fixes bugs. Provides root cause analysis.',
    systemPrompt: `You are an expert debugger. Given a bug description, systematically find and fix the root cause. Process: 1) Read relevant files to understand the code flow. 2) Identify the bug location and root cause. 3) Check for similar patterns elsewhere in the codebase. 4) Write a targeted fix. 5) Explain what caused the bug and why your fix works. Always fix the root cause, not just symptoms. After fixing, suggest what test would have caught this bug.`,
    tools: ['read_file', 'write_file', 'list_directory', 'search_in_files'],
    isBuiltIn: true,
  },
]

// ─── Empty agent template ─────────────────────────────────────────────────────
const EMPTY_AGENT: Omit<AgentConfig, 'id'> = {
  name: '',
  emoji: '🤖',
  color: '#60a5fa',
  description: '',
  systemPrompt: '',
  tools: [],
}

const TOOL_OPTIONS = [
  { id: 'read_file',       label: '📖 Read files' },
  { id: 'write_file',      label: '✏️ Write files' },
  { id: 'list_directory',  label: '📁 List dirs' },
  { id: 'search_in_files', label: '🔍 Search' },
  { id: 'create_folder',   label: '📂 Create folder' },
  { id: 'delete_file',     label: '🗑️ Delete files' },
]

const EMOJI_PICKS = ['🤖','🦊','🔍','🧪','📝','🔒','⚡','🐛','🎯','🧠','🛠️','🚀','💡','🔧','🌐','🎨']
const COLOR_PICKS = ['#fb923c','#60a5fa','#34d399','#a78bfa','#f87171','#fbbf24','#f97316','#e879f9','#22d3ee','#4ade80']

// ─── Agent form modal ─────────────────────────────────────────────────────────
function AgentFormModal({ initial, onSave, onClose }: {
  initial?: AgentConfig
  onSave: (a: AgentConfig) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<AgentConfig, 'id'>>(
    initial ? { ...initial } : { ...EMPTY_AGENT }
  )
  const [toolAll, setToolAll] = useState(form.tools.length === 0)

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const toggleTool = (id: string) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(id) ? f.tools.filter(t => t !== id) : [...f.tools, id]
    }))
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) return
    onSave({
      ...form,
      id: initial?.id ?? `custom-${Date.now()}`,
      tools: toolAll ? [] : form.tools,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div className="flex flex-col gap-4 p-5 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
           style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {initial ? 'Edit Agent' : 'New Agent'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Emoji + color + name row */}
        <div className="flex gap-3 items-start">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Icon</span>
            <div className="flex flex-wrap gap-1 w-32">
              {EMOJI_PICKS.map(e => (
                <button key={e} onClick={() => set({ emoji: e })}
                  className="w-7 h-7 rounded text-sm flex items-center justify-center transition-all"
                  style={{ background: form.emoji === e ? 'var(--bg-surface1)' : 'transparent', outline: form.emoji === e ? `2px solid ${form.color}` : 'none' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Name *</label>
              <input value={form.name} onChange={e => set({ name: e.target.value })}
                placeholder="e.g. API Designer"
                className="px-2.5 py-1.5 rounded text-xs outline-none"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_PICKS.map(c => (
                  <button key={c} onClick={() => set({ color: c })}
                    className="w-5 h-5 rounded-full transition-transform"
                    style={{ background: c, outline: form.color === c ? `3px solid ${c}` : '2px solid transparent', outlineOffset: 2, transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Description</label>
          <input value={form.description} onChange={e => set({ description: e.target.value })}
            placeholder="What does this agent do?"
            className="px-2.5 py-1.5 rounded text-xs outline-none"
            style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        {/* System prompt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>System Prompt *</label>
          <textarea value={form.systemPrompt} onChange={e => set({ systemPrompt: e.target.value })}
            placeholder="You are an expert at... Your job is to..."
            rows={6}
            className="px-2.5 py-1.5 rounded text-xs resize-none outline-none font-mono"
            style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        {/* Tools */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Tools Access</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={toolAll} onChange={e => setToolAll(e.target.checked)} />
            <span className="text-xs" style={{ color: 'var(--text)' }}>All tools (default)</span>
          </label>
          {!toolAll && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {TOOL_OPTIONS.map(t => (
                <button key={t.id} onClick={() => toggleTool(t.id)}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    background: form.tools.includes(t.id) ? form.color + '33' : 'var(--bg-surface1)',
                    border: `1px solid ${form.tools.includes(t.id) ? form.color : 'var(--border)'}`,
                    color: form.tools.includes(t.id) ? form.color : 'var(--text-muted)',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose}
            className="flex-1 py-1.5 rounded text-xs"
            style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={!form.name.trim() || !form.systemPrompt.trim()}
            className="flex-1 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{
              background: (!form.name.trim() || !form.systemPrompt.trim()) ? 'var(--bg-surface1)' : form.color,
              color: (!form.name.trim() || !form.systemPrompt.trim()) ? 'var(--text-subtle)' : '#fff',
            }}>
            {initial ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, selected, onSelect, onEdit, onDelete }: {
  agent: AgentConfig
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col gap-1 p-2.5 rounded-xl cursor-pointer transition-all select-none"
      style={{
        background: selected ? agent.color + '22' : hovered ? 'var(--bg-surface1)' : 'var(--bg-surface0)',
        border: `1px solid ${selected ? agent.color : 'var(--border)'}`,
        outline: selected ? `2px solid ${agent.color}44` : 'none',
        outlineOffset: 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 18 }}>{agent.emoji}</span>
        <span className="text-xs font-semibold truncate flex-1" style={{ color: selected ? agent.color : 'var(--text)' }}>
          {agent.name}
        </span>
        {/* edit/delete — only show on hover for custom agents */}
        {hovered && !agent.isBuiltIn && (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit}
              className="w-5 h-5 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }} title="Edit">
              ✏️
            </button>
            <button onClick={onDelete}
              className="w-5 h-5 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)' }} title="Delete">
              🗑️
            </button>
          </div>
        )}
        {selected && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: agent.color, boxShadow: `0 0 6px ${agent.color}` }} />
        )}
      </div>
      <p className="text-xs leading-snug" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
        {agent.description}
      </p>
    </div>
  )
}

// ─── Main export: Agent Manager panel + selector ──────────────────────────────
interface Props {
  selectedId: string
  onSelect: (id: string) => void
  compact?: boolean   // compact = just a row of chips (used at top of agent panel)
}

export function AgentManager({ selectedId, onSelect, compact = false }: Props) {
  const { customAgents, addAgent, updateAgent, deleteAgent } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AgentConfig | undefined>()
  const [showAll, setShowAll] = useState(false)

  const allAgents = [...BUILTIN_AGENTS, ...customAgents]
  const selected  = allAgents.find(a => a.id === selectedId) ?? BUILTIN_AGENTS[0]

  const handleSave = (agent: AgentConfig) => {
    if (customAgents.find(a => a.id === agent.id)) updateAgent(agent)
    else addAgent(agent)
    setShowForm(false)
    setEditTarget(undefined)
    onSelect(agent.id)
  }

  // ── Compact mode: wrap grid at top of KitsuneAgent ──────────────────────
  if (compact) {
    return (
      <>
        {/* Wrap grid — 3 cols so sidebar fits all agents cleanly */}
        <div className="flex-shrink-0 px-2 py-2"
             style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {allAgents.map(a => (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left"
                style={{
                  background: selectedId === a.id ? a.color + '28' : 'transparent',
                  border: `1px solid ${selectedId === a.id ? a.color : 'transparent'}`,
                  color: selectedId === a.id ? a.color : 'var(--text-muted)',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (selectedId !== a.id) e.currentTarget.style.background = 'var(--bg-surface0)'
                }}
                onMouseLeave={e => {
                  if (selectedId !== a.id) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>{a.emoji}</span>
                <span className="truncate" style={{ fontSize: 10 }}>{a.name}</span>
              </button>
            ))}
            {/* Add new agent */}
            <button
              onClick={() => { setEditTarget(undefined); setShowForm(true) }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: 'transparent',
                border: '1px dashed var(--bg-surface1)',
                color: 'var(--text-subtle)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-surface1)' }}
            >
              <span style={{ fontSize: 11 }}>＋</span>
              <span style={{ fontSize: 10 }}>New</span>
            </button>
          </div>
        </div>

        {/* Active agent info bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
             style={{ background: selected.color + '0e', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13 }}>{selected.emoji}</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold" style={{ color: selected.color }}>{selected.name}</span>
            <span className="text-xs ml-1.5 truncate" style={{ color: 'var(--text-subtle)' }}>{selected.description}</span>
          </div>
          {!selected.isBuiltIn && (
            <button
              onClick={() => { setEditTarget(selected); setShowForm(true) }}
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ color: 'var(--text-subtle)', background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
              Edit
            </button>
          )}
        </div>

        {showForm && (
          <AgentFormModal
            initial={editTarget}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditTarget(undefined) }}
          />
        )}
      </>
    )
  }

  // ── Full mode: grid of cards (not used currently, for future settings page) ─
  const visible = showAll ? allAgents : allAgents.slice(0, 6)
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-1 gap-2">
        {visible.map(a => (
          <AgentCard key={a.id} agent={a} selected={a.id === selectedId}
            onSelect={() => onSelect(a.id)}
            onEdit={() => { setEditTarget(a); setShowForm(true) }}
            onDelete={() => { deleteAgent(a.id); if (selectedId === a.id) onSelect(BUILTIN_AGENTS[0].id) }}
          />
        ))}
      </div>
      {allAgents.length > 6 && (
        <button onClick={() => setShowAll(v => !v)}
          className="text-xs py-1 rounded" style={{ color: 'var(--text-muted)' }}>
          {showAll ? '▲ Show less' : `▼ Show all (${allAgents.length})`}
        </button>
      )}
      <button onClick={() => { setEditTarget(undefined); setShowForm(true) }}
        className="py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
        + New Agent
      </button>
      {showForm && (
        <AgentFormModal initial={editTarget} onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(undefined) }} />
      )}
    </div>
  )
}
