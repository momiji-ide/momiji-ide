import { useState } from 'react'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import { PixelKitsune } from './PixelKitsuneView'
import { useKitsuneChat, quickActions } from './useKitsuneChat'
import { renderMessage, tryRenderReview, ThinkingIndicator, MessageFooter, DiffViewer, ToolActivityRow, PendingWriteCard, ContextBar } from './chatRender'
import { ModelSelector } from '../AI/ModelSelector'
import { useAppStore } from '../../store/appStore'

interface KitsuneChatViewProps {
  chat: ReturnType<typeof useKitsuneChat>
  onToggleMemory?: () => void
  showMemory?: boolean
}

// Conversation + persona selector + input bar — shared between the merged
// Kitsune panel's middle column and the compact secondary-sidebar chat.
export function KitsuneChatView({ chat, onToggleMemory, showMemory }: KitsuneChatViewProps) {
  const { aiProviders, updateAIProvider } = useAppStore()
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [activeView, setActiveView] = useState<'chat' | 'activity'>('chat')
  const toolMsgs = chat.messages.filter(m => m.role === 'tool' && m.tool !== 'thinking')
  const moodAnim = chat.kitsuneExpr === 'thinking' ? 'work' : chat.kitsuneExpr === 'happy' ? 'celebrate' : 'idle'

  if (chat.enabledProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 p-4 text-center">
        <KitsuneLogo size={48} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Kitsune is waiting for a key</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Go to ⚙️ Settings → AI & API Keys to add your API key.</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      {chat.diffState && <DiffViewer original={chat.diffState.original} suggested={chat.diffState.suggested} onApply={chat.confirmApply} onCancel={() => chat.setDiffState(null)} />}

      {/* Project memory drawer */}
      {showMemory && (
        <div className="absolute top-0 right-0 bottom-0 z-30 flex flex-col p-3 gap-3 overflow-y-auto"
          style={{ width: 300, background: 'var(--bg-mantle)', borderLeft: '1px solid var(--border)', boxShadow: '-6px 0 16px rgba(0,0,0,0.18)' }}>
          <div className="flex items-center justify-between flex-shrink-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>📝 Project Memory</p>
            <button onClick={onToggleMemory} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>✕</button>
          </div>
          {chat.autoContext && (
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-mauve)' }}>⚡ Auto-detected</p>
              {chat.autoContext.split('\n').map((line, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>{line}</p>
              ))}
            </div>
          )}
          <div className="flex flex-col flex-1 gap-2 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Context</p>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {chat.currentFolder ? '.momiji/kitsune-memory.md' : 'Open a folder first'}
              </span>
            </div>
            <textarea
              value={chat.memoryDraft}
              onChange={e => chat.setMemoryDraft(e.target.value)}
              disabled={!chat.currentFolder}
              placeholder={`Tell Kitsune about this project...\n\nExamples:\n- Tech stack: React + FastAPI + PostgreSQL\n- Coding style: functional, no classes\n- Avoid: lodash, moment.js`}
              className="flex-1 p-2.5 rounded-lg text-xs resize-none outline-none font-mono"
              style={{
                background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)',
                opacity: chat.currentFolder ? 1 : 0.5, minHeight: 0,
              }}
            />
            <button
              onClick={chat.saveMemory}
              disabled={!chat.currentFolder || chat.memoryDraft === chat.projectMemory}
              className="py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: chat.memorySaved ? 'var(--accent-green)' : (chat.memoryDraft !== chat.projectMemory && chat.currentFolder) ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
                color: (chat.memorySaved || (chat.memoryDraft !== chat.projectMemory && chat.currentFolder)) ? 'white' : 'var(--text-subtle)',
                border: '1px solid var(--border)',
              }}
            >
              {chat.memorySaved ? '✓ Saved!' : 'Save Memory'}
            </button>
          </div>
          <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
            💡 Memory is included in every message as project context.
          </p>
        </div>
      )}

      {/* View switcher: Chat / Activity */}
      <div className="flex items-center gap-1 px-3 pt-2 flex-shrink-0">
        <button onClick={() => setActiveView('chat')}
          className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
          style={{ background: activeView === 'chat' ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: activeView === 'chat' ? 'var(--bg-base)' : 'var(--text-muted)' }}>
          💬 Chat
        </button>
        <button onClick={() => setActiveView('activity')}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-all"
          style={{ background: activeView === 'activity' ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: activeView === 'activity' ? 'var(--bg-base)' : 'var(--text-muted)' }}>
          ⚙️ Activity
          {toolMsgs.length > 0 && (
            <span className="rounded-full px-1.5" style={{ background: activeView === 'activity' ? 'var(--bg-base)22' : 'var(--bg-surface1)', color: activeView === 'activity' ? 'var(--bg-base)' : 'var(--text-subtle)', fontSize: 9 }}>
              {toolMsgs.length}
            </span>
          )}
          {chat.isLoading && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: activeView === 'activity' ? 'var(--bg-base)' : 'var(--accent-green)' }} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {activeView === 'activity' ? (
          <>
            <div className="flex items-center gap-3 rounded-lg p-2.5" style={{ background: 'var(--bg-surface0)' }}>
              <PixelKitsune anim={moodAnim} size={44} float={!chat.isLoading} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {chat.isLoading ? 'Kitsune is working…' : 'All caught up'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {toolMsgs.length} action{toolMsgs.length !== 1 ? 's' : ''} · {chat.filesWritten.length} file{chat.filesWritten.length !== 1 ? 's' : ''} changed this session
                </p>
              </div>
            </div>

            {toolMsgs.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>
                No actions yet — open a project folder and ask Kitsune to read, search, or edit files.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {toolMsgs.map(msg => (
                  <ToolActivityRow key={msg.id} tool={msg.tool ?? ''} args={msg.toolArgs ?? {}} status={msg.toolStatus ?? 'running'} result={msg.toolResult} />
                ))}
              </div>
            )}

            {chat.filesWritten.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>📝 Files changed ({chat.filesWritten.length})</p>
                {chat.filesWritten.map(path => (
                  <div key={path} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
                    <span style={{ color: 'var(--accent-green)' }}>✓</span>
                    <span className="font-mono truncate" style={{ color: 'var(--text)' }} title={path}>{path}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
        <>
        {chat.messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col items-center py-2" style={{ gap: 6 }}>
              <PixelKitsune lively size={96} />
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>Hey! I'm Kitsune 🦊</p>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)', maxWidth: 220 }}>Ask me anything about your code</p>
            </div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Quick actions on current file:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => chat.setInput(a.prompt)}
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

        {chat.messages.map(msg => {
          if (msg.role === 'tool') {
            return <ToolActivityRow key={msg.id} tool={msg.tool ?? ''} args={msg.toolArgs ?? {}} status={msg.toolStatus ?? 'running'} result={msg.toolResult} />
          }
          const isEditing = editingId === msg.id
          const isError = msg.role === 'assistant' && !msg.streaming && msg.content.startsWith('❌')
          return (
          <div key={msg.id} className="group flex flex-col gap-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            {/* Role label */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold" style={{ color: msg.role === 'user' ? 'var(--accent-mauve)' : 'var(--accent-green)', fontSize: 10, letterSpacing: '0.05em' }}>
                {msg.role === 'user' ? '▸ You' : '▸ Kitsune'}
              </span>
              {msg.role === 'assistant' && !msg.streaming && msg.elapsed && (
                <span style={{ color: 'var(--text-subtle)', fontSize: 9 }}>{(msg.elapsed / 1000).toFixed(1)}s</span>
              )}
            </div>

            {msg.image && <img src={msg.image} alt="" className="rounded" style={{ maxHeight: 100, objectFit: 'contain', border: '1px solid var(--border)' }} />}
            {((msg.attachedFileNames?.length ?? 0) > 0 || (msg.attachedFolderNames?.length ?? 0) > 0) && (
              <div className="flex gap-1 flex-wrap">
                {msg.attachedFileNames?.map(name => (
                  <span key={name} className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontSize: 9 }}>📎 {name}</span>
                ))}
                {msg.attachedFolderNames?.map(name => (
                  <span key={name} className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontSize: 9 }}>📁 {name}</span>
                ))}
              </div>
            )}

            {isEditing ? (
              <div className="flex flex-col gap-1.5 w-full">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chat.handleEditMessage(msg.id, editText); setEditingId(null) }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  rows={Math.min(10, editText.split('\n').length + 1)}
                  autoFocus
                  className="w-full px-2 py-1.5 rounded text-xs resize-none outline-none font-mono"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--accent-mauve)' }}
                />
                <div className="flex gap-1.5">
                  <button onClick={() => setEditingId(null)} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
                  <button onClick={() => { chat.handleEditMessage(msg.id, editText); setEditingId(null) }} className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)' }}>▶ Resend</button>
                </div>
              </div>
            ) : msg.role === 'assistant' && msg.streaming && !msg.content ? (
              <ThinkingIndicator elapsed={chat.streamElapsed} tokens={chat.streamTokens} />
            ) : (
              <div className="text-xs max-w-full" style={{
                color: 'var(--text)', wordBreak: 'break-word',
                ...(isError ? { background: 'var(--accent-red)12', border: '1px solid var(--accent-red)33', borderRadius: 8, padding: '8px 10px' } : {}),
              }}>
                {msg.role === 'assistant'
                  ? <>
                      {tryRenderReview(msg.content) ?? renderMessage(msg.content.replace('__FIX_BUTTON__', ''))}
                      {msg.streaming && msg.content && <span className="animate-pulse ml-0.5" style={{ color: 'var(--accent-mauve)' }}>▌</span>}
                    </>
                  : <span style={{ color: 'var(--text-muted)' }}>{msg.content}</span>
                }
              </div>
            )}

            {/* Error: always-visible retry + rewind */}
            {isError && !chat.isLoading && (
              <div className="flex gap-1.5">
                <button onClick={() => chat.handleRegenerate(msg.id)}
                  className="text-xs px-2.5 py-1 rounded font-semibold"
                  style={{ background: 'var(--accent-mauve)', color: 'white' }}>
                  ↻ Retry
                </button>
                <button onClick={() => { setEditingId(msg.id - 1 >= 0 ? msg.id - 1 : msg.id); const prev = chat.messages.find(m => m.id === msg.id - 1); if (prev) setEditText(prev.content) }}
                  className="text-xs px-2.5 py-1 rounded"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  ✏️ Edit & retry
                </button>
              </div>
            )}

            {/* Hover actions */}
            {!isEditing && !isError && !(msg.role === 'assistant' && msg.streaming) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 10 }}>
                <button onClick={() => chat.handleCopyMessage(msg.content.replace('__FIX_BUTTON__', ''), msg.id)} title="Copy"
                  className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: chat.copiedMsgId === msg.id ? 'var(--accent-green)' : 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                  {chat.copiedMsgId === msg.id ? '✓ Copied' : '📋 Copy'}
                </button>
                {msg.role === 'user' && !chat.isLoading && (
                  <button onClick={() => { setEditingId(msg.id); setEditText(msg.content) }} title="Edit & resend"
                    className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                    ✏️ Edit
                  </button>
                )}
                {msg.role === 'assistant' && !chat.isLoading && (
                  <button onClick={() => chat.handleRegenerate(msg.id)} title="Regenerate"
                    className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                    ↻ Retry
                  </button>
                )}
              </div>
            )}

            {msg.role === 'assistant' && !msg.streaming && !isError && (
              <MessageFooter tokensIn={msg.tokensIn} tokensOut={msg.tokensOut} elapsed={msg.elapsed} />
            )}

            {msg.role === 'assistant' && !msg.streaming && chat.extractCodeBlocks(msg.content).length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {chat.activeTab && (
                  <button onClick={() => chat.handleSmartApply(msg.content)}
                    className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{ background: 'var(--accent-mauve)', color: 'white' }}>
                    ⚡ Apply
                  </button>
                )}
                <button onClick={() => chat.handleCopyCode(msg.content, msg.id)}
                  className="text-xs px-2 py-0.5 rounded transition-all"
                  style={{ background: chat.copiedId === msg.id ? 'var(--accent-green)' : 'var(--bg-surface0)', color: chat.copiedId === msg.id ? 'var(--bg-base)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {chat.copiedId === msg.id ? '✓' : '📋'} Copy
                </button>
                {chat.activeTab && (
                  <button onClick={() => chat.handleInsertCode(msg.content)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    ↙ Insert
                  </button>
                )}
              </div>
            )}
          </div>
          )
        })}
        {chat.pendingWrites.map(w => (
          <PendingWriteCard key={w.path} path={w.path} content={w.content}
            onAccept={() => chat.handleWriteDecision(w.path, true)}
            onReject={() => chat.handleWriteDecision(w.path, false)} />
        ))}
        <div ref={chat.messagesEndRef} />
        </>
        )}
      </div>

      {/* Input — Cursor-style clean composer */}
      <div className="flex flex-col flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Attachments preview */}
        {(chat.attachedImage || chat.attachedFiles.length > 0 || chat.attachedFolders.length > 0 || chat.filesWritten.length > 0) && (
          <div className="flex items-center gap-1.5 px-3 pt-2 flex-wrap">
            {chat.filesWritten.length > 0 && (
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--accent-green)', fontSize: 10 }}>
                ✓ {chat.filesWritten.length} changed
              </span>
            )}
            {chat.attachedImage && (
              <span className="flex items-center gap-1 text-xs pl-1.5 pr-1 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', fontSize: 10 }}>
                📷 image
                <button onClick={() => chat.setAttachedImage(null)} style={{ color: 'var(--text-subtle)' }}>✕</button>
              </span>
            )}
            {chat.attachedFiles.map(f => (
              <span key={f.path} className="flex items-center gap-1 text-xs pl-1.5 pr-1 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', fontSize: 10 }}>
                📎 {f.name}
                <button onClick={() => chat.removeAttachedFile(f.path)} style={{ color: 'var(--text-subtle)' }}>✕</button>
              </span>
            ))}
            {chat.attachedFolders.map(f => (
              <span key={f.path} className="flex items-center gap-1 text-xs pl-1.5 pr-1 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', fontSize: 10 }}>
                📁 {f.name}
                <button onClick={() => chat.removeAttachedFolder(f.path)} style={{ color: 'var(--text-subtle)' }}>✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Text input */}
        <div className="px-3 pt-2 pb-1.5">
          <textarea
            value={chat.input}
            onChange={e => chat.setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chat.handleSend() } }}
            onPaste={chat.handlePaste}
            placeholder="Plan, search, build anything…"
            rows={2} disabled={chat.isLoading}
            className="w-full px-3 py-2 rounded-lg text-xs resize-none outline-none"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', opacity: chat.isLoading ? 0.6 : 1 }}
          />
        </div>

        {/* Bottom bar: model + actions */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <ModelSelector
            selectedProviderId={chat.selectedProviderId}
            onProviderChange={(providerId, _model) => chat.setSelectedProviderId(providerId)}
          />
          {chat.workingFolder && (
            <button onClick={() => chat.setAutoApprove(a => !a)} title="Auto-approve file writes"
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: chat.autoApprove ? 'var(--accent-green)' : 'var(--text-subtle)', fontSize: 10 }}>
              {chat.autoApprove ? '🔓' : '🔒'}
            </button>
          )}
          <button onClick={() => setShowAttachMenu(o => !o)} title="Attach files"
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--text-subtle)', fontSize: 10 }}>📎</button>
          {showAttachMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
              <div className="absolute bottom-16 left-12 rounded-lg shadow-lg overflow-hidden z-20" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', minWidth: 160 }}>
                <button onClick={() => { chat.addAttachedFiles(); setShowAttachMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  📎 Files / photos
                </button>
                <button onClick={() => { chat.addAttachedFolder(); setShowAttachMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                  style={{ color: 'var(--text)', borderTop: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  📁 Folder
                </button>
              </div>
            </>
          )}
          {onToggleMemory && (
            <button onClick={onToggleMemory} title="Project memory"
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: showMemory ? 'var(--accent-mauve)' : 'var(--text-subtle)', fontSize: 10 }}>🧠</button>
          )}
          <div className="flex-1" />
          {chat.isLoading && (
            <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
              ⏱ {(chat.streamElapsed/1000).toFixed(1)}s
            </span>
          )}
          {chat.isLoading
            ? <button onClick={chat.handleStop} className="px-2.5 py-1 rounded text-xs font-bold" style={{ background: 'var(--accent-red)', color: 'white' }}>■ Stop</button>
            : <button onClick={() => chat.handleSend()} disabled={!chat.input.trim() && !chat.attachedImage && chat.attachedFiles.length === 0 && chat.attachedFolders.length === 0}
                className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                style={{ background: (!chat.input.trim() && !chat.attachedImage && chat.attachedFiles.length === 0 && chat.attachedFolders.length === 0) ? 'var(--bg-surface0)' : 'var(--accent-mauve)', color: (!chat.input.trim() && !chat.attachedImage && chat.attachedFiles.length === 0 && chat.attachedFolders.length === 0) ? 'var(--text-muted)' : 'white' }}>↑</button>
          }
        </div>
      </div>

      {chat.activeProvider && chat.contextUsed > 0 && (
        <ContextBar used={chat.contextUsed} model={chat.activeProvider.model} />
      )}
    </div>
  )
}
