import { useState, useRef } from 'react'
import kitsuneHappy   from '../../assets/kitsune-happy.png'
import kitsuneNormal  from '../../assets/kitsune-normal.png'
import kitsuneConfuse from '../../assets/kitsune-confuse.png'
import { SessionList } from './SessionList'
import { KitsuneChatView } from './KitsuneChatView'
import { useKitsuneChat, PERSONA_LABELS } from './useKitsuneChat'
import type { KitsunePersona } from '../../types'

const SIDEBAR_KEY = 'kitsune-sidebar-width'
const MIN_SIDEBAR = 150
const MAX_SIDEBAR = 360

// Claude-Desktop-style 2-column layout: session history | clean conversation.
export function KitsunePanel() {
  const chat = useKitsuneChat()
  const [showMemory, setShowMemory] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_KEY))
    return saved >= MIN_SIDEBAR && saved <= MAX_SIDEBAR ? saved : 190
  })
  const widthRef = useRef(sidebarWidth)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + (ev.clientX - startX)))
      widthRef.current = w
      setSidebarWidth(w)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem(SIDEBAR_KEY, String(widthRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} } @keyframes kitsuneIdleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} } .kitsune-resize-handle:hover { background: var(--accent-mauve) !important; }`}</style>

      {/* Left: session history */}
      <div className="flex-shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
        <SessionList />
      </div>

      {/* Drag handle to resize the session sidebar */}
      <div
        onMouseDown={startResize}
        className="kitsune-resize-handle flex-shrink-0"
        style={{ width: 4, cursor: 'col-resize', background: 'var(--border)' }}
      />

      {/* Right: conversation + input */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ height: 38, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
          <img
            src={chat.kitsuneExpr === 'thinking' ? kitsuneConfuse : chat.kitsuneExpr === 'happy' ? kitsuneHappy : kitsuneNormal}
            style={{ width: 22, height: 22, objectFit: 'contain', transition: 'all 0.3s ease', flexShrink: 0 }}
            alt="Kitsune"
          />
          <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>KITSUNE AI</span>
          {chat.isLoading && <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44', fontSize: 9 }}>● live</span>}
          <div className="flex-1" />
          {/* Persona — tone Kitsune talks in (beginner/dev/creative) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
            {(Object.keys(PERSONA_LABELS) as KitsunePersona[]).map(p => (
              <button key={p} title={PERSONA_LABELS[p].label} onClick={() => chat.setPersona(p)}
                className="w-6 h-6 flex items-center justify-center rounded text-xs transition-all"
                style={{ background: chat.persona === p ? 'var(--accent-mauve)' : 'transparent', filter: chat.persona === p ? 'none' : 'grayscale(60%)', opacity: chat.persona === p ? 1 : 0.6 }}>
                {PERSONA_LABELS[p].icon}
              </button>
            ))}
          </div>
          {chat.messages.length > 0 && !chat.isLoading && (
            <button onClick={chat.clearChat} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Clear</button>
          )}
        </div>

        <KitsuneChatView
          chat={chat}
          showMemory={showMemory}
          onToggleMemory={() => setShowMemory(s => !s)}
        />
      </div>
    </div>
  )
}
