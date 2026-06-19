import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { KitsuneMessage, KitsunePersona } from '../../types'
import { applyCodeToFile } from './chatRender'
import { BUILTIN_AGENTS } from '../AI/AgentManager'
import { CLAUDE_TOOLS, GEMINI_TOOLS, OPENAI_TOOLS, executeTool, buildToolsSystemSuffix, formatFileTree, extractFileBlocks, resolvePath } from './agentTools'

export interface AttachedImage {
  data: string
  mimeType: string
  preview: string
}

export interface AttachedFile {
  name: string
  path: string
  content: string
}

export interface AttachedFolder {
  name: string
  path: string
  listing: string
}

export interface PendingWrite {
  path: string
  content: string
  resolve: (approved: boolean) => void
}

let msgId = 0
const MAX_ITER = 20

// Persisted messages keep the ids they were created with, but the module-level
// msgId counter resets to 0 on every reload/HMR. Drop dead empty-content
// assistant bubbles left over from earlier bugs, then re-stamp with fresh
// sequential ids so `key={msg.id}` never collides with new messages.
const normalizeMsgIds = (msgs: KitsuneMessage[]): KitsuneMessage[] => {
  const cleaned = msgs.filter(m =>
    !(m.role === 'assistant' && !m.streaming && !m.content.trim()) &&
    !(m.role === 'tool' && m.toolStatus === 'running')
  )
  const needsFix = cleaned.some((m, i) => m.id !== i)
  msgId = Math.max(msgId, cleaned.length)
  return needsFix ? cleaned.map((m, i) => ({ ...m, id: i })) : cleaned
}

// ─── Convert any image to PNG via canvas (fixes MIME type issues) ─────────────
function convertImageToPng(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Max 1024px on longest side to stay within API limits
      const MAX = 1024
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')
      URL.revokeObjectURL(url)
      resolve({ data: dataUrl.split(',')[1], mimeType: 'image/png', preview: dataUrl })
    }
    img.onerror = reject
    img.src = url
  })
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

export const PERSONA_LABELS: Record<KitsunePersona, { icon: string; label: string }> = {
  beginner:  { icon: '🧒', label: 'Beginner' },
  developer: { icon: '⚡', label: 'Dev' },
  creative:  { icon: '🎨', label: 'Creative' },
}

const PERSONA_PROMPTS: Record<KitsunePersona, string> = {
  beginner: `You are Kitsune, a friendly AI companion in Momiji IDE. The user is a beginner or child. Rules:
- Always use real-world analogies (toys, food, everyday objects)
- Never use jargon without explaining it first
- Keep sentences short (max 2 lines per paragraph)
- Celebrate small wins before suggesting improvements
- End every explanation with one simple thing they can try next
- Say "Oops!" not "Error:" when something goes wrong
- Use emoji occasionally to keep it friendly 🎉
- Use markdown with code blocks. Always specify the language in code fences.`,

  developer: `You are Kitsune AI, an expert pair programmer in Momiji IDE. Be sharp, precise, and a little playful — like a clever fox. Rules:
- Direct and precise, no hand-holding
- Use correct technical terminology
- Focus on edge cases, performance, and best practices
- Suggest idiomatic patterns for the language being used
- Keep responses concise
- Use markdown with code blocks. Always specify language in code fences.
- When fixing/refactoring/writing code, output the COMPLETE updated function or file so it can be applied directly.`,

  creative: `You are Kitsune, a creative coding companion in Momiji IDE. The user is a designer, animator, or game developer. Rules:
- Frame everything in terms of visual outcomes and creative tools
- Reference familiar tools: Unity, Godot, Blender, Photoshop, After Effects
- Connect code concepts to visual/game concepts they already know
- Suggest how code changes will affect visual output
- Be enthusiastic about creative applications
- Always mention what this enables them to CREATE
- Use markdown with code blocks. Always specify language in code fences.
- When fixing/refactoring code, output the COMPLETE updated code.`,
}

export const quickActions = [
  { label: '🔍 Explain', prompt: 'Explain what this code does clearly.' },
  { label: '🐛 Find bugs', prompt: 'Analyze for bugs. List with line references.' },
  { label: '✨ Refactor', prompt: 'Refactor to be cleaner. Output complete updated code.' },
  { label: '🧪 Tests', prompt: 'Write comprehensive unit tests.' },
  { label: '⚡ Optimize', prompt: 'Optimize for performance. Output complete updated code.' },
  { label: '📝 Add docs', prompt: 'Add JSDoc/docstring comments. Output complete updated code.' },
  { label: '🔒 Security', prompt: 'Review for security vulnerabilities. Rate each: Critical/High/Medium/Low.' },
  { label: '📊 Review', prompt: 'Full code review. Rate 1–10 on correctness, performance, readability, security.' },
]

function friendlyErrorMessage(msg: string, model?: string): string {
  if (msg.includes('quota') || msg.includes('limit: 0') || msg.includes('RESOURCE_EXHAUSTED')) {
    return `❌ **API Quota / Access Error** (model: \`${model}\`)\n\n"limit: 0" usually means Gemini API is not enabled for this key's project.\n\n**Fix:**\n1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)\n2. Create a new API key there\n3. Paste it in ⚙️ Settings → AI & API Keys\n\n__FIX_BUTTON__`
  } else if (msg.includes('401') || msg.includes('API_KEY') || msg.includes('invalid')) {
    return `❌ **Invalid API Key** — Check ⚙️ Settings → AI & API Keys.\nMake sure the key is correct and Enabled toggle is ON.`
  } else if (msg.includes('Failed to fetch') || msg.includes('network')) {
    return `❌ **Network Error** — Could not reach the API. Check your internet connection.`
  } else if (msg.includes('MIME') || msg.includes('mime') || msg.includes('image')) {
    return `❌ **Image Error** — ${msg}\n\nTry a PNG or JPEG screenshot instead.`
  }
  return `❌ **Error:** ${msg}`
}

// Chat/agent logic extracted from the old AIPanel — now reads/writes the active
// Kitsune session in appStore so conversations persist across the session list.
// When a project folder is open, sends become an agentic tool-calling loop
// (read/write/search/list files) — Claude-Code-style local execution.
export function useKitsuneChat() {
  const {
    aiProviders, tabs, activeTabId, updateTabContent, markTabClean, updateAIProvider, currentFolder,
    kitsuneSessions, activeKitsuneSessionId, createKitsuneSession, updateKitsuneSession, customAgents,
  } = useAppStore()

  const activeSession = kitsuneSessions.find(s => s.id === activeKitsuneSessionId) ?? null

  const [messages, setMessages] = useState<KitsuneMessage[]>(() => normalizeMsgIds(activeSession?.messages ?? []))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [kitsuneExpr, setKitsuneExpr] = useState<'normal' | 'thinking' | 'happy'>('normal')
  const [selectedProviderId, setSelectedProviderIdState] = useState(activeSession?.providerId ?? 'claude')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null)
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [attachedFolders, setAttachedFolders] = useState<AttachedFolder[]>([])
  const [diffState, setDiffState] = useState<{ original: string; suggested: string } | null>(null)
  const [streamElapsed, setStreamElapsed] = useState(0)
  const [streamTokens, setStreamTokens]   = useState(0)
  const [contextUsed, setContextUsedState] = useState(activeSession?.contextUsed ?? 0)
  const [persona, setPersonaState] = useState<KitsunePersona>(activeSession?.persona ?? 'developer')

  // ── Agent ("skill") selection ───────────────────────────────────────────────
  const allAgents = [...BUILTIN_AGENTS, ...customAgents]
  const [agentId, setAgentIdState] = useState(activeSession?.agentId ?? BUILTIN_AGENTS[0].id)
  const selectedAgent = allAgents.find(a => a.id === agentId) ?? BUILTIN_AGENTS[0]

  // ── Agentic file-tool state ────────────────────────────────────────────────
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([])
  const [autoApprove, setAutoApprove] = useState(false)
  const [filesWritten, setFilesWritten] = useState<string[]>([])
  const agentAbortRef = useRef(false)

  // ── Project Memory ────────────────────────────────────────────────────────
  const [projectMemory, setProjectMemory] = useState('')
  const [memoryDraft, setMemoryDraft]     = useState('')
  const [memorySaved, setMemorySaved]     = useState(false)
  const [autoContext, setAutoContext]      = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef   = useRef<number>(0)

  const enabledProviders = aiProviders.filter(p => p.enabled && (p.apiKey || p.id === 'ollama' || p.id === 'custom'))
  const activeProvider   = enabledProviders.find(p => p.id === selectedProviderId) ?? enabledProviders[0]
  const activeTab        = tabs.find(t => t.id === activeTabId)

  // ── Ensure there is always an active session ───────────────────────────────
  useEffect(() => {
    if (!activeKitsuneSessionId) createKitsuneSession()
  }, [activeKitsuneSessionId]) // eslint-disable-line

  // ── Load session state when switching sessions ─────────────────────────────
  useEffect(() => {
    if (!activeSession) return
    setMessages(normalizeMsgIds(activeSession.messages))
    setPersonaState(activeSession.persona)
    setSelectedProviderIdState(activeSession.providerId)
    setContextUsedState(activeSession.contextUsed)
    setAgentIdState(activeSession.agentId ?? BUILTIN_AGENTS[0].id)
  }, [activeKitsuneSessionId]) // eslint-disable-line

  // ── Persist messages/contextUsed back to the active session ────────────────
  useEffect(() => {
    if (!activeKitsuneSessionId) return
    const title = messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'New chat'
    updateKitsuneSession(activeKitsuneSessionId, { messages, contextUsed, title })
  }, [messages, contextUsed]) // eslint-disable-line

  const setPersona = (p: KitsunePersona) => {
    setPersonaState(p)
    if (activeKitsuneSessionId) updateKitsuneSession(activeKitsuneSessionId, { persona: p })
  }
  const setSelectedProviderId = (id: string) => {
    setSelectedProviderIdState(id)
    if (activeKitsuneSessionId) updateKitsuneSession(activeKitsuneSessionId, { providerId: id })
  }
  const setAgentId = (id: string) => {
    setAgentIdState(id)
    if (activeKitsuneSessionId) updateKitsuneSession(activeKitsuneSessionId, { agentId: id })
  }

  // ── Load project memory + auto-detect stack when folder changes ───────────
  useEffect(() => {
    if (!currentFolder) { setProjectMemory(''); setMemoryDraft(''); setAutoContext(''); return }

    // Load saved memory
    const memPath = `${currentFolder}/.momiji/kitsune-memory.md`
    window.api.fs.readFile(memPath).then(r => {
      const content = r.content ?? ''
      setProjectMemory(content)
      setMemoryDraft(content)
    }).catch(() => { setProjectMemory(''); setMemoryDraft('') })

    // Auto-detect tech stack from project files
    const detect = async () => {
      const lines: string[] = []
      const tryRead = async (rel: string) => {
        try { const r = await window.api.fs.readFile(`${currentFolder}/${rel}`); return r.content ?? null }
        catch { return null }
      }
      const pkg = await tryRead('package.json')
      if (pkg) {
        try {
          const j = JSON.parse(pkg)
          const deps = { ...j.dependencies, ...j.devDependencies }
          const flags: string[] = []
          if (deps['react'])       flags.push('React')
          if (deps['next'])        flags.push('Next.js')
          if (deps['vue'])         flags.push('Vue')
          if (deps['svelte'])      flags.push('Svelte')
          if (deps['typescript'])  flags.push('TypeScript')
          if (deps['electron'])    flags.push('Electron')
          if (deps['vite'])        flags.push('Vite')
          if (deps['tailwindcss']) flags.push('Tailwind CSS')
          if (deps['prisma'])      flags.push('Prisma')
          if (deps['express'])     flags.push('Express')
          if (deps['fastify'])     flags.push('Fastify')
          if (flags.length) lines.push(`Stack: ${flags.join(', ')}`)
          if (j.name) lines.push(`Project: ${j.name}`)
        } catch {}
      }
      if (await tryRead('requirements.txt') || await tryRead('pyproject.toml')) lines.push('Stack: Python')
      if (await tryRead('go.mod')) lines.push('Stack: Go')
      if (await tryRead('Cargo.toml')) lines.push('Stack: Rust')
      if (await tryRead('tsconfig.json')) { if (!lines.some(l => l.includes('TypeScript'))) lines.push('TypeScript') }
      setAutoContext(lines.join('\n'))
    }
    detect()
  }, [currentFolder])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Consume pending prompt set by App.tsx global handler ─────────────────
  const pendingAIPrompt    = useAppStore(s => s.pendingAIPrompt)
  const setPendingAIPrompt = useAppStore(s => s.setPendingAIPrompt)

  useEffect(() => {
    if (!pendingAIPrompt) return
    setPendingAIPrompt(null)   // clear immediately so it doesn't fire twice
    setInput(pendingAIPrompt)
    // Give React one tick to render, then send
    setTimeout(() => handleSendRef.current(pendingAIPrompt), 80)
  }, [pendingAIPrompt]) // eslint-disable-line

  // ── Start / stop elapsed timer ────────────────────────────────────────────
  const startTimer = () => {
    startTimeRef.current = Date.now()
    setStreamElapsed(0); setStreamTokens(0)
    timerRef.current = setInterval(() => setStreamElapsed(Date.now() - startTimeRef.current), 200)
  }
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    return Date.now() - startTimeRef.current
  }

  // ── Image paste: convert to PNG ───────────────────────────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        try {
          const img = await convertImageToPng(file)
          setAttachedImage(img)
        } catch {
          // fallback: use raw
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            setAttachedImage({ data: dataUrl.split(',')[1], mimeType: 'image/png', preview: dataUrl })
          }
          reader.readAsDataURL(file)
        }
        return
      }
    }
  }, [])

  // ── File attachments: pick files/images via dialog ────────────────────────
  const addAttachedFiles = useCallback(async () => {
    const paths = await window.api.dialog.openFile()
    if (!paths) return
    for (const fp of paths) {
      const name = fp.split(/[\\/]/).pop() ?? fp
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      if (IMAGE_EXTS.includes(ext)) {
        const r = await window.api.fs.readBinary(fp)
        if (r?.ok) {
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
          setAttachedImage({ data: r.base64, mimeType: mime, preview: `data:${mime};base64,${r.base64}` })
        }
      } else {
        const r = await window.api.fs.readFile(fp)
        if (r.content !== null) {
          setAttachedFiles(prev => prev.some(f => f.path === fp) ? prev : [...prev, { name, path: fp, content: r.content! }])
        }
      }
    }
  }, [])
  const removeAttachedFile = (path: string) => setAttachedFiles(prev => prev.filter(f => f.path !== path))

  // ── Folder attachments: pick a folder via dialog, list its contents ───────
  const addAttachedFolder = useCallback(async () => {
    const path = await window.api.dialog.openFolder()
    if (!path) return
    const tree = await window.api.fs.readDir(path)
    if (!tree) return
    const name = path.split(/[\\/]/).pop() ?? path
    const listing = formatFileTree(tree)
    setAttachedFolders(prev => prev.some(f => f.path === path) ? prev : [...prev, { name, path, listing }])
  }, [])
  const removeAttachedFolder = (path: string) => setAttachedFolders(prev => prev.filter(f => f.path !== path))

  // ── Save project memory to .momiji/kitsune-memory.md ───────────────────
  const saveMemory = async () => {
    if (!currentFolder) return
    const dir = `${currentFolder}/.momiji`
    await window.api.fs.createFolder(dir)
    await window.api.fs.writeFile(`${dir}/kitsune-memory.md`, memoryDraft)
    setProjectMemory(memoryDraft)
    setMemorySaved(true)
    setTimeout(() => setMemorySaved(false), 2000)
  }

  // A folder is "open" either via the IDE's project folder or via a
  // 📁 Add folder chat attachment — either way, tools resolve relative
  // paths against it and the agentic loop activates.
  const workingFolder = currentFolder ?? attachedFolders[0]?.path ?? null

  // ── System prompt (skill/persona-aware, + tools when a folder is open) ────
  const buildSystemPrompt = () => {
    // The default "Kitsune" agent's tone follows the persona switch
    // (beginner/dev/creative); specialized skill agents keep their own prompt.
    let sys = selectedAgent.id === 'builtin-kitsune' ? PERSONA_PROMPTS[persona] : selectedAgent.systemPrompt
    if (autoContext) sys += `\n\n## Project Info\n${autoContext}`
    if (projectMemory.trim()) sys += `\n\n## Project Memory\n${projectMemory}`
    if (activeTab) sys += `\n\n## Current file: ${activeTab.fileName} (${activeTab.language})\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 4000)}\n\`\`\``
    if (workingFolder) sys += buildToolsSystemSuffix(workingFolder)
    return sys
  }

  // ── Tool sets filtered by the selected agent's allowed tools ([] = all) ───
  const filterClaudeTools = () =>
    selectedAgent.tools.length === 0 ? CLAUDE_TOOLS : CLAUDE_TOOLS.filter(t => selectedAgent.tools.includes(t.name))
  const filterGeminiTools = () =>
    selectedAgent.tools.length === 0 ? GEMINI_TOOLS : { function_declarations: GEMINI_TOOLS.function_declarations.filter(f => selectedAgent.tools.includes(f.name)) }
  const filterOpenAITools = () =>
    selectedAgent.tools.length === 0 ? OPENAI_TOOLS : OPENAI_TOOLS.filter(t => selectedAgent.tools.includes(t.function.name))

  // ── Inline tool-activity messages ──────────────────────────────────────────
  const addToolMsg = (tool: string, args: Record<string, any>) => {
    const id = msgId++
    setMessages(prev => [...prev, { role: 'tool', content: '', id, tool, toolArgs: args, toolStatus: 'running' }])
    return id
  }
  const updateToolMsg = (id: number, status: 'done' | 'error', result: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, toolStatus: status, toolResult: result } : m))
  }
  const removeMsg = (id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  // ── write_file → auto-write or queue for approval ──────────────────────────
  const requestWrite = (path: string, content: string): Promise<string> => {
    const doWrite = async () => {
      await window.api.fs.writeFile(path, content)
      const tab = useAppStore.getState().tabs.find(t => t.filePath === path)
      if (tab) { updateTabContent(tab.id, content); markTabClean(tab.id) }
      setFilesWritten(prev => prev.includes(path) ? prev : [...prev, path])
    }
    if (autoApprove) {
      return doWrite().then(() => `Written: ${path}`)
    }
    return new Promise<string>(resolve => {
      setPendingWrites(prev => [...prev, {
        path, content,
        resolve: async approved => {
          if (approved) {
            await doWrite()
            resolve(`Written: ${path}`)
          } else {
            resolve(`Skipped by user: ${path}`)
          }
          setPendingWrites(prev => prev.filter(w => w.path !== path))
        }
      }])
    })
  }
  const handleWriteDecision = (path: string, approved: boolean) => {
    pendingWrites.find(w => w.path === path)?.resolve(approved)
  }

  const runTool = async (name: string, args: Record<string, any>): Promise<string> => {
    const id = addToolMsg(name, args)
    const result = await executeTool(name, args, workingFolder, { onWriteRequest: requestWrite })
    updateToolMsg(id, result.startsWith('Error') || result.startsWith('Skipped by user') ? 'error' : 'done', result)
    return result
  }

  // ── Agentic loop: Claude ────────────────────────────────────────────────────
  const runAgenticClaude = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null, onProgress?: (tokensIn: number, tokensOut: number) => void) => {
    const sysPrompt = buildSystemPrompt()
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))
    const firstContent: any[] = []
    if (image) firstContent.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } })
    firstContent.push({ type: 'text', text: userMessage })
    const convo: any[] = [...history, { role: 'user', content: firstContent }]
    const tools = filterClaudeTools()
    let tokensIn = 0, tokensOut = 0

    for (let i = 0; i < MAX_ITER; i++) {
      if (agentAbortRef.current) return { text: '_[stopped]_', tokensIn, tokensOut }
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: provider.model, max_tokens: 4096, system: sysPrompt, tools, messages: convo })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error?.message ?? 'Claude error')
      if (data.usage) { tokensIn = data.usage.input_tokens ?? tokensIn; tokensOut += data.usage.output_tokens ?? 0 }
      onProgress?.(tokensIn, tokensOut)

      convo.push({ role: 'assistant', content: data.content })
      const textBlock = data.content.find((b: any) => b.type === 'text')
      const toolUses = data.content.filter((b: any) => b.type === 'tool_use')
      if (toolUses.length === 0) return { text: textBlock?.text ?? '', tokensIn, tokensOut }

      const toolResults: any[] = []
      for (const block of toolUses) {
        if (agentAbortRef.current) break
        const result = await runTool(block.name, block.input)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      convo.push({ role: 'user', content: toolResults })
    }
    return { text: '⚠️ Reached the 20-step tool limit for this turn.', tokensIn, tokensOut }
  }

  // ── Agentic loop: Gemini ─────────────────────────────────────────────────────
  const runAgenticGemini = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null, onProgress?: (tokensIn: number, tokensOut: number) => void) => {
    const sysPrompt = buildSystemPrompt()
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const firstParts: any[] = []
    if (image) firstParts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })
    firstParts.push({ text: userMessage })
    const contents: any[] = [...history, { role: 'user', parts: firstParts }]
    const tools = filterGeminiTools()
    let tokensIn = 0, tokensOut = 0

    for (let i = 0; i < MAX_ITER; i++) {
      if (agentAbortRef.current) return { text: '_[stopped]_', tokensIn, tokensOut }
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysPrompt }] },
          tools: [tools],
          tool_config: { function_calling_config: { mode: 'AUTO' } },
          generationConfig: { maxOutputTokens: 8192 },
          contents
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error?.message ?? `Gemini error: ${JSON.stringify(data)}`)
      const candidate = data.candidates?.[0]
      if (!candidate) {
        const blockReason = data.promptFeedback?.blockReason
        throw new Error(blockReason ? `Gemini blocked the response (${blockReason}). Try rephrasing your request.` : 'No response from Gemini')
      }

      const usage = data.usageMetadata
      if (usage) { tokensIn = usage.promptTokenCount ?? tokensIn; tokensOut += usage.candidatesTokenCount ?? 0 }
      onProgress?.(tokensIn, tokensOut)

      const parts = candidate.content?.parts ?? []
      contents.push({ role: 'model', parts })
      // "thought" parts are the model's internal reasoning, not the final
      // answer — skip them or the chat shows raw chain-of-thought as the reply.
      const textPart = parts.find((p: any) => p.text && !p.thought)
      const fnCalls = parts.filter((p: any) => p.functionCall)
      if (fnCalls.length === 0) {
        if (!textPart?.text && candidate.finishReason && candidate.finishReason !== 'STOP') {
          // A huge `content` argument (full file) often breaks Gemini's function-call
          // JSON encoding. Drop the malformed turn and nudge the model toward the
          // fenced-code-block fallback (see buildToolsSystemSuffix) instead of failing outright.
          if (candidate.finishReason === 'MALFORMED_FUNCTION_CALL' && i < MAX_ITER - 1) {
            contents.pop()
            contents.push({ role: 'user', parts: [{ text:
              'Your previous attempt to call a tool was malformed — this usually happens when the ' +
              'write_file `content` argument is too large. For large/new files, do NOT call write_file. ' +
              'Instead, output the complete file in a fenced code block whose opening fence includes ' +
              '"path=<relative/path>", e.g. ```html path=index.html ... ```. Please retry now using that format.'
            }] })
            continue
          }
          throw new Error(`Gemini stopped early (${candidate.finishReason}). Try again or switch models.`)
        }
        return { text: textPart?.text ?? '', tokensIn, tokensOut }
      }

      const fnResults: any[] = []
      for (const part of fnCalls) {
        if (agentAbortRef.current) break
        const result = await runTool(part.functionCall.name, part.functionCall.args ?? {})
        fnResults.push({ functionResponse: { name: part.functionCall.name, response: { result } } })
      }
      contents.push({ role: 'user', parts: fnResults })
    }
    return { text: '⚠️ Reached the 20-step tool limit for this turn.', tokensIn, tokensOut }
  }

  // ── Agentic loop: OpenAI-compatible (Ollama/Groq/OpenRouter/DeepSeek/Mistral/OpenAI/custom) ──
  const getCompatEndpoint = (provider: typeof aiProviders[0]) => {
    const ENDPOINTS: Record<string, string> = {
      groq:       'https://api.groq.com/openai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      deepseek:   'https://api.deepseek.com/v1/chat/completions',
      mistral:    'https://api.mistral.ai/v1/chat/completions',
      openai:     'https://api.openai.com/v1/chat/completions',
      sambanova:  'https://api.sambanova.ai/v1/chat/completions',
      cerebras:   'https://api.cerebras.ai/v1/chat/completions',
    }
    let url: string | undefined
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (provider.id === 'ollama') {
      url = `${provider.baseUrl ?? 'http://localhost:11434'}/v1/chat/completions`
      headers['Authorization'] = 'Bearer ollama'
    } else {
      const baseUrl = provider.baseUrl?.replace(/\/$/, '')
      url = baseUrl ? `${baseUrl}/v1/chat/completions` : ENDPOINTS[provider.id]
      headers['Authorization'] = `Bearer ${provider.apiKey}`
      if (provider.id === 'openrouter') { headers['HTTP-Referer'] = 'https://momiji-ide.github.io'; headers['X-Title'] = 'Momiji IDE' }
    }
    return { url, headers }
  }

  const runAgenticOpenAICompat = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null, onProgress?: (tokensIn: number, tokensOut: number) => void) => {
    const { url, headers } = getCompatEndpoint(provider)
    if (!url) throw new Error(`Unknown provider: ${provider.id}`)
    const sysPrompt = buildSystemPrompt()
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))
    const userContent: any = image
      ? [{ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }, { type: 'text', text: userMessage }]
      : userMessage
    const convo: any[] = [{ role: 'system', content: sysPrompt }, ...history, { role: 'user', content: userContent }]
    const tools = filterOpenAITools()
    let tokensIn = 0, tokensOut = 0

    for (let i = 0; i < MAX_ITER; i++) {
      if (agentAbortRef.current) return { text: '_[stopped]_', tokensIn, tokensOut }
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: provider.model, messages: convo, tools, tool_choice: 'auto' }) })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(provider.id === 'ollama'
          ? (txt.includes('model') || resp.status === 404
              ? `Model "${provider.model}" not found locally.\n\nFix: open terminal and run:\n\`ollama pull ${provider.model}\``
              : `Ollama error ${resp.status}. Is Ollama running? Start it with: \`ollama serve\``)
          : (txt || `${provider.name} error ${resp.status}`))
      }
      const data = await resp.json()
      const msg = data.choices[0].message
      if (data.usage) { tokensIn = data.usage.prompt_tokens ?? tokensIn; tokensOut += data.usage.completion_tokens ?? 0 }
      onProgress?.(tokensIn, tokensOut)
      convo.push(msg)

      if (!msg.tool_calls?.length) return { text: msg.content ?? '', tokensIn, tokensOut }

      for (const tc of msg.tool_calls) {
        if (agentAbortRef.current) break
        const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
        const result = await runTool(tc.function.name, args)
        convo.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
    }
    return { text: '⚠️ Reached the 20-step tool limit for this turn.', tokensIn, tokensOut }
  }

  // ── Claude streaming + usage (no-folder / plain chat path) ────────────────
  const callClaudeStream = async (
    provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null,
    onChunk: (t: string) => void, onUsage: (inTok: number, outTok: number) => void
  ) => {
    abortRef.current = new AbortController()
    const userContent: any[] = []
    if (image) userContent.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } })
    userContent.push({ type: 'text', text: userMessage })
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'messages-2023-12-15' },
      body: JSON.stringify({ model: provider.model, max_tokens: 4096, stream: true, system: buildSystemPrompt(), messages: [...history, { role: 'user', content: userContent }] }),
      signal: abortRef.current.signal
    })
    if (!resp.ok) { const d = await resp.json(); throw new Error(d.error?.message ?? 'Claude error') }

    const reader = resp.body!.getReader(); const dec = new TextDecoder(); let buf = ''
    let inTok = 0
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim(); if (raw === '[DONE]' || !raw) continue
        try {
          const ev = JSON.parse(raw)
          if (ev.type === 'message_start' && ev.message?.usage) inTok = ev.message.usage.input_tokens
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            onChunk(ev.delta.text)
            setStreamTokens(t => t + Math.ceil(ev.delta.text.length / 4))
          }
          if (ev.type === 'message_delta' && ev.usage) onUsage(inTok, ev.usage.output_tokens)
        } catch {}
      }
    }
  }

  // ── Gemini (vision + usage) ───────────────────────────────────────────────
  const callGemini = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null) => {
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const userParts: any[] = []
    if (image) userParts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })
    userParts.push({ text: userMessage })
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: buildSystemPrompt() }] }, contents: [...history, { role: 'user', parts: userParts }] })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message ?? 'Gemini error')
    const text = data.candidates[0].content.parts[0].text as string
    const usage = data.usageMetadata
    return { text, tokensIn: usage?.promptTokenCount, tokensOut: usage?.candidatesTokenCount }
  }

  // ── Ollama (local, OpenAI-compatible) ────────────────────────────────────
  const callOllama = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null) => {
    const base = provider.baseUrl ?? 'http://localhost:11434'
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))
    const userContent: any = image
      ? [{ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }, { type: 'text', text: userMessage }]
      : userMessage
    const resp = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'system', content: buildSystemPrompt() }, ...history, { role: 'user', content: userContent }]
      })
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(txt.includes('model') || resp.status === 404
        ? `Model "${provider.model}" not found locally.\n\nFix: open terminal and run:\n\`ollama pull ${provider.model}\``
        : `Ollama error ${resp.status}. Is Ollama running? Start it with: \`ollama serve\``)
    }
    const data = await resp.json()
    return { text: data.choices[0].message.content as string, tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens }
  }

  // ── OpenAI (vision) ───────────────────────────────────────────────────────
  const callOpenAI = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null) => {
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))
    const userContent: any = image ? [{ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }, { type: 'text', text: userMessage }] : userMessage
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: buildSystemPrompt() }, ...history, { role: 'user', content: userContent }] })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message ?? 'OpenAI error')
    return { text: data.choices[0].message.content as string, tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens }
  }

  // ── OpenAI-compatible wrapper — used by Groq, OpenRouter, DeepSeek, Mistral ──
  const callOpenAICompat = async (provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null) => {
    const ENDPOINTS: Record<string, string> = {
      groq:       'https://api.groq.com/openai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      deepseek:   'https://api.deepseek.com/v1/chat/completions',
      mistral:    'https://api.mistral.ai/v1/chat/completions',
      sambanova:  'https://api.sambanova.ai/v1/chat/completions',
      cerebras:   'https://api.cerebras.ai/v1/chat/completions',
    }
    // custom provider: use baseUrl directly, strip trailing slash
    const baseUrl = provider.baseUrl?.replace(/\/$/, '')
    const url = baseUrl ? `${baseUrl}/v1/chat/completions` : ENDPOINTS[provider.id]
    if (!url) throw new Error(`Unknown provider: ${provider.id}`)
    const history = messages.filter(m => m.role !== 'tool' && !m.streaming).map(m => ({ role: m.role, content: m.content }))
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` }
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://momiji-ide.github.io'
      headers['X-Title'] = 'Momiji IDE'
    }
    const resp = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: buildSystemPrompt() }, ...history, { role: 'user', content: userMessage }] })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message ?? `${provider.name} error`)
    return { text: data.choices?.[0]?.message?.content as string ?? '', tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  // Keep a ref to the latest handleSend so event listeners always call fresh version
  const handleSendRef = useRef<(override?: string) => void>(() => {})

  const handleSend = useCallback(async (overridePrompt?: string) => {
    const textToSend = overridePrompt ?? input
    if ((!textToSend.trim() && !attachedImage && attachedFiles.length === 0 && attachedFolders.length === 0) || isLoading || !activeProvider) return
    const userMessage   = textToSend.trim() || '(analyze this image)'
    const imageSnapshot = attachedImage
    const filesSnapshot = attachedFiles
    const foldersSnapshot = attachedFolders
    if (!overridePrompt) setInput('')
    setAttachedImage(null)
    setAttachedFiles([])
    setAttachedFolders([])

    setMessages(prev => [...prev, {
      role: 'user', content: userMessage, id: msgId++, image: imageSnapshot?.preview,
      attachedFileNames: filesSnapshot.length ? filesSnapshot.map(f => f.name) : undefined,
      attachedFolderNames: foldersSnapshot.length ? foldersSnapshot.map(f => f.name) : undefined,
    }])
    setIsLoading(true)
    setKitsuneExpr('thinking')
    window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state: 'thinking' } }))
    startTimer()
    agentAbortRef.current = false

    // Prepend attached file/folder contents (not shown verbatim in the chat bubble)
    let messageForProvider = userMessage
    if (filesSnapshot.length > 0) {
      const fileBlocks = filesSnapshot.map(f => {
        const ext = f.name.split('.').pop() ?? ''
        return `## Attached file: ${f.name}\n\`\`\`${ext}\n${f.content}\n\`\`\``
      }).join('\n\n')
      messageForProvider = `${fileBlocks}\n\n${messageForProvider}`
    }
    if (foldersSnapshot.length > 0) {
      const folderBlocks = foldersSnapshot.map(f =>
        `## Attached folder: ${f.name} (${f.path})\n${f.listing}\n\nUse list_directory/read_file/search_in_files with paths under this folder to explore it.`
      ).join('\n\n')
      messageForProvider = `${folderBlocks}\n\n${messageForProvider}`
    }

    if (workingFolder) {
      // ── Agentic mode: model can read/write/search/list project files ──────
      const thinkingId = addToolMsg('thinking', {})
      const onProgress = (inTok: number, outTok: number) => { if (inTok) setContextUsedState(inTok + outTok) }
      try {
        let result: { text: string; tokensIn: number; tokensOut: number }
        if (activeProvider.id === 'claude') result = await runAgenticClaude(activeProvider, messageForProvider, imageSnapshot, onProgress)
        else if (activeProvider.id === 'gemini') result = await runAgenticGemini(activeProvider, messageForProvider, imageSnapshot, onProgress)
        else result = await runAgenticOpenAICompat(activeProvider, messageForProvider, imageSnapshot, onProgress)

        removeMsg(thinkingId)
        const elapsed = stopTimer()

        // Models emit large/new files as fenced ```lang path=...``` blocks instead of
        // write_file calls (more reliable for big content) — write those out here.
        const { blocks: fileBlocks, cleaned } = extractFileBlocks(result.text.trim())
        for (const fb of fileBlocks) {
          if (agentAbortRef.current) break
          const path = resolvePath(fb.path, workingFolder)
          const id = addToolMsg('write_file', { path: fb.path })
          const res = await requestWrite(path, fb.content)
          updateToolMsg(id, res.startsWith('Error') || res.startsWith('Skipped') ? 'error' : 'done', res)
        }

        const text = cleaned || '✅ Done.'
        setMessages(prev => [...prev, { role: 'assistant', content: text, id: msgId++, tokensIn: result.tokensIn || undefined, tokensOut: result.tokensOut || undefined, elapsed }])
        if (result.tokensIn) setContextUsedState(result.tokensIn + result.tokensOut)
      } catch (err: unknown) {
        removeMsg(thinkingId)
        stopTimer()
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setMessages(prev => [...prev, { role: 'assistant', content: friendlyErrorMessage(msg, activeProvider?.model), id: msgId++ }])
      }
    } else {
      // ── Plain chat mode (no folder open — no tools) ───────────────────────
      const streamId = msgId++
      setMessages(prev => [...prev, { role: 'assistant', content: '', id: streamId, streaming: true }])

      try {
        if (activeProvider.id === 'claude') {
          let full = '', inTok = 0, outTok = 0
          await callClaudeStream(activeProvider, messageForProvider, imageSnapshot,
            chunk => {
              full += chunk
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: full } : m))
            },
            (i, o) => { inTok = i; outTok = o }
          )
          const elapsed = stopTimer()
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, streaming: false, tokensIn: inTok, tokensOut: outTok, elapsed } : m))
          if (inTok > 0) setContextUsedState(inTok + outTok)
        } else if (activeProvider.id === 'gemini') {
          const { text, tokensIn, tokensOut } = await callGemini(activeProvider, messageForProvider, imageSnapshot)
          const elapsed = stopTimer()
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
          if (tokensIn) setContextUsedState(tokensIn + (tokensOut ?? 0))
        } else if (activeProvider.id === 'ollama') {
          const { text, tokensIn, tokensOut } = await callOllama(activeProvider, messageForProvider, imageSnapshot)
          const elapsed = stopTimer()
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
          if (tokensIn) setContextUsedState(tokensIn + (tokensOut ?? 0))
        } else if (['groq','openrouter','deepseek','mistral','sambanova','cerebras','custom'].includes(activeProvider.id)) {
          const { text, tokensIn, tokensOut } = await callOpenAICompat(activeProvider, messageForProvider, imageSnapshot)
          const elapsed = stopTimer()
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
          if (tokensIn) setContextUsedState(tokensIn + (tokensOut ?? 0))
        } else {
          const { text, tokensIn, tokensOut } = await callOpenAI(activeProvider, messageForProvider, imageSnapshot)
          const elapsed = stopTimer()
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
          if (tokensIn) setContextUsedState(tokensIn + (tokensOut ?? 0))
        }
      } catch (err: unknown) {
        stopTimer()
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (msg.includes('aborted')) {
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: m.content + '\n\n_[stopped]_', streaming: false } : m))
          setIsLoading(false); setKitsuneExpr('normal')
          window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state: 'idle' } }))
          return
        }
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: friendlyErrorMessage(msg, activeProvider?.model), streaming: false } : m))
      }
    }

    setIsLoading(false)
    setKitsuneExpr('happy')
    window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state: 'idle' } }))
    setTimeout(() => setKitsuneExpr('normal'), 3000)
  }, [input, attachedImage, attachedFiles, attachedFolders, isLoading, activeProvider, messages, activeTab, currentFolder, selectedAgent, autoApprove, persona, projectMemory, autoContext])

  // Keep ref in sync so event listeners always use latest closure
  useEffect(() => { handleSendRef.current = handleSend }, [handleSend])

  const handleStop = () => {
    abortRef.current?.abort()
    agentAbortRef.current = true
    stopTimer()
    setIsLoading(false)
    setKitsuneExpr('normal')
  }

  // ── Code helpers ──────────────────────────────────────────────────────────
  const extractCodeBlocks = (content: string) => [...content.matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map(m => m[1].trim())

  const handleSmartApply = (content: string) => {
    if (!activeTab) return
    const blocks = extractCodeBlocks(content)
    if (blocks.length === 0) return
    setDiffState({ original: activeTab.content, suggested: blocks[0] })
  }
  const confirmApply = () => {
    if (!diffState || !activeTab) return
    const newContent = applyCodeToFile(diffState.original, diffState.suggested)
    updateTabContent(activeTab.id, newContent)
    window.api.fs.writeFile(activeTab.filePath, newContent).then(() => markTabClean(activeTab.id))
    setDiffState(null)
  }
  const handleCopyCode = async (content: string, id: number) => {
    const blocks = extractCodeBlocks(content)
    await window.api.clipboard.writeText(blocks[0] ?? content)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500)
  }

  // ── Copy a whole message bubble (raw markdown) to the clipboard ────────────
  const handleCopyMessage = async (content: string, id: number) => {
    await window.api.clipboard.writeText(content)
    setCopiedMsgId(id); setTimeout(() => setCopiedMsgId(null), 1500)
  }

  // ── Rewind the chat to just before `cutoffId` and resend `text` — powers
  // both "edit & resend" (user messages) and "regenerate" (assistant messages) ──
  const rewindAndResend = (cutoffId: number, text: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === cutoffId)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
    setTimeout(() => handleSendRef.current(text), 80)
  }

  const handleEditMessage = (id: number, newContent: string) => {
    if (!newContent.trim() || isLoading) return
    rewindAndResend(id, newContent)
  }

  // Drops the given assistant reply and the user message that prompted it,
  // then resends that user message to get a fresh response.
  const handleRegenerate = (assistantId: number) => {
    if (isLoading) return
    const idx = messages.findIndex(m => m.id === assistantId)
    if (idx === -1) return
    let userIdx = idx - 1
    while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx--
    if (userIdx < 0) return
    rewindAndResend(messages[userIdx].id, messages[userIdx].content)
  }
  const handleInsertCode = (content: string) => {
    if (!activeTab) return
    const code = extractCodeBlocks(content)[0] ?? content
    const nc = activeTab.content + '\n\n' + code
    updateTabContent(activeTab.id, nc)
    window.api.fs.writeFile(activeTab.filePath, nc).then(() => markTabClean(activeTab.id))
  }

  const clearChat = () => { setMessages([]); setContextUsedState(0); setFilesWritten([]); setPendingWrites([]) }

  return {
    messages, setMessages, input, setInput, isLoading, kitsuneExpr,
    selectedProviderId, setSelectedProviderId, activeProvider, enabledProviders,
    copiedId, copiedMsgId, attachedImage, setAttachedImage, handlePaste,
    handleCopyMessage, handleEditMessage, handleRegenerate,
    attachedFiles, addAttachedFiles, removeAttachedFile,
    attachedFolders, addAttachedFolder, removeAttachedFolder,
    diffState, setDiffState, confirmApply,
    streamElapsed, streamTokens, contextUsed,
    persona, setPersona, PERSONA_LABELS,
    agentId, setAgentId, selectedAgent, allAgents,
    pendingWrites, handleWriteDecision, autoApprove, setAutoApprove, filesWritten,
    projectMemory, memoryDraft, setMemoryDraft, memorySaved, saveMemory, autoContext,
    messagesEndRef, activeTab, aiProviders, updateAIProvider,
    handleSend, handleStop, handleSmartApply, handleCopyCode, handleInsertCode, extractCodeBlocks,
    quickActions, clearChat, currentFolder, workingFolder,
  }
}
