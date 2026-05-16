import { useState, useEffect } from 'react'
import { toast, type ToastItem } from '../../utils/toast'

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
}

const COLORS: Record<string, string> = {
  success: 'var(--accent-green)',
  error: 'var(--accent-red)',
  warning: 'var(--accent-yellow)',
  info: 'var(--accent-blue)'
}

export function ToastSystem() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return toast.subscribe(setToasts)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-8 right-4 flex flex-col gap-2 z-50"
      style={{ pointerEvents: 'none' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium"
          style={{
            background: 'var(--bg-surface0)',
            border: `1px solid ${COLORS[t.type]}`,
            color: 'var(--text)',
            pointerEvents: 'auto',
            animation: 'slideInRight 0.2s ease-out',
            minWidth: '240px',
            maxWidth: '360px'
          }}
        >
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0"
            style={{ background: COLORS[t.type], color: 'var(--bg-base)' }}
          >
            {ICONS[t.type]}
          </span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
