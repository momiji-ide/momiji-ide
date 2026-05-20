import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import { KitsuneAgent } from './KitsuneAgent'
import { ModelSelector } from './ModelSelector'
import kitsuneNormal  from '../../assets/kitsune-normal.png'
import kitsuneHappy   from '../../assets/kitsune-happy.png'
import kitsuneConfuse from '../../assets/kitsune-confuse.png'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: number
  streaming?: boolean
  image?: string
  tokensIn?: number
  tokensOut?: number
  elapsed?: number   // ms
}

interface AttachedImage {
  data: string
  mimeType: string
  preview: string
}

let msgId = 0

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

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let i = 0, key = 0
  while (i < text.length) {
    if (text[i] === '*' && text[i+1] === '*') {
      const end = text.indexOf('**', i+2)
      if (end !== -1) { parts.push(<strong key={key++} style={{ color: 'var(--text)', fontWeight: 700 }}>{text.slice(i+2, end)}</strong>); i = end+2; continue }
    }
    if (text[i] === '*' && text[i+1] !== '*') {
      const end = text.indexOf('*', i+1)
      if (end !== -1) { parts.push(<em key={key++}>{text.slice(i+1, end)}</em>); i = end+1; continue }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i+1)
      if (end !== -1) {
        parts.push(<code key={key++} className="px-1 rounded" style={{ background: 'var(--bg-crust)', color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: '0.9em' }}>{text.slice(i+1, end)}</code>)
        i = end+1; continue
      }
    }
    let j = i+1
    while (j < text.length && text[j] !== '*' && text[j] !== '`') j++
    parts.push(<span key={key++}>{text.slice(i, j)}</span>)
    i = j
  }
  return parts
}

// ─── Mentor Review card renderer ────────────────────────────────────────────
function tryRenderReview(content: string): React.ReactNode | null {
  const jsonMatch = content.match(/\{[\s\S]*"score"[\s\S]*"praise"[\s\S]*"tips"[\s\S]*"challenge"[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const r = JSON.parse(jsonMatch[0])
    return (
      <div className="flex flex-col gap-2 w-full">
        {/* Score */}
        <div className="flex gap-2 mb-1">
          {Object.entries(r.score ?? {}).map(([k, v]) => (
            <span key={k} className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--bg-surface1)', color: 'var(--accent-mauve)' }}>
              {k}: {v as string}
            </span>
          ))}
        </div>

        {/* Praise — green */}
        {(r.praise as string[] ?? []).map((p: string, i: number) => (
          <div key={i} className="flex gap-2 items-start rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--accent-green)15', border: '1px solid var(--accent-green)44' }}>
            <span style={{ color: 'var(--accent-green)', flexShrink: 0 }}>✓</span>
            <span style={{ color: 'var(--text)' }}>{p}</span>
          </div>
        ))}

        {/* Tips — blue */}
        {(r.tips as { line: number; head: string; body: string }[] ?? []).map((t, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg px-3 py-2 text-xs cursor-pointer"
            style={{ background: 'var(--accent-blue)12', border: '1px solid var(--accent-blue)44' }}
            onClick={() => t.line > 0 && window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: t.line } }))}>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>💡</span>
              <span className="font-semibold" style={{ color: 'var(--accent-blue)' }}>{t.head}</span>
              {t.line > 0 && <span className="ml-auto opacity-60" style={{ fontFamily: 'monospace' }}>:{t.line}</span>}
            </div>
            <p style={{ color: 'var(--text-muted)', paddingLeft: 20 }}>{t.body}</p>
          </div>
        ))}

        {/* Challenge — orange */}
        <div className="flex gap-2 items-start rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--accent-mauve)15', border: '1px solid var(--accent-mauve)55' }}>
          <span style={{ color: 'var(--accent-mauve)', flexShrink: 0 }}>🎯</span>
          <div>
            <p className="font-semibold mb-0.5" style={{ color: 'var(--accent-mauve)' }}>Next challenge</p>
            <p style={{ color: 'var(--text)' }}>{r.challenge}</p>
          </div>
        </div>
      </div>
    )
  } catch { return null }
}

function renderMessage(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = []
  const parts = content.split(/(```[\w]*\n[\s\S]*?```|```[\w]*[\s\S]*?```)/g)
  let key = 0
  parts.forEach(part => {
    const codeMatch = part.match(/```([\w]*)\n?([\s\S]*?)```/)
    if (codeMatch) {
      blocks.push(
        <div key={key++} className="rounded overflow-hidden my-1.5" style={{ background: 'var(--bg-crust)', border: '1px solid var(--border)' }}>
          {codeMatch[1] && <div className="px-2 py-0.5 text-xs" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)' }}>{codeMatch[1]}</div>}
          <pre className="p-2 text-xs overflow-x-auto" style={{ color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>{codeMatch[2]}</pre>
        </div>
      ); return
    }
    part.split('\n').forEach(line => {
      if (!line.trim()) { blocks.push(<br key={key++} />); return }
      if (line.startsWith('### ')) blocks.push(<p key={key++} className="text-xs font-bold mt-2" style={{ color: 'var(--accent-mauve)' }}>{renderInline(line.slice(4))}</p>)
      else if (line.startsWith('## ')) blocks.push(<p key={key++} className="text-xs font-black mt-2" style={{ color: 'var(--accent-blue)' }}>{renderInline(line.slice(3))}</p>)
      else if (line.startsWith('# ')) blocks.push(<p key={key++} className="text-sm font-black mt-2" style={{ color: 'var(--text)' }}>{renderInline(line.slice(2))}</p>)
      else if (/^[-*]\s/.test(line)) blocks.push(<div key={key++} className="flex gap-1.5 items-start text-xs" style={{ color: 'var(--text)', marginLeft: 8 }}><span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>•</span><span>{renderInline(line.slice(2))}</span></div>)
      else if (/^\d+\.\s/.test(line)) {
        const num = line.match(/^(\d+)\./)?.[1]
        blocks.push(<div key={key++} className="flex gap-1.5 items-start text-xs" style={{ color: 'var(--text)', marginLeft: 8 }}><span style={{ color: 'var(--accent-blue)', flexShrink: 0, minWidth: 12 }}>{num}.</span><span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span></div>)
      } else blocks.push(<p key={key++} className="text-xs" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{renderInline(line)}</p>)
    })
  })
  return <div className="flex flex-col gap-0.5">{blocks}</div>
}

// ─── Thinking indicator (animated while streaming) ────────────────────────────
function ThinkingIndicator({ elapsed, tokens }: { elapsed: number; tokens: number }) {
  const secs = (elapsed / 1000).toFixed(1)
  const dots = [0, 1, 2].map(i => (
    <span key={i} className="inline-block w-1 h-1 rounded-full"
      style={{
        background: 'var(--accent-mauve)',
        animation: `bounce 1s ${i * 0.2}s infinite`,
        verticalAlign: 'middle',
        marginLeft: 2
      }} />
  ))
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg text-xs"
      style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
      {/* Animated thinking bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <KitsuneLogo size={13} />
          <span style={{ color: 'var(--accent-mauve)', fontSize: 11 }}>Kitsune is thinking</span>
          {dots}
        </div>
      </div>
      {/* Progress bar */}
      <div className="rounded-full overflow-hidden" style={{ height: 2, background: 'var(--bg-surface1)' }}>
        <div className="h-full rounded-full" style={{
          background: 'linear-gradient(90deg, var(--accent-mauve), var(--accent-blue))',
          width: `${Math.min(100, (elapsed / 30000) * 100)}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>
      {/* Stats */}
      <div className="flex gap-3" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
        <span>⏱ {secs}s</span>
        {tokens > 0 && <span>~{tokens} tokens out</span>}
      </div>
    </div>
  )
}

// ─── Token/timing footer after message completes ──────────────────────────────
function MessageFooter({ tokensIn, tokensOut, elapsed }: { tokensIn?: number; tokensOut?: number; elapsed?: number }) {
  if (!elapsed && !tokensIn && !tokensOut) return null
  const secs = elapsed ? (elapsed / 1000).toFixed(2) + 's' : null
  const tps   = (tokensOut && elapsed) ? Math.round(tokensOut / (elapsed / 1000)) + ' t/s' : null
  return (
    <div className="flex gap-2 mt-1 flex-wrap" style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
      {secs && <span>⏱ {secs}</span>}
      {tokensIn  && <span>↑ {tokensIn.toLocaleString()} in</span>}
      {tokensOut && <span>↓ {tokensOut.toLocaleString()} out</span>}
      {tps && <span>⚡ {tps}</span>}
    </div>
  )
}

// ─── Smart apply helpers ──────────────────────────────────────────────────────
function applyCodeToFile(original: string, suggested: string): string {
  const defPatterns = [/^(\s*)(def |async def |class |function |const |let |var |func |fn )/, /^(\s*)(public |private |protected |static )/]
  const sugLines = suggested.split('\n')
  const firstDef = sugLines.find(l => defPatterns.some(p => p.test(l)))
  if (!firstDef) {
    const sim = computeSimilarity(original, suggested)
    return sim > 0.6 ? suggested : original + '\n\n' + suggested
  }
  const defName = extractName(firstDef)
  if (!defName) return suggested
  const origLines = original.split('\n')
  const startIdx = origLines.findIndex(l => l.includes(defName) && defPatterns.some(p => p.test(l)))
  if (startIdx === -1) return original + '\n\n' + suggested
  const indent = origLines[startIdx].match(/^(\s*)/)?.[1] ?? ''
  let endIdx = startIdx + 1
  while (endIdx < origLines.length) {
    const line = origLines[endIdx]
    if (line.trim() === '') { endIdx++; continue }
    const li = line.match(/^(\s*)/)?.[1] ?? ''
    if (li.length <= indent.length && defPatterns.some(p => p.test(line))) break
    endIdx++
  }
  return [origLines.slice(0, startIdx).join('\n'), suggested, origLines.slice(endIdx).join('\n')].filter(Boolean).join('\n')
}
function extractName(line: string) { return line.match(/(?:def|class|function|func|fn|const|let|var)\s+(\w+)/)?.[1] ?? '' }
function computeSimilarity(a: string, b: string) { const sa = new Set(a.split(/\s+/)), sb = new Set(b.split(/\s+/)); let c = 0; sb.forEach(w => { if (sa.has(w)) c++ }); return c / Math.max(sa.size, sb.size) }

// ─── Diff viewer ──────────────────────────────────────────────────────────────
function DiffViewer({ original, suggested, onApply, onCancel }: { original: string; suggested: string; onApply: () => void; onCancel: () => void }) {
  const rows: { type: 'same'|'add'|'del'; line: string }[] = []
  const oL = original.split('\n'), sL = suggested.split('\n')
  for (let i = 0; i < Math.max(oL.length, sL.length); i++) {
    const o = oL[i], s = sL[i]
    if (o === s) rows.push({ type: 'same', line: s ?? '' })
    else { if (o !== undefined) rows.push({ type: 'del', line: o }); if (s !== undefined) rows.push({ type: 'add', line: s }) }
  }
  const added = rows.filter(r => r.type === 'add').length, deleted = rows.filter(r => r.type === 'del').length
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="flex flex-col rounded-xl shadow-2xl overflow-hidden" style={{ width: 640, maxHeight: '80vh', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>🔀 Diff Preview</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)' }}>+{added}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-red)22', color: 'var(--accent-red)' }}>-{deleted}</span>
          </div>
          <button onClick={onCancel} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs" style={{ background: 'var(--bg-crust)' }}>
          {rows.map((r, i) => {
            const bg = r.type === 'add' ? '#a6e3a118' : r.type === 'del' ? '#f38ba818' : 'transparent'
            const color = r.type === 'add' ? 'var(--accent-green)' : r.type === 'del' ? 'var(--accent-red)' : 'var(--text-muted)'
            return (
              <div key={i} className="flex" style={{ background: bg }}>
                <span className="w-6 text-center flex-shrink-0 select-none" style={{ color, borderRight: '1px solid var(--border)' }}>{r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '}</span>
                <span className="px-2 py-px whitespace-pre" style={{ color }}>{r.line}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
          <button onClick={onApply} className="flex-1 py-2 rounded text-xs font-bold" style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>✓ Apply to Editor</button>
          <button onClick={onCancel} className="px-4 py-2 rounded text-xs" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Context window sizes per model ──────────────────────────────────────────
const CONTEXT_WINDOWS: Record<string, number> = {
  // Claude — all 200k
  'claude-haiku-4-5':   200_000,
  'claude-sonnet-4-5':  200_000,
  'claude-sonnet-4-6':  200_000,
  'claude-opus-4-5':    200_000,
  // Gemini
  'gemini-3-flash-preview': 1_048_576,
  'gemini-2.0-flash':       1_048_576,
  'gemini-2.0-flash-exp':   1_048_576,
  'gemini-1.5-flash':       1_048_576,
  'gemini-1.5-flash-8b':    1_048_576,
  'gemini-1.5-pro':         2_097_152,
  // GPT
  'gpt-4o':             128_000,
  'gpt-4o-mini':        128_000,
  'gpt-4-turbo':        128_000,
  'o1-mini':            128_000,
}

function getContextWindow(model: string): number {
  if (CONTEXT_WINDOWS[model]) return CONTEXT_WINDOWS[model]
  if (model.includes('gemini')) return 1_048_576
  if (model.includes('claude')) return 200_000
  return 128_000
}

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return Math.round(n / 1_000) + 'k'
  return String(n)
}

// ─── Context bar component ────────────────────────────────────────────────────
function ContextBar({ used, model }: { used: number; model: string }) {
  const total  = getContextWindow(model)
  const pct    = Math.min(100, (used / total) * 100)
  const remain = Math.max(0, total - used)
  const color  = pct > 85 ? 'var(--accent-red)' : pct > 60 ? 'var(--accent-yellow)' : 'var(--accent-green)'

  return (
    <div className="flex flex-col gap-1 px-3 py-1.5 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-crust)' }}>
      {/* Bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>Context</span>
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-surface1)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs flex-shrink-0 font-mono" style={{ color, fontSize: 10 }}>
          {fmtK(used)}/{fmtK(total)}
        </span>
      </div>
      {/* Details */}
      <div className="flex gap-3" style={{ fontSize: 9, color: 'var(--text-subtle)' }}>
        <span style={{ color }}>● {pct.toFixed(1)}% used</span>
        <span>↓ {fmtK(remain)} remaining</span>
        <span style={{ marginLeft: 'auto' }}>{model}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AIPanel() {
  const { aiProviders, tabs, activeTabId, updateTabContent, markTabClean, updateAIProvider, currentFolder } = useAppStore()
  const [aiTab, setAiTab] = useState<'chat' | 'agent' | 'memory'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [kitsuneExpr, setKitsuneExpr] = useState<'normal' | 'thinking' | 'happy'>('normal')
  const [selectedProviderId, setSelectedProviderId] = useState('claude')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)
  const [diffState, setDiffState] = useState<{ original: string; suggested: string } | null>(null)
  const [streamElapsed, setStreamElapsed] = useState(0)
  const [streamTokens, setStreamTokens]   = useState(0)
  const [contextUsed, setContextUsed]     = useState(0)
  // ── Kitsune Persona ───────────────────────────────────────────────────────
  type Persona = 'beginner' | 'developer' | 'creative'
  const [persona, setPersona] = useState<Persona>(() =>
    (localStorage.getItem('momiji:kitsune-persona') as Persona) ?? 'developer'
  )
  const PERSONA_LABELS: Record<Persona, { icon: string; label: string }> = {
    beginner:  { icon: '🧒', label: 'Beginner' },
    developer: { icon: '⚡', label: 'Dev' },
    creative:  { icon: '🎨', label: 'Creative' },
  }
  const handleSetPersona = (p: Persona) => {
    setPersona(p)
    localStorage.setItem('momiji:kitsune-persona', p)
  }

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
    setAiTab('chat')
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

  // ── System prompt (persona-aware) ────────────────────────────────────────
  const PERSONA_PROMPTS: Record<Persona, string> = {
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

  const buildSystemPrompt = () => {
    let sys = PERSONA_PROMPTS[persona]
    if (autoContext) sys += `\n\n## Project Info\n${autoContext}`
    if (projectMemory.trim()) sys += `\n\n## Project Memory\n${projectMemory}`
    if (activeTab) sys += `\n\n## Current file: ${activeTab.fileName} (${activeTab.language})\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 4000)}\n\`\`\``
    return sys
  }

  // ── Claude streaming + usage ──────────────────────────────────────────────
  const callClaudeStream = async (
    provider: typeof aiProviders[0], userMessage: string, image: AttachedImage | null,
    onChunk: (t: string) => void, onUsage: (inTok: number, outTok: number) => void
  ) => {
    abortRef.current = new AbortController()
    const userContent: any[] = []
    if (image) userContent.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } })
    userContent.push({ type: 'text', text: userMessage })
    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))

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
    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
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
    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
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
    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
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
    }
    // custom provider: use baseUrl directly, strip trailing slash
    const baseUrl = provider.baseUrl?.replace(/\/$/, '')
    const url = baseUrl ? `${baseUrl}/v1/chat/completions` : ENDPOINTS[provider.id]
    if (!url) throw new Error(`Unknown provider: ${provider.id}`)
    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
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
    if ((!textToSend.trim() && !attachedImage) || isLoading || !activeProvider) return
    const userMessage   = textToSend.trim() || '(analyze this image)'
    const imageSnapshot = attachedImage
    if (!overridePrompt) setInput('')
    setAttachedImage(null)

    setMessages(prev => [...prev, { role: 'user', content: userMessage, id: msgId++, image: imageSnapshot?.preview }])
    setIsLoading(true)
    setKitsuneExpr('thinking')
    startTimer()

    const streamId = msgId++
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: streamId, streaming: true }])

    try {
      if (activeProvider.id === 'claude') {
        let full = '', inTok = 0, outTok = 0
        await callClaudeStream(activeProvider, userMessage, imageSnapshot,
          chunk => {
            full += chunk
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: full } : m))
          },
          (i, o) => { inTok = i; outTok = o }
        )
        const elapsed = stopTimer()
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, streaming: false, tokensIn: inTok, tokensOut: outTok, elapsed } : m))
        if (inTok > 0) setContextUsed(inTok + outTok)
      } else if (activeProvider.id === 'gemini') {
        const { text, tokensIn, tokensOut } = await callGemini(activeProvider, userMessage, imageSnapshot)
        const elapsed = stopTimer()
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
        if (tokensIn) setContextUsed(tokensIn + (tokensOut ?? 0))
      } else if (activeProvider.id === 'ollama') {
        const { text, tokensIn, tokensOut } = await callOllama(activeProvider, userMessage, imageSnapshot)
        const elapsed = stopTimer()
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
        if (tokensIn) setContextUsed(tokensIn + (tokensOut ?? 0))
      } else if (['groq','openrouter','deepseek','mistral','custom'].includes(activeProvider.id)) {
        const { text, tokensIn, tokensOut } = await callOpenAICompat(activeProvider, userMessage, imageSnapshot)
        const elapsed = stopTimer()
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
        if (tokensIn) setContextUsed(tokensIn + (tokensOut ?? 0))
      } else {
        const { text, tokensIn, tokensOut } = await callOpenAI(activeProvider, userMessage, imageSnapshot)
        const elapsed = stopTimer()
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: text, streaming: false, tokensIn, tokensOut, elapsed } : m))
        if (tokensIn) setContextUsed(tokensIn + (tokensOut ?? 0))
      }
    } catch (err: unknown) {
      stopTimer()
      const msg = err instanceof Error ? err.message : 'Unknown error'
      let friendly = `❌ **Error:** ${msg}`
      if (msg.includes('aborted')) { setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: m.content + '\n\n_[stopped]_', streaming: false } : m)); setIsLoading(false); setKitsuneExpr('normal'); return }
      if (msg.includes('quota') || msg.includes('limit: 0') || msg.includes('RESOURCE_EXHAUSTED')) {
        friendly = `❌ **API Quota / Access Error** (model: \`${activeProvider?.model}\`)\n\n"limit: 0" usually means Gemini API is not enabled for this key's project.\n\n**Fix:**\n1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)\n2. Create a new API key there\n3. Paste it in ⚙️ Settings → AI & API Keys\n\n__FIX_BUTTON__`
      } else if (msg.includes('401') || msg.includes('API_KEY') || msg.includes('invalid')) {
        friendly = `❌ **Invalid API Key** — Check ⚙️ Settings → AI & API Keys.\nMake sure the key is correct and Enabled toggle is ON.`
      } else if (msg.includes('Failed to fetch') || msg.includes('network')) {
        friendly = `❌ **Network Error** — Could not reach the API. Check your internet connection.`
      } else if (msg.includes('MIME') || msg.includes('mime') || msg.includes('image')) {
        friendly = `❌ **Image Error** — ${msg}\n\nTry a PNG or JPEG screenshot instead.`
      }
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: friendly, streaming: false } : m))
    }
    setIsLoading(false)
    setKitsuneExpr('happy')
    setTimeout(() => setKitsuneExpr('normal'), 3000)
  }, [input, attachedImage, isLoading, activeProvider, messages, activeTab])

  // Keep ref in sync so event listeners always use latest closure
  useEffect(() => { handleSendRef.current = handleSend }, [handleSend])

  const handleStop = () => { abortRef.current?.abort(); stopTimer(); setIsLoading(false); setKitsuneExpr('normal') }

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
    await navigator.clipboard.writeText(blocks[0] ?? content)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500)
  }
  const handleInsertCode = (content: string) => {
    if (!activeTab) return
    const code = extractCodeBlocks(content)[0] ?? content
    const nc = activeTab.content + '\n\n' + code
    updateTabContent(activeTab.id, nc)
    window.api.fs.writeFile(activeTab.filePath, nc).then(() => markTabClean(activeTab.id))
  }

  const quickActions = [
    { label: '🔍 Explain', prompt: 'Explain what this code does clearly.' },
    { label: '🐛 Find bugs', prompt: 'Analyze for bugs. List with line references.' },
    { label: '✨ Refactor', prompt: 'Refactor to be cleaner. Output complete updated code.' },
    { label: '🧪 Tests', prompt: 'Write comprehensive unit tests.' },
    { label: '⚡ Optimize', prompt: 'Optimize for performance. Output complete updated code.' },
    { label: '📝 Add docs', prompt: 'Add JSDoc/docstring comments. Output complete updated code.' },
    { label: '🔒 Security', prompt: 'Review for security vulnerabilities. Rate each: Critical/High/Medium/Low.' },
    { label: '📊 Review', prompt: 'Full code review. Rate 1–10 on correctness, performance, readability, security.' },
  ]

  return (
    <div className="flex flex-col h-full">
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>

      {diffState && <DiffViewer original={diffState.original} suggested={diffState.suggested} onApply={confirmApply} onCancel={() => setDiffState(null)} />}

      {/* Header + Chat/Agent tabs */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="px-3 py-2 flex items-center gap-2">
          <img
            src={kitsuneExpr === 'thinking' ? kitsuneConfuse : kitsuneExpr === 'happy' ? kitsuneHappy : kitsuneNormal}
            style={{ width: 28, height: 28, objectFit: 'contain', transition: 'all 0.3s ease', flexShrink: 0 }}
            alt="Kitsune"
          />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--accent-mauve)', letterSpacing: '0.12em' }}>KITSUNE AI</span>
          {isLoading && aiTab === 'chat' && <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44', fontSize: 9 }}>● live</span>}
          <div className="flex-1" />
          {/* Provider/model picker moved to input footer */}
          {aiTab === 'chat' && messages.length > 0 && !isLoading && (
            <button onClick={() => { setMessages([]); setContextUsed(0) }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Clear</button>
          )}
        </div>
        {/* Chat / Agent / Memory switcher */}
        <div className="flex">
          {([['chat', '💬 Chat'], ['agent', '🤖 Agent'], ['memory', '🧠 Memory']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAiTab(id)}
              className="flex-1 py-1.5 text-xs font-semibold transition-colors"
              style={{ color: aiTab === id ? 'var(--accent-mauve)' : 'var(--text-muted)', borderBottom: aiTab === id ? '2px solid var(--accent-mauve)' : '2px solid transparent', background: 'transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Persona selector — only in chat tab */}
        {aiTab === 'chat' && (
          <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <span className="text-xs mr-1" style={{ color: 'var(--text-subtle)' }}>Persona:</span>
            {(Object.entries(PERSONA_LABELS) as [Persona, { icon: string; label: string }][]).map(([p, { icon, label }]) => (
              <button
                key={p}
                onClick={() => handleSetPersona(p)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
                style={{
                  background: persona === p ? 'var(--accent-mauve)28' : 'transparent',
                  border: `1px solid ${persona === p ? 'var(--accent-mauve)' : 'transparent'}`,
                  color: persona === p ? 'var(--accent-mauve)' : 'var(--text-subtle)',
                  fontWeight: persona === p ? 600 : 400,
                }}
                title={p === 'beginner' ? 'Simple analogies, encouraging tone' : p === 'developer' ? 'Technical, direct, concise' : 'Visual, game/creative focused'}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Agent tab */}
      {aiTab === 'agent' && <KitsuneAgent />}

      {/* Memory tab */}
      {aiTab === 'memory' && (
        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          {/* Auto-detected context */}
          {autoContext && (
            <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-blue)' }}>⚡ Auto-detected</p>
              {autoContext.split('\n').map((line, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>{line}</p>
              ))}
            </div>
          )}

          {/* User memory editor */}
          <div className="flex flex-col flex-1 gap-2 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>📝 Project Context</p>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {currentFolder ? '.momiji/kitsune-memory.md' : 'Open a folder first'}
              </span>
            </div>
            <textarea
              value={memoryDraft}
              onChange={e => setMemoryDraft(e.target.value)}
              disabled={!currentFolder}
              placeholder={`Tell Kitsune about this project...\n\nExamples:\n- Tech stack: React + FastAPI + PostgreSQL\n- Coding style: functional, no classes\n- Avoid: lodash, moment.js\n- Always use TypeScript strict mode\n- API base URL: http://localhost:8000`}
              className="flex-1 p-2.5 rounded-lg text-xs resize-none outline-none font-mono"
              style={{
                background: 'var(--bg-surface0)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                opacity: currentFolder ? 1 : 0.5,
                minHeight: 0,
              }}
            />
            <button
              onClick={saveMemory}
              disabled={!currentFolder || memoryDraft === projectMemory}
              className="py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: memorySaved ? 'var(--accent-green)' : (memoryDraft !== projectMemory && currentFolder) ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                color: (memorySaved || (memoryDraft !== projectMemory && currentFolder)) ? 'white' : 'var(--text-subtle)',
                border: '1px solid var(--border)',
              }}
            >
              {memorySaved ? '✓ Saved!' : 'Save Memory'}
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            💡 Memory is included in every message as project context. Kitsune will know your stack, conventions, and preferences automatically.
          </p>
        </div>
      )}

      {/* Chat tab — only renders when aiTab === 'chat' */}
      {aiTab === 'chat' && (enabledProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-4 text-center">
          <KitsuneLogo size={48} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Kitsune is waiting for a key</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Go to ⚙️ Settings → AI & API Keys to add your API key.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                {/* Kitsune idle character */}
                <div className="flex flex-col items-center py-2" style={{ gap: 6 }}>
                  <img
                    src={kitsuneNormal}
                    alt="Kitsune"
                    style={{
                      width: 110, objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 16px rgba(251,146,60,0.2))',
                      animation: 'kitsuneIdleFloat 3s ease-in-out infinite',
                    }}
                  />
                  <p className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>Hey! I'm Kitsune 🦊</p>
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)', maxWidth: 180 }}>Ask me anything or pick a quick action below</p>
                </div>
                <style>{`@keyframes kitsuneIdleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Quick actions on current file:</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map(a => (
                    <button key={a.label} onClick={() => setInput(a.prompt)}
                      className="text-xs px-2 py-1 rounded-full transition-colors"
                      style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>💡 Paste any image with Ctrl+V to analyze UI/errors/screenshots</p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.image && <img src={msg.image} alt="" className="rounded-lg" style={{ maxHeight: 120, objectFit: 'contain', border: '1px solid var(--border)' }} />}

                {/* Thinking indicator (replaces empty streaming bubble) */}
                {msg.role === 'assistant' && msg.streaming && !msg.content ? (
                  <ThinkingIndicator elapsed={streamElapsed} tokens={streamTokens} />
                ) : (
                  <div className="rounded-lg px-3 py-2 text-xs max-w-full"
                    style={{ background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: msg.role === 'user' ? 'var(--bg-base)' : 'var(--text)', wordBreak: 'break-word' }}>
                    {msg.role === 'assistant'
                      ? <>
                          {tryRenderReview(msg.content) ?? renderMessage(msg.content.replace('__FIX_BUTTON__', ''))}
                          {msg.content.includes('__FIX_BUTTON__') && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {['gemini-1.5-flash', 'gemini-3-flash-preview'].map(m => (
                                <button key={m} onClick={() => { const p = aiProviders.find(p => p.id === 'gemini'); if (p) { updateAIProvider({ ...p, model: m }); setMessages(prev => [...prev, { role: 'assistant', content: `✅ Switched to \`${m}\`. Try again!`, id: msgId++ }]) } }}
                                  className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
                                  🔧 Switch to {m}
                                </button>
                              ))}
                            </div>
                          )}
                          {msg.streaming && msg.content && <span className="animate-pulse ml-0.5" style={{ color: 'var(--accent-blue)' }}>▌</span>}
                        </>
                      : msg.content
                    }
                  </div>
                )}

                {/* Token / timing footer */}
                {msg.role === 'assistant' && !msg.streaming && (
                  <MessageFooter tokensIn={msg.tokensIn} tokensOut={msg.tokensOut} elapsed={msg.elapsed} />
                )}

                {/* Action buttons */}
                {msg.role === 'assistant' && !msg.streaming && extractCodeBlocks(msg.content).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {activeTab && (
                      <button onClick={() => handleSmartApply(msg.content)}
                        className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{ background: 'var(--accent-mauve)', color: 'white' }}>
                        ⚡ Apply to Editor
                      </button>
                    )}
                    <button onClick={() => handleCopyCode(msg.content, msg.id)}
                      className="text-xs px-2 py-0.5 rounded transition-all"
                      style={{ background: copiedId === msg.id ? 'var(--accent-green)' : 'var(--bg-surface0)', color: copiedId === msg.id ? 'var(--bg-base)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {copiedId === msg.id ? '✓ Copied' : '📋 Copy'}
                    </button>
                    {activeTab && (
                      <button onClick={() => handleInsertCode(msg.content)}
                        className="text-xs px-2 py-0.5 rounded transition-all"
                        style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--bg-base)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                        ↙ Insert
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Context window bar */}
          {activeProvider && contextUsed > 0 && (
            <ContextBar used={contextUsed} model={activeProvider.model} />
          )}

          {/* Input */}
          <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            {attachedImage && (
              <div className="relative mb-2 inline-block">
                <img src={attachedImage.preview} alt="" className="rounded-lg" style={{ maxHeight: 80, objectFit: 'contain', border: '1px solid var(--border)' }} />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: 'var(--accent-red)', color: 'white' }}>✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                onPaste={handlePaste}
                placeholder={attachedImage ? 'Describe what you want… (Enter to send)' : 'Ask Kitsune… Ctrl+V to paste image · Enter to send'}
                rows={3} disabled={isLoading}
                className="flex-1 px-2 py-1.5 rounded text-xs resize-none outline-none"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', opacity: isLoading ? 0.6 : 1 }}
              />
              {isLoading
                ? <button onClick={handleStop} className="px-2 py-1 rounded text-xs font-bold self-end" style={{ background: 'var(--accent-red)', color: 'white' }} title="Stop">■</button>
                : <button onClick={handleSend} disabled={!input.trim() && !attachedImage}
                    className="px-2 py-1 rounded text-xs font-medium self-end transition-all"
                    style={{ background: (!input.trim() && !attachedImage) ? 'var(--bg-surface0)' : 'var(--accent-blue)', color: (!input.trim() && !attachedImage) ? 'var(--text-muted)' : 'var(--bg-base)' }}>▶</button>
              }
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <ModelSelector
                selectedProviderId={selectedProviderId}
                onProviderChange={setSelectedProviderId}
              />
              <div className="flex items-center gap-1.5 ml-auto">
                {activeProvider?.id === 'claude' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-green)15', color: 'var(--accent-green)', fontSize: 9 }}>streaming</span>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontSize: 9 }}>📷 vision</span>
                {isLoading && (
                  <span className="text-xs" style={{ color: 'var(--accent-mauve)', fontSize: 10 }}>
                    ⏱ {(streamElapsed/1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      ))}
    </div>
  )
}
