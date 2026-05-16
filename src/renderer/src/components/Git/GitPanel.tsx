import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AIProvider } from '../../types'

async function callAIForCommit(providers: AIProvider[], diff: string): Promise<string> {
  const provider = providers.find(p => p.enabled && p.apiKey)
  if (!provider) return ''

  const prompt = `Write a concise git commit message for this diff. Format: short subject line (max 72 chars), then optionally a blank line and bullet points for details. Only output the commit message, nothing else.\n\n${diff.slice(0, 6000)}`

  if (provider.id === 'claude') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: provider.model, max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await resp.json()
    return data.content?.[0]?.text ?? ''
  } else if (provider.id === 'gemini') {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    })
    const data = await resp.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } else {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await resp.json()
    return data.choices?.[0]?.message?.content ?? ''
  }
}

interface GitStatus {
  branch: string
  staged: string[]
  unstaged: string[]
  untracked: string[]
  ahead: number
  behind: number
}

interface GitLog {
  hash: string
  message: string
  author: string
  date: string
}

type GitTab = 'changes' | 'log' | 'diff'

export function GitPanel() {
  const { currentFolder, aiProviders } = useAppStore()
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [log, setLog] = useState<GitLog[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [activeTab, setActiveTab] = useState<GitTab>('changes')
  const [loading, setLoading] = useState(false)
  const [generatingMsg, setGeneratingMsg] = useState(false)
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [output, setOutput] = useState('')
  const [diffContent, setDiffContent] = useState('')
  const [diffFile, setDiffFile] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [showBranchMenu, setShowBranchMenu] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)

  const runGit = useCallback(async (args: string[]): Promise<string> => {
    if (!currentFolder) return ''
    const id = `git-${Date.now()}`
    let result = ''

    return new Promise((resolve) => {
      const offOut = window.api.process.onStdout((pid, data) => {
        if (pid === id) result += data
      })
      const offErr = window.api.process.onStderr((pid, data) => {
        if (pid === id) result += data
      })
      const offExit = window.api.process.onExit((pid) => {
        if (pid === id) {
          offOut(); offErr(); offExit()
          resolve(result)
        }
      })
      window.api.process.run(id, 'git', args, currentFolder)
    })
  }, [currentFolder])

  const loadBranches = useCallback(async () => {
    const out = await runGit(['branch', '--list'])
    const list = out.split('\n').filter(Boolean).map(b => b.replace(/^\*?\s*/, '').trim()).filter(Boolean)
    setBranches(list)
  }, [runGit])

  const loadStatus = useCallback(async () => {
    if (!currentFolder) return
    setLoading(true)

    const statusOut = await runGit(['status', '--porcelain', '-b'])
    if (!statusOut) { setIsGitRepo(false); setLoading(false); return }

    setIsGitRepo(true)
    const lines = statusOut.split('\n').filter(Boolean)
    const branchLine = lines.find((l) => l.startsWith('##')) ?? '## main'
    const branch = branchLine.replace('## ', '').split('...')[0] || 'main'

    let ahead = 0, behind = 0
    const trackMatch = branchLine.match(/\[ahead (\d+)/)
    const behindMatch = branchLine.match(/behind (\d+)/)
    if (trackMatch) ahead = +trackMatch[1]
    if (behindMatch) behind = +behindMatch[1]

    const staged: string[] = []
    const unstaged: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      if (line.startsWith('##')) continue
      const xy = line.slice(0, 2)
      const file = line.slice(3)
      if (xy[0] !== ' ' && xy[0] !== '?') staged.push(file)
      if (xy[1] === 'M' || xy[1] === 'D') unstaged.push(file)
      if (xy === '??') untracked.push(file)
    }

    setStatus({ branch, staged, unstaged, untracked, ahead, behind })
    setLoading(false)
  }, [currentFolder, runGit])

  const loadLog = useCallback(async () => {
    const out = await runGit(['log', '--oneline', '--format=%h|%s|%an|%ar', '-20'])
    const entries: GitLog[] = out.split('\n').filter(Boolean).map((line) => {
      const [hash, message, author, date] = line.split('|')
      return { hash: hash?.trim(), message: message?.trim(), author: author?.trim(), date: date?.trim() }
    })
    setLog(entries)
  }, [runGit])

  useEffect(() => {
    loadStatus()
    loadLog()
    loadBranches()
  }, [currentFolder, loadStatus, loadLog, loadBranches])

  const handleStage = async (file: string) => {
    await runGit(['add', file])
    loadStatus()
  }

  const handleUnstage = async (file: string) => {
    await runGit(['reset', 'HEAD', file])
    loadStatus()
  }

  const handleStageAll = async () => {
    await runGit(['add', '-A'])
    loadStatus()
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setOutput('')
    const out = await runGit(['commit', '-m', commitMsg])
    setOutput(out)
    setCommitMsg('')
    loadStatus()
    loadLog()
  }

  const handlePull = async () => {
    setOutput('Pulling...')
    const out = await runGit(['pull'])
    setOutput(out)
    loadStatus()
  }

  const handleSwitchBranch = async (branch: string) => {
    setShowBranchMenu(false)
    setOutput(`Switching to ${branch}...`)
    const out = await runGit(['checkout', branch])
    setOutput(out)
    loadStatus()
    loadLog()
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    setOutput(`Creating branch ${newBranchName}...`)
    const out = await runGit(['checkout', '-b', newBranchName.trim()])
    setOutput(out)
    setNewBranchName('')
    setShowNewBranch(false)
    loadStatus()
    loadBranches()
  }

  const handleShowDiff = async (file: string) => {
    const out = await runGit(['diff', 'HEAD', '--', file])
    setDiffContent(out || await runGit(['diff', '--cached', '--', file]))
    setDiffFile(file)
    setActiveTab('diff')
  }

  const handlePush = async () => {
    setOutput('Pushing...')
    const out = await runGit(['push'])
    setOutput(out)
    loadStatus()
  }

  const handleAICommitMsg = async () => {
    setGeneratingMsg(true)
    try {
      const diff = await runGit(['diff', '--staged']) || await runGit(['diff', 'HEAD', '--stat'])
      if (!diff.trim()) { setGeneratingMsg(false); return }
      const msg = await callAIForCommit(aiProviders, diff)
      if (msg.trim()) setCommitMsg(msg.trim())
    } catch {}
    setGeneratingMsg(false)
  }

  if (!currentFolder) {
    return (
      <EmptyState icon="📁" title="No folder open" desc="Open a folder to use Git integration" />
    )
  }

  if (!isGitRepo && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
        <span className="text-4xl">🔧</span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Not a Git repository</p>
        <button
          onClick={async () => { await runGit(['init']); loadStatus() }}
          className="px-4 py-2 rounded text-xs font-medium transition-all"
          style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}
        >
          Initialize Git Repository
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-3 py-2 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          🔀 Git
        </span>
        <div className="flex items-center gap-1 relative">
          {status && (
            <div className="relative">
              <button
                onClick={() => setShowBranchMenu(v => !v)}
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors"
                style={{ background: 'var(--bg-surface0)', color: 'var(--accent-blue)', border: '1px solid var(--border)' }}
                title="Switch branch">
                ⎇ {status.branch} ▾
              </button>
              {showBranchMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBranchMenu(false)} />
                  <div className="absolute right-0 z-50 mt-1 py-1 rounded-lg shadow-2xl"
                    style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', minWidth: 160, top: '100%' }}>
                    <p className="px-2 py-0.5 text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Switch branch</p>
                    {branches.map(b => (
                      <button key={b} onClick={() => handleSwitchBranch(b)}
                        className="w-full text-left px-3 py-1 text-xs transition-colors"
                        style={{ color: b === status.branch ? 'var(--accent-green)' : 'var(--text)', background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {b === status.branch ? '✓ ' : '  '}{b}
                      </button>
                    ))}
                    <div className="my-1 mx-2" style={{ height: 1, background: 'var(--border)' }} />
                    {showNewBranch ? (
                      <div className="px-2 py-1 flex gap-1">
                        <input autoFocus value={newBranchName} onChange={e => setNewBranchName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                          placeholder="branch-name"
                          className="flex-1 px-1.5 py-0.5 rounded text-xs outline-none"
                          style={{ background: 'var(--bg-crust)', color: 'var(--text)', border: '1px solid var(--border)', minWidth: 0 }} />
                        <button onClick={handleCreateBranch}
                          className="text-xs px-1.5 rounded" style={{ background: 'var(--accent-blue)', color: 'white' }}>✓</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewBranch(true)}
                        className="w-full text-left px-3 py-1 text-xs transition-colors"
                        style={{ color: 'var(--accent-green)', background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        + New branch
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={() => { loadStatus(); loadLog(); loadBranches() }}
            className="text-xs px-1 py-0.5 rounded" title="Refresh"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
            ↻
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['changes', 'log', 'diff'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="flex-1 py-1.5 text-xs transition-colors capitalize"
            style={{
              color: activeTab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === t ? '2px solid var(--accent-blue)' : '2px solid transparent'
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'changes' && status && (
          <div className="p-2 flex flex-col gap-3">
            {/* Sync buttons */}
            <div className="flex gap-1">
              <button onClick={handlePull}
                className="flex-1 py-1 rounded text-xs font-medium transition-all"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
                ↓ Pull {status.behind > 0 ? `(${status.behind})` : ''}
              </button>
              <button onClick={handlePush}
                className="flex-1 py-1 rounded text-xs font-medium transition-all"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
                ↑ Push {status.ahead > 0 ? `(${status.ahead})` : ''}
              </button>
            </div>

            {/* Staged files */}
            {status.staged.length > 0 && (
              <FileSection title={`Staged (${status.staged.length})`} color="var(--accent-green)">
                {status.staged.map((f) => (
                  <FileRow key={f} file={f} color="var(--accent-green)" badge="A"
                    onDiff={() => handleShowDiff(f)}
                    action={{ label: 'Unstage', onClick: () => handleUnstage(f) }} />
                ))}
              </FileSection>
            )}

            {/* Unstaged */}
            {(status.unstaged.length > 0 || status.untracked.length > 0) && (
              <FileSection
                title={`Changes (${status.unstaged.length + status.untracked.length})`}
                color="var(--accent-yellow)"
                headerAction={{ label: 'Stage All', onClick: handleStageAll }}
              >
                {status.unstaged.map((f) => (
                  <FileRow key={f} file={f} color="var(--accent-yellow)" badge="M"
                    onDiff={() => handleShowDiff(f)}
                    action={{ label: 'Stage', onClick: () => handleStage(f) }} />
                ))}
                {status.untracked.map((f) => (
                  <FileRow key={f} file={f} color="var(--text-subtle)" badge="U"
                    action={{ label: 'Stage', onClick: () => handleStage(f) }} />
                ))}
              </FileSection>
            )}

            {/* Commit */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Commit message</span>
                <button onClick={handleAICommitMsg} disabled={generatingMsg}
                  className="text-xs px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                  style={{ background: 'var(--accent-mauve)22', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
                  {generatingMsg ? '⟳ Generating…' : '✨ AI Write'}
                </button>
              </div>
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message..."
                rows={2}
                className="w-full px-2 py-1.5 rounded text-xs resize-none outline-none"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <button
                onClick={handleCommit}
                disabled={!commitMsg.trim() || status.staged.length === 0}
                className="w-full py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: commitMsg.trim() && status.staged.length > 0 ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                  color: commitMsg.trim() && status.staged.length > 0 ? 'var(--bg-base)' : 'var(--text-muted)'
                }}
              >
                ✓ Commit {status.staged.length > 0 ? `(${status.staged.length} files)` : ''}
              </button>
            </div>

            {output && (
              <pre className="text-xs p-2 rounded whitespace-pre-wrap"
                style={{ background: 'var(--bg-crust)', color: 'var(--accent-green)', fontFamily: 'monospace' }}>
                {output}
              </pre>
            )}

            {status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-subtle)' }}>
                ✓ Working tree clean
              </p>
            )}
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="flex flex-col h-full">
            <div className="px-2 py-1 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium truncate" style={{ color: 'var(--accent-yellow)' }}>
                {diffFile || 'No file selected'}
              </span>
              {!diffFile && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Click a changed file</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {diffContent ? (
                <div className="font-mono text-xs" style={{ fontFamily: 'monospace' }}>
                  {diffContent.split('\n').map((line, i) => {
                    let bg = 'transparent', color = 'var(--text-muted)'
                    if (line.startsWith('+') && !line.startsWith('+++')) { bg = '#a6e3a115'; color = 'var(--accent-green)' }
                    else if (line.startsWith('-') && !line.startsWith('---')) { bg = '#f38ba815'; color = 'var(--accent-red)' }
                    else if (line.startsWith('@@')) { bg = '#89b4fa10'; color = 'var(--accent-blue)' }
                    else if (line.startsWith('diff') || line.startsWith('index')) { color = 'var(--text-subtle)' }
                    return (
                      <div key={i} className="px-2 py-px" style={{ background: bg, color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {line || ' '}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-subtle)' }}>
                  No diff — click a modified file in Changes tab
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="p-2">
            {log.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-subtle)' }}>No commits yet</p>
            ) : (
              log.map((entry) => (
                <div key={entry.hash}
                  className="flex flex-col gap-0.5 py-2 border-b"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <code className="text-xs px-1 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-blue)' }}>
                      {entry.hash}
                    </code>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{entry.date}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text)' }}>{entry.message}</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>by {entry.author}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FileSection({ title, color, children, headerAction }: {
  title: string; color: string; children: React.ReactNode
  headerAction?: { label: string; onClick: () => void }
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold" style={{ color }}>{title}</p>
        {headerAction && (
          <button onClick={headerAction.onClick}
            className="text-xs px-1.5 py-0.5 rounded transition-colors"
            style={{ color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)' }}>
            {headerAction.label}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function FileRow({ file, color, badge, action, onDiff }: {
  file: string; color: string; badge: string
  action: { label: string; onClick: () => void }
  onDiff?: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1 group rounded px-1"
      style={{}}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span className="text-xs font-bold w-4 flex-shrink-0" style={{ color }}>{badge}</span>
      <span className="text-xs flex-1 truncate cursor-pointer" style={{ color: 'var(--text)' }}
        onClick={onDiff} title={onDiff ? 'Click to view diff' : undefined}>{file}</span>
      {onDiff && (
        <button onClick={onDiff}
          className="text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--accent-blue)' }} title="View diff">
          ⟨/⟩
        </button>
      )}
      <button
        onClick={action.onClick}
        className="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)' }}>
        {action.label}
      </button>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  )
}
