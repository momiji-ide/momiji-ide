import { useAppStore } from '../../store/appStore'
import { getT, getLang } from '../../utils/i18n'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  return `${Math.floor(hr / 24)}d`
}

// Left column — Claude-Desktop-style session/conversation history.
export function SessionList() {
  const t = getT(getLang())
  const { kitsuneSessions, activeKitsuneSessionId, createKitsuneSession, deleteKitsuneSession, setActiveKitsuneSession } = useAppStore()
  const sorted = [...kitsuneSessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-mantle)' }}>
      <div className="p-2 flex-shrink-0">
        <button
          onClick={() => createKitsuneSession()}
          className="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: 'var(--accent-mauve)', color: 'var(--bg-base)' }}>
          {t.kitsune_new_session}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 flex flex-col gap-0.5">
        {sorted.length === 0 && (
          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-subtle)' }}>{t.kitsune_no_sessions}</p>
        )}
        {sorted.map(s => (
          <div
            key={s.id}
            onClick={() => setActiveKitsuneSession(s.id)}
            className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs"
            style={{
              background: s.id === activeKitsuneSessionId ? 'var(--bg-surface1)' : 'transparent',
              color: s.id === activeKitsuneSessionId ? 'var(--text)' : 'var(--text-muted)',
            }}>
            <span className="truncate flex-1">{s.title || 'New chat'}</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 10, flexShrink: 0 }}>{timeAgo(s.updatedAt)}</span>
            {kitsuneSessions.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deleteKitsuneSession(s.id) }}
                title={t.kitsune_delete_session}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
