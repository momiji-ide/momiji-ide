/**
 * GitPanel — Source control sidebar
 * Stage · Unstage · Diff · Commit · Push/Pull · Branch switcher · AI commit msg
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'

interface GitFile { status: string; staged: boolean; path: string }
interface Commit   { hash: string; subject: string; author: string; date: string }

// Simple markdown renderer for review output
function ReviewMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          const head = line.slice(3)
          const color = head.includes('🔴') ? 'var(--accent-red)'
            : head.includes('🟡') ? 'var(--accent-yellow)'
            : head.includes('🟢') ? 'var(--accent-green)'
            : head.includes('✅') ? 'var(--accent-teal)'
            : 'var(--accent-mauve)'
          return <h3 key={i} style={{ color, fontWeight: 700, fontSize: 12, marginTop: 14, marginBottom: 4, paddingBottom: 4, borderBottom: `1px solid ${color}44` }}>{head}</h3>
        }
        if (line.startsWith('- **')) {
          const m = line.match(/^- \*\*(.+?)\*\*: (.+)/)
          if (m) return <div key={i} style={{ marginLeft: 8, marginBottom: 4 }}>
            <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>• {m[1]}:</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{m[2]}</span>
          </div>
        }
        if (line.startsWith('- ')) return <div key={i} style={{ marginLeft: 8, marginBottom: 2, color: 'var(--text-muted)' }}>• {line.slice(2)}</div>
        if (line.trim() === '' ) return <div key={i} style={{ height: 6 }} />
        return <p key={i} style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{line}</p>
      })}
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    M: ['M', 'var(--accent-yellow)'], A: ['A', 'var(--accent-green)'],
    D: ['D', 'var(--accent-red)'],   R: ['R', 'var(--accent-blue)'],
    '??': ['U', 'var(--text-subtle)'],
  }
  const [label, color] = map[s] ?? [s, 'var(--text-subtle)']
  return <span style={{ color, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', width: 14, textAlign: 'center', flexShrink: 0 }}>{label}</span>
}

function DiffViewer({ diff }: { diff: string }) {
  return (
    <div className="overflow-auto" style={{ flex: 1, background: 'var(--bg-crust)', fontFamily: 'monospace', fontSize: 10 }}>
      {diff.split('\n').map((line, i) => {
        const add = line.startsWith('+') && !line.startsWith('+++')
        const del = line.startsWith('-') && !line.startsWith('---')
        const hdr = line.startsWith('@@')
        return (
          <div key={i} className="px-2 leading-5 whitespace-pre-wrap break-all" style={{
            background: add ? 'rgba(166,227,161,.12)' : del ? 'rgba(243,139,168,.12)' : hdr ? 'rgba(137,180,250,.08)' : 'transparent',
            color:      add ? 'var(--accent-green)'  : del ? 'var(--accent-red)'      : hdr ? 'var(--accent-blue)'     : 'var(--text-subtle)',
          }}>{line || ' '}</div>
        )
      })}
    </div>
  )
}

function FileRow({ file, active, onToggle, onDiff, onDiscard }: {
  file: GitFile; active: boolean
  onToggle(): void; onDiff(): void; onDiscard(): void
}) {
  const parts = file.path.replace(/\\/g, '/').split('/')
  const name  = parts.pop() ?? file.path
  const dir   = parts.join('/')
  return (
    <div className="group flex items-center gap-1.5 px-3 py-1 cursor-pointer select-none"
      onClick={onDiff}
      style={{ background: active ? 'var(--bg-surface0)' : 'transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(69,71,90,.5)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <input type="checkbox" checked={file.staged}
        onChange={e => { e.stopPropagation(); onToggle() }}
        onClick={e => e.stopPropagation()}
        style={{ accentColor: 'var(--accent-green)', flexShrink: 0 }} />
      <StatusBadge s={file.status} />
      <span className="flex-1 truncate text-xs" title={file.path} style={{ color: 'var(--text)' }}>
        {name}
        {dir && <span style={{ color: 'var(--text-subtle)', marginLeft: 4, fontSize: 10 }}>{dir}</span>}
      </span>
      {!file.staged && (
        <button onClick={e => { e.stopPropagation(); onDiscard() }} title="Discard changes"
          className="opacity-0 group-hover:opacity-100 px-1 rounded"
          style={{ color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>↺</button>
      )}
    </div>
  )
}

export function GitPanel() {
  const { currentFolder, aiProviders } = useAppStore()
  const [files,      setFiles]      = useState<GitFile[]>([])
  const [branch,     setBranch]     = useState('')
  const [branches,   setBranches]   = useState<string[]>([])
  const [ahead,      setAhead]      = useState(0)
  const [behind,     setBehind]     = useState(0)
  const [commits,    setCommits]    = useState<Commit[]>([])
  const [message,    setMessage]    = useState('')
  const [diff,       setDiff]       = useState('')
  const [diffFile,   setDiffFile]   = useState('')
  const [pushing,    setPushing]    = useState(false)
  const [pulling,    setPulling]    = useState(false)
  const [committing, setCommitting] = useState(false)
  const [genMsg,     setGenMsg]     = useState(false)
  const [reviewing,  setReviewing]  = useState(false)
  const [review,     setReview]     = useState('')
  const [toast,      setToast]      = useState('')
  const [tab,        setTab]        = useState<'changes'|'log'|'review'>('changes')
  const [showBranch, setShowBranch] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const refresh = useCallback(async () => {
    if (!currentFolder) return
    const r = await window.api.git.status(currentFolder)
    if (!r.ok) return
    setFiles(r.files); setBranch(r.branch); setAhead(r.ahead); setBehind(r.behind)
  }, [currentFolder])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, 5000)
    return () => clearInterval(timerRef.current)
  }, [refresh])

  useEffect(() => {
    if (tab !== 'log' || !currentFolder) return
    window.api.git.log(currentFolder).then(r => { if (r.ok) setCommits(r.commits) })
  }, [tab, currentFolder])

  const loadBranches = () => {
    if (!currentFolder) return
    window.api.git.branches(currentFolder).then(r => { if (r.ok) setBranches(r.branches) })
  }

  const openDiff = async (file: GitFile) => {
    if (!currentFolder) return
    if (diffFile === file.path) { setDiffFile(''); setDiff(''); return }
    const r = await window.api.git.diff(currentFolder, file.path, file.staged)
    setDiff(r.diff || '(binary or no diff)'); setDiffFile(file.path)
  }

  const toggleStage = async (file: GitFile) => {
    if (!currentFolder) return
    file.staged
      ? await window.api.git.unstage(currentFolder, file.path)
      : await window.api.git.stage(currentFolder, file.path)
    await refresh()
  }
  const stageAll   = async () => { if (currentFolder) { await window.api.git.stageAll(currentFolder);   await refresh() } }
  const unstageAll = async () => { if (currentFolder) { await window.api.git.unstageAll(currentFolder); await refresh() } }

  const discard = async (file: GitFile) => {
    if (!currentFolder || !confirm(`Discard changes to "${file.path}"?`)) return
    await window.api.git.discard(currentFolder, file.path)
    if (diffFile === file.path) { setDiff(''); setDiffFile('') }
    await refresh()
  }

  const doCommit = async () => {
    if (!currentFolder || !message.trim()) return
    setCommitting(true)
    const r = await window.api.git.commit(currentFolder, message.trim())
    setCommitting(false)
    if (r.ok) { setMessage(''); showToast('✅ Committed!'); await refresh() }
    else showToast(`❌ ${r.error}`)
  }

  const doPush = async () => {
    if (!currentFolder) return; setPushing(true)
    const r = await window.api.git.push(currentFolder); setPushing(false)
    showToast(r.ok ? '✅ Pushed!' : `❌ ${r.error}`); await refresh()
  }
  const doPull = async () => {
    if (!currentFolder) return; setPulling(true)
    const r = await window.api.git.pull(currentFolder); setPulling(false)
    showToast(r.ok ? '✅ Pulled!' : `❌ ${r.error}`); await refresh()
  }

  const generateMessage = async () => {
    if (!currentFolder) return
    const provider = aiProviders.find(p => p.enabled && p.apiKey && ['claude','gemini','openai'].includes(p.id))
    if (!provider) { showToast('❌ No AI provider enabled'); return }
    const stagedFiles = files.filter(f => f.staged)
    if (!stagedFiles.length) { showToast('Stage some files first'); return }

    let combinedDiff = ''
    for (const f of stagedFiles.slice(0, 5)) {
      const r = await window.api.git.diff(currentFolder, f.path, true)
      if (r.diff) combinedDiff += `\n--- ${f.path} ---\n${r.diff.slice(0, 800)}`
    }
    const prompt = `Write a concise git commit message (max 72 chars, imperative mood) for these staged changes:\n${combinedDiff}\n\nRespond with ONLY the commit message, no quotes, no explanation.`

    setGenMsg(true)
    try {
      let text = ''
      if (provider.id === 'claude') {
        const d = await (await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: provider.model, max_tokens: 100, messages: [{ role: 'user', content: prompt }] })
        })).json()
        text = d.content?.[0]?.text?.trim() ?? ''
      } else if (provider.id === 'gemini') {
        const d = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 100 } })
        })).json()
        text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      } else {
        const d = await (await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify({ model: provider.model, max_tokens: 100, messages: [{ role: 'user', content: prompt }] })
        })).json()
        text = d.choices?.[0]?.message?.content?.trim() ?? ''
      }
      if (text) setMessage(text.replace(/^["']|["']$/g, '').slice(0, 200))
      else showToast('❌ AI returned empty')
    } catch (e: any) { showToast(`❌ ${e.message}`) }
    setGenMsg(false)
  }

  // ── AI Code Review ────────────────────────────────────────────────────────
  const doReview = async () => {
    if (!currentFolder) return
    const provider = aiProviders.find(p => p.enabled && p.apiKey && ['claude','gemini','openai'].includes(p.id))
    if (!provider) { showToast('❌ No AI provider enabled'); return }
    if (!files.length) { showToast('No changes to review'); return }

    setReviewing(true); setReview(''); setTab('review')

    let combinedDiff = ''
    for (const f of files.slice(0, 8)) {
      const r = await window.api.git.diff(currentFolder, f.path, f.staged)
      if (r.diff) combinedDiff += `\n=== ${f.staged ? '[STAGED]' : '[UNSTAGED]'} ${f.path} ===\n${r.diff.slice(0, 1500)}`
    }

    const prompt = `You are a senior software engineer doing a thorough code review. Analyze these git changes:

${combinedDiff}

Respond in this exact format:

## 🔴 Critical Issues
(bugs, security flaws, crashes — "- **issue**: explanation" or "None found.")

## 🟡 Warnings
(performance, code smells, bad practices)

## 🟢 Suggestions
(style, patterns, missing tests)

## ✅ What's Good
(positive aspects worth noting)

## 📝 Summary
(2-3 sentence overall assessment)`

    try {
      let text = ''
      if (provider.id === 'claude') {
        const d = await (await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: provider.model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
        })).json()
        text = d.content?.[0]?.text?.trim() ?? ''
      } else if (provider.id === 'gemini') {
        const d = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000 } })
        })).json()
        text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      } else {
        const d = await (await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify({ model: provider.model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
        })).json()
        text = d.choices?.[0]?.message?.content?.trim() ?? ''
      }
      setReview(text || '❌ AI returned empty')
    } catch (e: any) { setReview(`❌ ${e.message}`) }
    setReviewing(false)
  }

  if (!currentFolder) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
      <span style={{ fontSize: 32 }}>🌿</span>
      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>No folder open</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open a project to use Git</p>
    </div>
  )

  const staged   = files.filter(f => f.staged)
  const unstaged = files.filter(f => !f.staged)

  return (
    <div className="flex flex-col h-full relative" style={{ fontSize: 12 }}>

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14 }}>🌿</span>
        <span className="font-black text-xs uppercase tracking-widest flex-1" style={{ color: 'var(--accent-green)' }}>Source Control</span>
        <button onClick={refresh} title="Refresh"
          style={{ color: 'var(--text-subtle)', background: 'var(--bg-surface0)', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>⟳</button>
      </div>

      {/* Branch + Push/Pull */}
      <div className="flex-shrink-0 px-2 py-1.5 flex items-center gap-1" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface0)' }}>
        <span style={{ color: 'var(--accent-blue)', fontSize: 13, flexShrink: 0 }}>⎇</span>
        <button onClick={() => { setShowBranch(v => !v); if (!showBranch) loadBranches() }}
          className="flex-1 text-left text-xs font-semibold truncate"
          style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {branch || '—'}
        </button>
        {ahead  > 0 && <span style={{ color: 'var(--accent-green)',  fontSize: 10, flexShrink: 0 }}>↑{ahead}</span>}
        {behind > 0 && <span style={{ color: 'var(--accent-yellow)', fontSize: 10, flexShrink: 0 }}>↓{behind}</span>}
        <button onClick={doPull} disabled={pulling}
          style={{ color: 'var(--text-subtle)', background: 'var(--bg-crust)', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {pulling ? '…' : '↓ Pull'}
        </button>
        <button onClick={doPush} disabled={pushing}
          style={{ color: 'var(--text-subtle)', background: 'var(--bg-crust)', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {pushing ? '…' : '↑ Push'}
        </button>
      </div>

      {/* Branch switcher */}
      {showBranch && (
        <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: 150, borderBottom: '1px solid var(--border)', background: 'var(--bg-crust)' }}>
          {branches.length === 0
            ? <p style={{ color: 'var(--text-subtle)', fontSize: 11, padding: '8px 12px' }}>Loading…</p>
            : branches.map(b => (
              <button key={b} onClick={async () => {
                if (!currentFolder) return
                const r = await window.api.git.checkout(currentFolder, b)
                if (r.ok) { showToast(`Switched to ${b}`); setShowBranch(false); await refresh() }
                else showToast(`❌ ${r.error}`)
              }}
                className="w-full text-left px-3 py-1 text-xs"
                style={{ color: b === branch ? 'var(--accent-green)' : 'var(--text-muted)', background: b === branch ? 'var(--bg-surface0)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                {b === branch ? '✓  ' : '   '}{b}
              </button>
            ))
          }
        </div>
      )}

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-stretch" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['changes', 'log', 'review'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-1.5 text-xs font-semibold"
            style={{ color: tab === t ? 'var(--accent-green)' : 'var(--text-subtle)', borderBottom: tab === t ? '2px solid var(--accent-green)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'none', cursor: 'pointer' }}>
            {t === 'changes' ? `Changes (${files.length})` : t === 'log' ? 'Log' : '🦊 Review'}
          </button>
        ))}
        <button onClick={doReview} disabled={reviewing || !files.length}
          className="px-2 py-1.5 text-xs font-bold flex-shrink-0"
          title="AI Code Review — Kitsune reviews all your changes"
          style={{ background: reviewing ? 'var(--bg-surface0)' : 'var(--accent-mauve)', color: reviewing ? 'var(--text-subtle)' : 'white', border: 'none', cursor: 'pointer', minWidth: 60 }}>
          {reviewing ? '…' : '🦊 Review'}
        </button>
      </div>

      {tab === 'changes' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: diff ? '40%' : '60%' }}>

            {/* Staged */}
            {staged.length > 0 && (
              <>
                <div className="flex items-center px-3 py-1" style={{ background: 'var(--bg-crust)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Staged ({staged.length})</span>
                  <button onClick={unstageAll} style={{ marginLeft: 'auto', color: 'var(--text-subtle)', background: 'var(--bg-surface0)', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>Unstage all</button>
                </div>
                {staged.map(f => <FileRow key={'s'+f.path} file={f} active={diffFile===f.path} onToggle={() => toggleStage(f)} onDiff={() => openDiff(f)} onDiscard={() => discard(f)} />)}
              </>
            )}

            {/* Unstaged */}
            {unstaged.length > 0 && (
              <>
                <div className="flex items-center px-3 py-1" style={{ background: 'var(--bg-crust)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Changes ({unstaged.length})</span>
                  <button onClick={stageAll} style={{ marginLeft: 'auto', color: 'var(--text-subtle)', background: 'var(--bg-surface0)', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>Stage all</button>
                </div>
                {unstaged.map(f => <FileRow key={'u'+f.path} file={f} active={diffFile===f.path} onToggle={() => toggleStage(f)} onDiff={() => openDiff(f)} onDiscard={() => discard(f)} />)}
              </>
            )}

            {files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--text-subtle)' }}>
                <span style={{ fontSize: 28 }}>✨</span>
                <p className="text-xs">Working tree clean</p>
              </div>
            )}
          </div>

          {/* Diff */}
          {diff && (
            <div className="flex flex-col overflow-hidden flex-1" style={{ borderTop: '1px solid var(--border)', minHeight: 80 }}>
              <div className="flex items-center px-2 py-1 flex-shrink-0" style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)' }}>
                <code className="text-xs flex-1 truncate" style={{ color: 'var(--accent-blue)' }}>{diffFile}</code>
                <button onClick={() => { setDiff(''); setDiffFile('') }} style={{ color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              <DiffViewer diff={diff} />
            </div>
          )}

          {/* Commit */}
          <div className="flex-shrink-0 p-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex gap-1">
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) doCommit() }}
                placeholder="Commit message (Ctrl+Enter)…" rows={2}
                className="flex-1 px-2 py-1.5 rounded text-xs resize-none outline-none"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'inherit' }} />
              <button onClick={generateMessage} disabled={genMsg} title="Generate with Kitsune AI"
                className="self-stretch px-2 rounded flex items-center justify-center text-sm"
                style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--accent-mauve)', flexShrink: 0 }}>
                {genMsg ? '…' : '🦊'}
              </button>
            </div>
            <button onClick={doCommit} disabled={committing || !message.trim() || staged.length === 0}
              style={{
                background: (message.trim() && staged.length > 0) ? 'var(--accent-green)' : 'var(--bg-surface0)',
                color:      (message.trim() && staged.length > 0) ? 'var(--bg-base)'      : 'var(--text-subtle)',
                border: 'none', cursor: 'pointer', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 700, width: '100%'
              }}>
              {committing ? 'Committing…' : staged.length === 0 ? 'Stage files to commit' : `✓ Commit ${staged.length} file${staged.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {commits.length === 0
            ? <div className="flex items-center justify-center h-20 text-xs" style={{ color: 'var(--text-subtle)' }}>No commits yet</div>
            : commits.map(c => (
              <div key={c.hash} className="px-3 py-2" style={{ borderBottom: '1px solid rgba(69,71,90,.3)' }}>
                <div className="flex items-start gap-2">
                  <code style={{ color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>{c.hash}</code>
                  <span style={{ color: 'var(--text)', fontSize: 11 }}>{c.subject}</span>
                </div>
                <p style={{ color: 'var(--text-subtle)', fontSize: 10, marginTop: 2 }}>{c.author} · {c.date}</p>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Review tab ── */}
      {tab === 'review' && (
        <div className="flex-1 overflow-y-auto">
          {reviewing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-subtle)' }}>
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23cba6f7' stroke-width='2' fill='none' stroke-dasharray='40 20'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='1s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E"
                style={{ width: 32, height: 32 }} alt="loading" />
              <p className="text-xs animate-pulse" style={{ color: 'var(--accent-mauve)' }}>🦊 Kitsune is reviewing your code…</p>
            </div>
          ) : review ? (
            <div className="p-3">
              <ReviewMarkdown text={review} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center" style={{ color: 'var(--text-subtle)' }}>
              <span style={{ fontSize: 36 }}>🦊</span>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>AI Code Review</p>
              <p className="text-xs" style={{ maxWidth: 200, lineHeight: 1.6 }}>
                Click <strong style={{ color: 'var(--accent-mauve)' }}>🦊 Review</strong> to have Kitsune analyze all your changes for bugs, security issues, and improvements.
              </p>
              <button onClick={doReview} disabled={!files.length}
                style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                🦊 Start Review
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-3 left-2 right-2 px-3 py-2 rounded-lg text-xs font-semibold text-center"
          style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)', zIndex: 50, pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
