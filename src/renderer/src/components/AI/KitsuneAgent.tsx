import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import { ModelSelector } from './ModelSelector'
import { AgentManager, BUILTIN_AGENTS } from './AgentManager'
import kitsuneNormal  from '../../assets/kitsune-normal.png'
import kitsuneHappy   from '../../assets/kitsune-happy.png'
import kitsuneConfuse from '../../assets/kitsune-confuse.png'

// ─── Context window sizes ─────────────────────────────────────────────────────
const CONTEXT_WINDOWS: Record<string, number> = {
  // Claude
  'claude-haiku-4-5': 200_000, 'claude-sonnet-4-5': 200_000, 'claude-opus-4-5': 200_000,
  // Gemini
  'gemini-3.1-flash-lite': 1_048_576, 'gemini-3-flash': 1_048_576,
  'gemini-2.5-flash-preview-05-20': 1_048_576, 'gemini-2.5-pro-preview-05-06': 2_000_000,
  // OpenAI
  'gpt-4o': 128_000, 'gpt-4o-mini': 128_000, 'o3-mini': 200_000, 'o1-mini': 128_000,
  // Groq
  'llama-3.3-70b-versatile': 128_000, 'llama-3.1-8b-instant': 128_000,
  'mixtral-8x7b-32768': 32_768, 'gemma2-9b-it': 8_192,
  // DeepSeek
  'deepseek-chat': 64_000, 'deepseek-reasoner': 64_000,
  // Mistral
  'mistral-small-latest': 32_000, 'mistral-large-latest': 128_000, 'codestral-latest': 32_000,
}
function getCtxWindow(model: string) {
  if (CONTEXT_WINDOWS[model]) return CONTEXT_WINDOWS[model]
  if (model.includes('gemini')) return 1_048_576
  if (model.includes('claude')) return 200_000
  if (model.includes('llama') || model.includes('deepseek')) return 128_000
  return 32_000
}
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(n)
}

// ─── Agent stats bar ──────────────────────────────────────────────────────────
function AgentStatsBar({ tokensIn, tokensOut, model, elapsed, toolCalls, filesWritten }: {
  tokensIn: number; tokensOut: number; model: string; elapsed: number; toolCalls: number; filesWritten: number
}) {
  const total   = getCtxWindow(model)
  const used    = tokensIn + tokensOut
  const pct     = Math.min(100, (used / total) * 100)
  const remain  = Math.max(0, total - used)
  const barColor = pct > 85 ? 'var(--accent-red)' : pct > 60 ? 'var(--accent-yellow)' : 'var(--accent-mauve)'
  const secs    = (elapsed / 1000).toFixed(1)

  return (
    <div className="flex-shrink-0 px-3 py-2 flex flex-col gap-1.5" style={{ background: 'var(--bg-crust)', borderTop: '1px solid var(--border)' }}>
      {/* Context bar */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, color: 'var(--text-subtle)', flexShrink: 0 }}>Context</span>
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-surface1)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <span className="font-mono" style={{ fontSize: 10, color: barColor, flexShrink: 0 }}>
          {fmtK(used)} / {fmtK(total)}
        </span>
      </div>
      {/* Stats row */}
      <div className="flex gap-3 flex-wrap" style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
        <span style={{ color: barColor }}>● {pct.toFixed(1)}% used</span>
        <span>↓ {fmtK(remain)} left</span>
        <span>↑ {fmtK(tokensIn)} in</span>
        <span>↓ {fmtK(tokensOut)} out</span>
        <span>⏱ {secs}s</span>
        <span>🔧 {toolCalls} calls</span>
        {filesWritten > 0 && <span style={{ color: 'var(--accent-green)' }}>✏️ {filesWritten} files written</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)' }}>{model}</span>
      </div>
    </div>
  )
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const CLAUDE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the full contents of a file. Use this to understand existing code before editing.',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute or project-relative file path' } }, required: ['path'] }
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file with new content. Use this to create or edit files.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Full file content to write' } }, required: ['path', 'content'] }
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory to understand project structure.',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Directory path' } }, required: ['path'] }
  },
  {
    name: 'search_in_files',
    description: 'Search for a text/pattern across all files in the project.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, case_sensitive: { type: 'boolean' } }, required: ['query'] }
  },
  {
    name: 'create_folder',
    description: 'Create a new directory/folder.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'delete_file',
    description: 'Delete a file. Use with caution.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
]

const GEMINI_TOOLS = {
  function_declarations: [
    { name: 'read_file',      description: 'Read file contents',         parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'write_file',     description: 'Write content to a file',    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['path', 'content'] } },
    { name: 'list_directory', description: 'List directory contents',    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'search_in_files',description: 'Search text across files',   parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, case_sensitive: { type: 'BOOLEAN' } }, required: ['query'] } },
    { name: 'create_folder',  description: 'Create a folder',            parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
    { name: 'delete_file',    description: 'Delete a file',              parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
  ]
}

// ─── Activity log item ────────────────────────────────────────────────────────
interface ActivityItem {
  id: number
  type: 'tool' | 'info' | 'result' | 'error' | 'file_change'
  tool?: string
  args?: Record<string, any>
  result?: string
  status: 'running' | 'done' | 'error'
}

let actId = 0

// ─── File diff viewer ─────────────────────────────────────────────────────────
function FileDiffPreview({ path, content, onApprove, onDeny }: {
  path: string; content: string
  onApprove: () => void; onDeny: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const name = path.split(/[\\/]/).pop() ?? path
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--accent-yellow)44', background: 'var(--bg-surface0)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--accent-yellow)11', borderBottom: '1px solid var(--accent-yellow)33' }}>
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--accent-yellow)' }}>✏️ {name}</span>
        <button onClick={() => setExpanded(v => !v)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--text-subtle)', background: 'var(--bg-surface1)' }}>
          {expanded ? '▲ hide' : '▼ preview'}
        </button>
        <button onClick={onApprove} className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>✓ Apply</button>
        <button onClick={onDeny} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)', border: '1px solid var(--accent-red)44' }}>✕ Skip</button>
      </div>
      {expanded && (
        <pre className="p-2 text-xs overflow-x-auto overflow-y-auto" style={{ maxHeight: 200, color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
          {content.slice(0, 3000)}{content.length > 3000 ? '\n… (truncated)' : ''}
        </pre>
      )}
      <p className="px-3 py-1 text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{path}</p>
    </div>
  )
}

// ─── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false)
  const ICONS: Record<string, string> = {
    read_file: '📖', write_file: '✏️', list_directory: '📁',
    search_in_files: '🔍', create_folder: '📂', delete_file: '🗑️',
    info: '💬', error: '❌'
  }
  const icon = ICONS[item.tool ?? item.type] ?? '🔧'
  const shortPath = (item.args?.path as string ?? '').split(/[\\/]/).slice(-2).join('/')

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 py-1 px-2 rounded"
        style={{ background: item.status === 'error' ? 'var(--accent-red)11' : item.status === 'running' ? 'var(--accent-mauve)08' : 'transparent' }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span className="flex-1 text-xs truncate" style={{ color: item.status === 'error' ? 'var(--accent-red)' : item.status === 'running' ? 'var(--accent-mauve)' : 'var(--text-muted)' }}>
          {item.tool
            ? <><span style={{ color: 'var(--accent-mauve)' }}>{item.tool}</span>{shortPath ? <span style={{ color: 'var(--text-subtle)' }}> · {shortPath}</span> : null}{item.args?.query ? <span style={{ color: 'var(--text-subtle)' }}> · "{item.args.query}"</span> : null}</>
            : item.result?.slice(0, 80)
          }
        </span>
        {item.status === 'running' && <span className="text-xs animate-spin" style={{ color: 'var(--accent-mauve)' }}>⟳</span>}
        {item.status === 'done' && <span style={{ color: 'var(--accent-green)', fontSize: 10 }}>✓</span>}
        {item.result && item.type !== 'info' && (
          <button onClick={() => setExpanded(v => !v)} className="text-xs" style={{ color: 'var(--text-subtle)' }}>{expanded ? '▲' : '▼'}</button>
        )}
      </div>
      {expanded && item.result && (
        <pre className="px-3 py-1.5 rounded text-xs overflow-x-auto" style={{ background: 'var(--bg-crust)', color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 150, fontSize: 10 }}>
          {item.result.slice(0, 2000)}
        </pre>
      )}
    </div>
  )
}

// ─── Main Agent component ─────────────────────────────────────────────────────
export function KitsuneAgent() {
  const { aiProviders, currentFolder, fileTree, updateTabContent, markTabClean, openTab, customAgents } = useAppStore()
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pendingWrites, setPendingWrites] = useState<{ path: string; content: string; resolve: (v: boolean) => void }[]>([])
  const [finalMessage, setFinalMessage] = useState('')
  const [autoApprove, setAutoApprove] = useState(false)

  // ── Agent selection ─────────────────────────────────────────────────────────
  const [selectedAgentId, setSelectedAgentId] = useState(BUILTIN_AGENTS[0].id)
  const allAgents = [...BUILTIN_AGENTS, ...customAgents]
  const selectedAgent = allAgents.find(a => a.id === selectedAgentId) ?? BUILTIN_AGENTS[0]

  const buildAgentSystemPrompt = () => {
    const base = selectedAgent.systemPrompt
    const folder = `\n\nProject folder: ${currentFolder ?? '(no folder open)'}`
    const workflow = `\n\nYou MUST use tools to complete tasks — do not just describe what you'd do, actually do it.\n\nWorkflow:\n1. Start with list_directory to understand the project\n2. Read relevant files with read_file before editing\n3. Write/create files with write_file\n4. Verify with read_file if needed\n5. Give a final summary of what was done\n\nNever skip tool calls. Always execute, don't describe.`
    return base + folder + workflow
  }
  // Stats
  const [statsTokensIn,  setStatsTokensIn]  = useState(0)
  const [statsTokensOut, setStatsTokensOut] = useState(0)
  const [statsElapsed,   setStatsElapsed]   = useState(0)
  const [statsToolCalls, setStatsToolCalls] = useState(0)
  const [statsFilesWritten, setStatsFilesWritten] = useState(0)
  const startTimeRef = useRef(0)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef(false)
  const activitiesEndRef = useRef<HTMLDivElement>(null)

  const [selectedProviderId, setSelectedProviderId] = useState(
    () => aiProviders.find(p => p.enabled && p.apiKey)?.id ?? 'gemini'
  )
  const [kitsuneExpr, setKitsuneExpr] = useState<'normal' | 'thinking' | 'happy'>('normal')
  const [pastedImages, setPastedImages] = useState<{ base64: string; mediaType: string; preview: string }[]>([])
  const enabledProviders = aiProviders.filter(p => p.enabled && (p.apiKey || p.id === 'ollama'))
  const activeProvider   = enabledProviders.find(p => p.id === selectedProviderId) ?? enabledProviders[0]

  const startTimer = () => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => setStatsElapsed(Date.now() - startTimeRef.current), 300)
  }
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setStatsElapsed(Date.now() - startTimeRef.current)
  }

  const addAct = (item: Omit<ActivityItem, 'id'>) => {
    const entry = { ...item, id: actId++ }
    setActivities(prev => [...prev, entry])
    setTimeout(() => activitiesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return entry.id
  }
  const updateAct = (id: number, patch: Partial<ActivityItem>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  // ── Execute tool call ─────────────────────────────────────────────────────
  const executeTool = async (name: string, args: Record<string, any>): Promise<string> => {
    setStatsToolCalls(c => c + 1)
    const actId_ = addAct({ type: 'tool', tool: name, args, status: 'running' })

    try {
      let result = ''

      if (name === 'read_file') {
        const path = args.path.startsWith('/') || /^[A-Z]:/i.test(args.path)
          ? args.path
          : `${currentFolder}/${args.path}`
        const r = await window.api.fs.readFile(path)
        result = r.content !== null ? r.content : `Error: could not read file at ${path}`
        updateAct(actId_, { status: r.content !== null ? 'done' : 'error', result: result.slice(0, 500) + (result.length > 500 ? '…' : '') })

      } else if (name === 'write_file') {
        const path = args.path.startsWith('/') || /^[A-Z]:/i.test(args.path)
          ? args.path
          : `${currentFolder}/${args.path}`

        if (autoApprove) {
          await window.api.fs.writeFile(path, args.content)
          setStatsFilesWritten(c => c + 1)
          const tabs = useAppStore.getState().tabs
          const tab = tabs.find(t => t.filePath === path)
          if (tab) { updateTabContent(tab.id, args.content); markTabClean(tab.id) }
          result = `Written: ${path}`
          updateAct(actId_, { status: 'done', result })
        } else {
          // Ask user to approve
          result = await new Promise<string>(resolve => {
            setPendingWrites(prev => [...prev, {
              path, content: args.content,
              resolve: async (approved) => {
                if (approved) {
                  await window.api.fs.writeFile(path, args.content)
                  const tabs = useAppStore.getState().tabs
                  const tab = tabs.find(t => t.filePath === path)
                  if (tab) { updateTabContent(tab.id, args.content); markTabClean(tab.id) }
                  resolve(`Written: ${path}`)
                  updateAct(actId_, { status: 'done', result: `Written: ${path}` })
                } else {
                  resolve(`Skipped by user: ${path}`)
                  updateAct(actId_, { status: 'error', result: `Skipped` })
                }
                setPendingWrites(prev => prev.filter(w => w.path !== path))
              }
            }])
          })
        }

      } else if (name === 'list_directory') {
        const path = args.path === '.' || args.path === './'
          ? currentFolder!
          : args.path.startsWith('/') || /^[A-Z]:/i.test(args.path) ? args.path : `${currentFolder}/${args.path}`
        const tree = await window.api.fs.readDir(path)

        const format = (nodes: any[], indent = 0): string =>
          nodes.map(n => `${'  '.repeat(indent)}${n.isDirectory ? '📁' : '📄'} ${n.name}${n.children ? '\n' + format(n.children, indent + 1) : ''}`).join('\n')

        result = tree ? format(tree) : `Error: could not read directory`
        updateAct(actId_, { status: 'done', result: result.slice(0, 300) })

      } else if (name === 'search_in_files') {
        if (!currentFolder) return 'No folder open'
        const results = await window.api.search.inFiles(currentFolder, args.query, { caseSensitive: args.case_sensitive ?? false, useRegex: false })
        result = results?.length
          ? results.slice(0, 20).map((r: any) => `${r.file}:${r.line}: ${r.text.trim()}`).join('\n')
          : 'No matches found'
        updateAct(actId_, { status: 'done', result: result.slice(0, 400) })

      } else if (name === 'create_folder') {
        const path = args.path.startsWith('/') || /^[A-Z]:/i.test(args.path) ? args.path : `${currentFolder}/${args.path}`
        await window.api.fs.createFolder(path)
        result = `Created folder: ${path}`
        updateAct(actId_, { status: 'done', result })

      } else if (name === 'delete_file') {
        const path = args.path.startsWith('/') || /^[A-Z]:/i.test(args.path) ? args.path : `${currentFolder}/${args.path}`
        await window.api.fs.delete(path)
        result = `Deleted: ${path}`
        updateAct(actId_, { status: 'done', result })
      }

      return result || 'Done'
    } catch (e: any) {
      const err = `Error: ${e.message}`
      updateAct(actId_, { status: 'error', result: err })
      return err
    }
  }

  // ── Claude agentic loop ───────────────────────────────────────────────────
  const runClaudeAgent = async (provider: typeof aiProviders[0], taskText: string, images: typeof pastedImages) => {
    const sysPrompt = buildAgentSystemPrompt()

    // Build first message — include images if any were pasted
    const firstContent: any[] = [
      ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } })),
      { type: 'text', text: taskText }
    ]
    const messages: any[] = [{ role: 'user', content: images.length > 0 ? firstContent : taskText }]
    let iterations = 0
    const MAX_ITER = 20

    while (!abortRef.current && iterations < MAX_ITER) {
      iterations++
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: provider.model, max_tokens: 4096, system: sysPrompt, tools: CLAUDE_TOOLS, messages })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error?.message ?? 'Claude error')

      // Accumulate token counts
      if (data.usage) {
        setStatsTokensIn(data.usage.input_tokens ?? 0)
        setStatsTokensOut(t => t + (data.usage.output_tokens ?? 0))
      }

      messages.push({ role: 'assistant', content: data.content })

      // Check for text content to show
      const textBlock = data.content.find((b: any) => b.type === 'text')
      if (textBlock) addAct({ type: 'info', result: textBlock.text, status: 'done' })

      if (data.stop_reason === 'end_turn' || !data.content.some((b: any) => b.type === 'tool_use')) {
        if (textBlock) setFinalMessage(textBlock.text)
        break
      }
      if (iterations >= MAX_ITER) { addAct({ type: 'info', result: '⚠️ Reached max iterations (20)', status: 'done' }); break }

      // Execute all tool calls
      const toolResults: any[] = []
      for (const block of data.content) {
        if (block.type !== 'tool_use' || abortRef.current) continue
        const result = await executeTool(block.name, block.input)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }

  // ── Gemini agentic loop ───────────────────────────────────────────────────
  const runGeminiAgent = async (provider: typeof aiProviders[0], taskText: string, images: typeof pastedImages) => {
    const sysPrompt = buildAgentSystemPrompt()

    // Build first message — include images if any were pasted
    const firstParts: any[] = [
      ...images.map(img => ({ inline_data: { mime_type: img.mediaType, data: img.base64 } })),
      { text: taskText }
    ]
    const contents: any[] = [{ role: 'user', parts: firstParts }]
    let iterations = 0
    const MAX_ITER = 20

    while (!abortRef.current && iterations < MAX_ITER) {
      iterations++
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysPrompt }] },
          tools: [GEMINI_TOOLS],
          tool_config: { function_calling_config: { mode: 'AUTO' } },
          contents
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error?.message ?? `Gemini error: ${JSON.stringify(data)}`)

      const candidate = data.candidates?.[0]
      if (!candidate) throw new Error('No response from Gemini')

      // Accumulate token counts
      const usage = data.usageMetadata
      if (usage) {
        setStatsTokensIn(usage.promptTokenCount ?? 0)
        setStatsTokensOut(t => t + (usage.candidatesTokenCount ?? 0))
      }

      const parts = candidate.content?.parts ?? []
      contents.push({ role: 'model', parts })

      const textPart = parts.find((p: any) => p.text)
      const fnCalls  = parts.filter((p: any) => p.functionCall)

      // Show text reasoning
      if (textPart?.text) addAct({ type: 'info', result: textPart.text, status: 'done' })

      // No tool calls → agent is done
      if (fnCalls.length === 0) {
        if (textPart?.text) setFinalMessage(textPart.text)
        break
      }

      // Execute tool calls
      const fnResults: any[] = []
      for (const part of fnCalls) {
        if (abortRef.current) break
        const result = await executeTool(part.functionCall.name, part.functionCall.args ?? {})
        fnResults.push({ functionResponse: { name: part.functionCall.name, response: { result } } })
      }
      contents.push({ role: 'user', parts: fnResults })
    }

    if (iterations >= MAX_ITER) addAct({ type: 'info', result: '⚠️ Reached max iterations (20)', status: 'done' })
  }

  // ── Ollama agentic loop (OpenAI-compatible tool calling) ─────────────────
  const runOllamaAgent = async (provider: typeof aiProviders[0], taskText: string) => {
    const base = provider.baseUrl ?? 'http://localhost:11434'
    const sysPrompt = buildAgentSystemPrompt()

    const tools = CLAUDE_TOOLS.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema }
    }))

    const messages: any[] = [{ role: 'user', content: taskText }]
    let iterations = 0

    while (!abortRef.current && iterations < 20) {
      iterations++
      const resp = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: sysPrompt }, ...messages], tools, tool_choice: 'auto' })
      })
      if (!resp.ok) throw new Error(`Ollama error ${resp.status} — is Ollama running? Run: ollama serve`)
      const data = await resp.json()
      const msg = data.choices[0].message

      if (data.usage) { setStatsTokensIn(data.usage.prompt_tokens ?? 0); setStatsTokensOut(t => t + (data.usage.completion_tokens ?? 0)) }
      if (msg.content) addAct({ type: 'info', result: msg.content, status: 'done' })
      messages.push(msg)

      if (!msg.tool_calls?.length) { if (msg.content) setFinalMessage(msg.content); break }

      const toolResults: any[] = []
      for (const tc of msg.tool_calls) {
        if (abortRef.current) break
        const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
        const result = await executeTool(tc.function.name, args)
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
      messages.push(...toolResults)
    }
  }

  // ── Run agent ─────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!task.trim() || running || !activeProvider || !currentFolder) return
    const imageSnapshot = [...pastedImages]   // snapshot before clearing
    setRunning(true)
    setKitsuneExpr('thinking')
    abortRef.current = false
    setActivities([])
    setFinalMessage('')
    setPendingWrites([])
    setPastedImages([])

    addAct({ type: 'info', result: `🦊 Kitsune Agent started: "${task}"${imageSnapshot.length ? ` (+${imageSnapshot.length} image${imageSnapshot.length > 1 ? 's' : ''})` : ''}`, status: 'done' })

    // Reset stats + start timer
    setStatsTokensIn(0); setStatsTokensOut(0)
    setStatsToolCalls(0); setStatsFilesWritten(0)
    startTimer()

    addAct({ type: 'info', result: `Using: ${activeProvider.name} · ${activeProvider.model}`, status: 'done' })

    try {
      if (activeProvider.id === 'claude') await runClaudeAgent(activeProvider, task, imageSnapshot)
      else if (activeProvider.id === 'gemini') await runGeminiAgent(activeProvider, task, imageSnapshot)
      else if (activeProvider.id === 'ollama') await runOllamaAgent(activeProvider, task)
      else if (['groq','openrouter','deepseek','mistral','openai'].includes(activeProvider.id)) {
        // OpenAI-compatible providers — use Ollama runner with custom base URL
        const compat = {
          ...activeProvider,
          baseUrl: activeProvider.id === 'groq' ? 'https://api.groq.com/openai'
            : activeProvider.id === 'openrouter' ? 'https://openrouter.ai/api'
            : activeProvider.id === 'deepseek'   ? 'https://api.deepseek.com'
            : activeProvider.id === 'mistral'    ? 'https://api.mistral.ai'
            : 'https://api.openai.com',
        }
        await runOllamaAgent(compat, task)
      }
      else addAct({ type: 'error', result: 'No supported AI provider enabled. Configure one in ⚙️ Settings.', status: 'error' })
    } catch (e: any) {
      addAct({ type: 'error', result: `❌ ${e.message}`, status: 'error' })
    }

    stopTimer()
    setRunning(false)

    if (!abortRef.current) {
      addAct({ type: 'info', result: '✅ Agent finished', status: 'done' })

      // Happy expression for 4 seconds
      setKitsuneExpr('happy')
      setTimeout(() => setKitsuneExpr('normal'), 4000)

      // System notification
      if (Notification.permission === 'granted') {
        new Notification('🦊 Kitsune Agent Done!', {
          body: `Task completed: "${task.slice(0, 80)}${task.length > 80 ? '...' : ''}"`,
          icon: kitsuneHappy,
          silent: false,
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification('🦊 Kitsune Agent Done!', {
            body: `Task completed: "${task.slice(0, 80)}${task.length > 80 ? '...' : ''}"`,
          })
        })
      }
    } else {
      setKitsuneExpr('normal')
    }
  }, [task, running, activeProvider, currentFolder, autoApprove, pastedImages])

  const handleStop = () => { abortRef.current = true; setRunning(false); setKitsuneExpr('normal') }

  // ── Image paste handler ───────────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(it => it.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const base64  = dataUrl.split(',')[1]
      setPastedImages(prev => [...prev, { base64, mediaType: imageItem.type, preview: dataUrl }])
    }
    reader.readAsDataURL(file)
  }

  // ── Approve/deny pending write ────────────────────────────────────────────
  const handleWriteDecision = (path: string, approved: boolean) => {
    const pending = pendingWrites.find(w => w.path === path)
    if (pending) pending.resolve(approved)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <img
            src={kitsuneExpr === 'thinking' ? kitsuneConfuse : kitsuneExpr === 'happy' ? kitsuneHappy : kitsuneNormal}
            style={{ width: 28, height: 28, objectFit: 'contain', transition: 'all 0.3s ease', flexShrink: 0 }}
            alt="Kitsune"
          />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--accent-mauve)' }}>KITSUNE AGENT</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)44', fontSize: 9 }}>BETA</span>
          {running && <span className="text-xs animate-pulse" style={{ color: 'var(--accent-green)', fontSize: 9 }}>● working</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} />
            Auto-approve writes
          </label>
        </div>
      </div>

      {/* Agent selector — horizontal chips + selected info */}
      <AgentManager
        selectedId={selectedAgentId}
        onSelect={setSelectedAgentId}
        compact
      />

      {/* No provider warning */}
      {enabledProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4 text-center">
          <KitsuneLogo size={40} />
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>No AI provider enabled</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable Claude or Gemini in ⚙️ Settings → AI & API Keys</p>
        </div>
      ) : !currentFolder ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
          <span style={{ fontSize: 40 }}>📁</span>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>No project folder open</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kitsune needs a folder to read and write files.</p>
          </div>
          <button
            onClick={async () => {
              const folder = await window.api.dialog.openFolder()
              if (folder) {
                useAppStore.getState().setCurrentFolder(folder)
                const tree = await window.api.fs.readDir(folder)
                useAppStore.getState().setFileTree(tree ?? [])
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            📂 Open Folder
          </button>
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
            Or use <kbd style={{ background: 'var(--bg-surface1)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>File → Open Folder</kbd>
          </p>
        </div>
      ) : (
        <>
          {/* Task input */}
          <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>What should Kitsune do?</p>
                <ModelSelector selectedProviderId={selectedProviderId} onProviderChange={setSelectedProviderId} />
              </div>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleRun() }}
                onPaste={handlePaste}
                placeholder="e.g. Add dark mode toggle to App.tsx... (Ctrl+V to paste image)"
                rows={3} disabled={running}
                className="w-full px-2 py-1.5 rounded text-xs resize-none outline-none"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              {/* Pasted image thumbnails */}
              {pastedImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pastedImages.map((img, i) => (
                    <div key={i} className="relative rounded overflow-hidden" style={{ width: 56, height: 56, border: '1px solid var(--accent-mauve)66' }}>
                      <img src={img.preview} alt={`img${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => setPastedImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-0 right-0 flex items-center justify-center"
                        style={{ width: 16, height: 16, background: 'var(--accent-red)', color: 'white', fontSize: 9, lineHeight: 1 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <span className="self-center text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                    {pastedImages.length} image{pastedImages.length > 1 ? 's' : ''} — will be sent with task
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {running ? (
                  <button onClick={handleStop} className="flex-1 py-1.5 rounded text-xs font-bold"
                    style={{ background: 'var(--accent-red)', color: 'white' }}>
                    ■ Stop Agent
                  </button>
                ) : (
                  <button onClick={handleRun} disabled={!task.trim()}
                    className="flex-1 py-1.5 rounded text-xs font-bold transition-all"
                    style={{ background: task.trim() ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: task.trim() ? 'white' : 'var(--text-muted)' }}>
                    🦊 Run Agent  <span style={{ opacity: 0.6, fontWeight: 400 }}>(Ctrl+Enter)</span>
                  </button>
                )}
                {activities.length > 0 && !running && (
                  <button onClick={() => { setActivities([]); setFinalMessage(''); setTask('') }}
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
            {/* Project info */}
            <p className="text-xs mt-2 truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
              📁 {currentFolder}
            </p>
          </div>

          {/* Pending writes (approval required) */}
          {pendingWrites.length > 0 && (
            <div className="flex-shrink-0 px-3 py-2 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--accent-yellow)08' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-yellow)' }}>⚠ Kitsune wants to write files — approve or skip:</p>
              {pendingWrites.map(w => (
                <FileDiffPreview key={w.path} path={w.path} content={w.content}
                  onApprove={() => handleWriteDecision(w.path, true)}
                  onDeny={() => handleWriteDecision(w.path, false)} />
              ))}
            </div>
          )}

          {/* Activity log */}
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
            {activities.length === 0 && !running && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center" style={{ color: 'var(--text-subtle)' }}>
                <KitsuneLogo size={40} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Kitsune Agent</p>
                <p className="text-xs" style={{ maxWidth: 200, lineHeight: 1.5 }}>
                  Give Kitsune a task and it will autonomously read, write and edit files in your project.
                </p>
                <div className="flex flex-col gap-1 text-left mt-2">
                  {[
                    'Add error handling to all API calls',
                    'Create a user authentication module',
                    'Refactor components to use TypeScript',
                    'Add unit tests for utils/helpers.ts',
                  ].map(ex => (
                    <button key={ex} onClick={() => setTask(ex)}
                      className="text-xs px-2 py-1.5 rounded-lg text-left transition-all"
                      style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-mauve)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activities.map(act => <ActivityRow key={act.id} item={act} />)}

            {/* Running spinner */}
            {running && (
              <div className="flex items-center gap-2 px-2 py-2">
                <img src={kitsuneConfuse} alt="thinking" style={{ width: 20, height: 20, objectFit: 'contain' }}
                  className="animate-bounce" />
                <span className="text-xs animate-pulse" style={{ color: 'var(--accent-mauve)' }}>Kitsune is working…</span>
              </div>
            )}

            {/* Final message */}
            {finalMessage && !running && (
              <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--accent-green)33' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--accent-green)' }}>✅ Done</p>
                <p style={{ lineHeight: 1.6 }}>{finalMessage}</p>
              </div>
            )}

            <div ref={activitiesEndRef} />
          </div>

          {/* Stats bar — shows after first run */}
          {(running || statsTokensIn > 0) && activeProvider && (
            <AgentStatsBar
              tokensIn={statsTokensIn}
              tokensOut={statsTokensOut}
              model={activeProvider.model}
              elapsed={statsElapsed}
              toolCalls={statsToolCalls}
              filesWritten={statsFilesWritten}
            />
          )}
        </>
      )}
    </div>
  )
}
