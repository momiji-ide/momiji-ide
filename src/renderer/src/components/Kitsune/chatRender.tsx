import { useState } from 'react'
import { KitsuneLogo } from '../Logo/KitsuneLogo'

// ─── Markdown renderer ────────────────────────────────────────────────────────
export function renderInline(text: string): React.ReactNode[] {
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
        parts.push(<code key={key++} className="px-1 rounded" style={{ background: 'var(--bg-crust)', color: 'var(--accent-mauve)', fontFamily: 'monospace', fontSize: '0.9em' }}>{text.slice(i+1, end)}</code>)
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
export function tryRenderReview(content: string): React.ReactNode | null {
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
            style={{ background: 'var(--accent-mauve)12', border: '1px solid var(--accent-mauve)44' }}
            onClick={() => t.line > 0 && window.dispatchEvent(new CustomEvent('editor:jumpToLine', { detail: { line: t.line } }))}>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--accent-mauve)', flexShrink: 0 }}>💡</span>
              <span className="font-semibold" style={{ color: 'var(--accent-mauve)' }}>{t.head}</span>
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

// Claude-Code style: code blocks are collapsed by default, click header to expand.
// User can peek the chunk and copy without scrolling through a wall of code.
export function CollapsibleCodeBlock({ lang, code }: { lang: string; code: string }) {
  const lines = code.split('\n').length
  // Auto-expand short snippets (≤8 lines feel inline); long blocks stay collapsed.
  const [open, setOpen] = useState(lines <= 8)
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="rounded overflow-hidden my-1.5" style={{ background: 'var(--bg-crust)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-xs"
        style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
        <span style={{ color: 'var(--accent-mauve)', fontSize: 10, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <span style={{ color: lang ? 'var(--accent-green)' : 'var(--text-subtle)' }}>{lang || 'code'}</span>
        <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>· {lines} {lines === 1 ? 'line' : 'lines'}</span>
        <span className="flex-1" />
        <span
          role="button"
          onClick={handleCopy}
          className="px-1.5 py-0.5 rounded"
          style={{ color: copied ? 'var(--accent-green)' : 'var(--text-subtle)', fontSize: 10, border: '1px solid var(--border)' }}>
          {copied ? '✓' : '📋'}
        </span>
      </button>
      {open && (
        <pre className="p-2 text-xs overflow-x-auto" style={{ color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre', margin: 0, maxHeight: 360, overflowY: 'auto' }}>{code}</pre>
      )}
    </div>
  )
}

export function renderMessage(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = []
  const parts = content.split(/(```[\w]*\n[\s\S]*?```|```[\w]*[\s\S]*?```)/g)
  let key = 0
  parts.forEach(part => {
    const codeMatch = part.match(/```([\w]*)\n?([\s\S]*?)```/)
    if (codeMatch) {
      blocks.push(<CollapsibleCodeBlock key={key++} lang={codeMatch[1]} code={codeMatch[2].replace(/\n$/, '')} />); return
    }
    part.split('\n').forEach(line => {
      if (!line.trim()) { blocks.push(<br key={key++} />); return }
      if (line.startsWith('### ')) blocks.push(<p key={key++} className="text-xs font-bold mt-2" style={{ color: 'var(--accent-mauve)' }}>{renderInline(line.slice(4))}</p>)
      else if (line.startsWith('## ')) blocks.push(<p key={key++} className="text-xs font-black mt-2" style={{ color: 'var(--accent-mauve)' }}>{renderInline(line.slice(3))}</p>)
      else if (line.startsWith('# ')) blocks.push(<p key={key++} className="text-sm font-black mt-2" style={{ color: 'var(--text)' }}>{renderInline(line.slice(2))}</p>)
      else if (/^[-*]\s/.test(line)) blocks.push(<div key={key++} className="flex gap-1.5 items-start text-xs" style={{ color: 'var(--text)', marginLeft: 8 }}><span style={{ color: 'var(--accent-mauve)', flexShrink: 0 }}>•</span><span>{renderInline(line.slice(2))}</span></div>)
      else if (/^\d+\.\s/.test(line)) {
        const num = line.match(/^(\d+)\./)?.[1]
        blocks.push(<div key={key++} className="flex gap-1.5 items-start text-xs" style={{ color: 'var(--text)', marginLeft: 8 }}><span style={{ color: 'var(--accent-mauve)', flexShrink: 0, minWidth: 12 }}>{num}.</span><span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span></div>)
      } else blocks.push(<p key={key++} className="text-xs" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{renderInline(line)}</p>)
    })
  })
  return <div className="flex flex-col gap-0.5">{blocks}</div>
}

// ─── Inline tool-call activity row (role: 'tool' messages) ────────────────────
const TOOL_ICONS: Record<string, string> = {
  read_file: '📖', write_file: '✏️', list_directory: '📁',
  search_in_files: '🔍', create_folder: '📂', delete_file: '🗑️',
  thinking: '🤔',
}
const TOOL_LABELS: Record<string, string> = {
  thinking: 'Kitsune is working…',
}
export function ToolActivityRow({ tool, args, status, result }: { tool: string; args: Record<string, any>; status: 'running' | 'done' | 'error'; result?: string }) {
  const [open, setOpen] = useState(false)
  const target = args.path ?? args.query ?? ''
  const statusIcon = status === 'running' ? '⏳' : status === 'error' ? '⚠️' : '✓'
  const statusColor = status === 'running' ? 'var(--accent-yellow)' : status === 'error' ? 'var(--accent-red)' : 'var(--accent-green)'
  return (
    <div className="rounded-lg overflow-hidden self-start max-w-full" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 px-2 py-1 text-xs w-full text-left" style={{ color: 'var(--text-muted)' }}>
        <span className={status === 'running' ? 'animate-pulse' : ''}>{TOOL_ICONS[tool] ?? '🔧'}</span>
        <span className="font-mono" style={{ color: 'var(--accent-mauve)' }}>{TOOL_LABELS[tool] ?? tool}</span>
        {target && <span className="font-mono truncate" style={{ color: 'var(--text-subtle)', maxWidth: 220 }}>{String(target)}</span>}
        <span className="ml-auto" style={{ color: statusColor }}>{statusIcon}</span>
      </button>
      {open && result && (
        <pre className="px-2 pb-2 text-xs overflow-x-auto" style={{ color: 'var(--text-subtle)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0, maxHeight: 200, overflowY: 'auto' }}>{result}</pre>
      )}
    </div>
  )
}

// ─── Pending write approval card ───────────────────────────────────────────────
export function PendingWriteCard({ path, content, onAccept, onReject }: { path: string; content: string; onAccept: () => void; onReject: () => void }) {
  const [open, setOpen] = useState(false)
  const lines = content.split('\n').length
  return (
    <div className="rounded-lg overflow-hidden self-start max-w-full w-full" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--accent-mauve)55' }}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 px-2 py-1.5 text-xs w-full text-left">
        <span>✏️</span>
        <span className="font-mono truncate" style={{ color: 'var(--accent-mauve)' }}>{path}</span>
        <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>· {lines} lines</span>
        <span className="ml-auto" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="px-2 pb-2 text-xs overflow-x-auto" style={{ color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre', margin: 0, maxHeight: 240, overflowY: 'auto' }}>{content}</pre>
      )}
      <div className="flex gap-2 px-2 pb-2">
        <button onClick={onAccept} className="flex-1 py-1 rounded text-xs font-semibold" style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>✓ Accept</button>
        <button onClick={onReject} className="flex-1 py-1 rounded text-xs" style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>✕ Reject</button>
      </div>
    </div>
  )
}

// ─── Thinking indicator (animated while streaming) ────────────────────────────
interface ThinkingProps {
  elapsed: number
  tokens: number
  contextUsed?: number
  filesWritten?: string[]
  toolCallCount?: number
}
export function ThinkingIndicator({ elapsed, tokens, contextUsed, filesWritten, toolCallCount }: ThinkingProps) {
  const secs = (elapsed / 1000).toFixed(1)
  const fmtTok = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
  const tps = elapsed > 1000 && tokens > 0 ? Math.round(tokens / (elapsed / 1000)) : 0
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg text-xs"
      style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <KitsuneLogo size={13} />
        <span className="font-medium" style={{ color: 'var(--accent-mauve)', fontSize: 11 }}>Kitsune is working</span>
        <span className="animate-pulse" style={{ color: 'var(--accent-green)', fontSize: 9 }}>● live</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 2, background: 'var(--bg-surface1)' }}>
        <div className="h-full rounded-full" style={{
          background: 'var(--accent-mauve)',
          width: `${Math.min(100, (elapsed / 30000) * 100)}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>
      <div className="flex gap-3 flex-wrap" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
        <span>⏱ {secs}s</span>
        {contextUsed ? <span>↑ {fmtTok(contextUsed)}</span> : null}
        {tokens > 0 && <span>↓ ~{fmtTok(tokens)}</span>}
        {tps > 0 && <span>⚡ {tps} t/s</span>}
        {(toolCallCount ?? 0) > 0 && <span>🔧 {toolCallCount} calls</span>}
      </div>
      {(filesWritten?.length ?? 0) > 0 && (
        <div className="flex gap-1 flex-wrap">
          {filesWritten!.map(p => (
            <span key={p} className="px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--bg-surface1)', color: 'var(--accent-green)', fontSize: 9 }}>
              ✓ {p.split(/[\\/]/).pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Token/timing footer after message completes ──────────────────────────────
export function MessageFooter({ tokensIn, tokensOut, elapsed }: { tokensIn?: number; tokensOut?: number; elapsed?: number }) {
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
export function applyCodeToFile(original: string, suggested: string): string {
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
export function extractName(line: string) { return line.match(/(?:def|class|function|func|fn|const|let|var)\s+(\w+)/)?.[1] ?? '' }
export function computeSimilarity(a: string, b: string) { const sa = new Set(a.split(/\s+/)), sb = new Set(b.split(/\s+/)); let c = 0; sb.forEach(w => { if (sa.has(w)) c++ }); return c / Math.max(sa.size, sb.size) }

// ─── Diff viewer ──────────────────────────────────────────────────────────────
export function DiffViewer({ original, suggested, onApply, onCancel }: { original: string; suggested: string; onApply: () => void; onCancel: () => void }) {
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

export function getContextWindow(model: string): number {
  if (CONTEXT_WINDOWS[model]) return CONTEXT_WINDOWS[model]
  if (model.includes('gemini')) return 1_048_576
  if (model.includes('claude')) return 200_000
  return 128_000
}

export function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return Math.round(n / 1_000) + 'k'
  return String(n)
}

// ─── Context bar component ────────────────────────────────────────────────────
export function ContextBar({ used, model }: { used: number; model: string }) {
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
