import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import type { AIProvider } from '../../types'

interface ModelDef {
  value: string
  label: string
  sublabel?: string
  shortcut?: number
}

const PROVIDER_MODELS: Record<string, ModelDef[]> = {
  claude: [
    { value: 'claude-opus-4-5',   label: 'Opus 4.5',   sublabel: 'most capable',  shortcut: 1 },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6', sublabel: 'recommended',   shortcut: 2 },
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', sublabel: 'balanced',      shortcut: 3 },
    { value: 'claude-haiku-4-5',  label: 'Haiku 4.5',  sublabel: 'fastest',       shortcut: 4 },
  ],
  gemini: [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash',   sublabel: 'latest preview', shortcut: 1 },
    { value: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash', sublabel: 'fast',            shortcut: 2 },
    { value: 'gemini-1.5-pro',         label: 'Gemini 1.5 Pro',   sublabel: 'most capable',    shortcut: 3 },
    { value: 'gemini-1.5-flash',       label: 'Gemini 1.5 Flash', sublabel: 'free tier',       shortcut: 4 },
  ],
  openai: [
    { value: 'gpt-4o',      label: 'GPT-4o',      sublabel: 'flagship',  shortcut: 1 },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', sublabel: 'faster',    shortcut: 2 },
    { value: 'o1-mini',     label: 'o1 Mini',     sublabel: 'reasoning', shortcut: 3 },
  ]
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  openai: 'GPT',
}

function shortModelLabel(model: string): string {
  // Map full model IDs to short display names
  const SHORTS: Record<string, string> = {
    'claude-opus-4-5':        'Opus 4.5',
    'claude-sonnet-4-6':      'Sonnet 4.6',
    'claude-sonnet-4-5':      'Sonnet 4.5',
    'claude-haiku-4-5':       'Haiku 4.5',
    'gemini-3-flash-preview': '3 Flash Preview',
    'gemini-2.0-flash':       '2.0 Flash',
    'gemini-2.0-flash-exp':   '2.0 Flash Exp',
    'gemini-1.5-pro':         '1.5 Pro',
    'gemini-1.5-flash':       '1.5 Flash',
    'gemini-1.5-flash-8b':    '1.5 Flash 8B',
    'gpt-4o':                 'GPT-4o',
    'gpt-4o-mini':            'GPT-4o Mini',
    'o1-mini':                'o1 Mini',
  }
  return SHORTS[model] ?? model.split('-').slice(-2).join(' ')
}

interface Props {
  selectedProviderId: string
  onProviderChange: (id: string) => void
}

export function ModelSelector({ selectedProviderId, onProviderChange }: Props) {
  const { aiProviders, updateAIProvider } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const enabledProviders = aiProviders.filter(p => p.enabled && p.apiKey)
  const activeProvider   = enabledProviders.find(p => p.id === selectedProviderId) ?? enabledProviders[0]

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Keyboard shortcuts 1-4 when open
  useEffect(() => {
    if (!open || !activeProvider) return
    const models = PROVIDER_MODELS[activeProvider.id] ?? []
    const handler = (e: KeyboardEvent) => {
      const n = parseInt(e.key)
      if (n >= 1 && n <= 9) {
        const m = models.find(m => m.shortcut === n)
        if (m) { updateAIProvider({ ...activeProvider, model: m.value }); setOpen(false) }
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, activeProvider])

  if (!activeProvider) return null

  const models     = PROVIDER_MODELS[activeProvider.id] ?? []
  const shortLabel = shortModelLabel(activeProvider.model)
  const provLabel  = PROVIDER_LABELS[activeProvider.id] ?? activeProvider.name

  return (
    <div ref={ref} className="relative">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all"
        style={{
          background: open ? 'var(--bg-surface1)' : 'var(--bg-surface0)',
          border: `1px solid ${open ? 'var(--accent-mauve)' : 'var(--border)'}`,
          color: 'var(--text)'
        }}
        title="Switch model">
        <KitsuneLogo size={13} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{provLabel}</span>
        <span className="text-xs" style={{ color: 'var(--text)' }}>·</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>{shortLabel}</span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>▾</span>
      </button>

      {/* Popup */}
      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{ minWidth: 240, background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>

          {/* Provider switcher */}
          {enabledProviders.length > 1 && (
            <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid var(--border)' }}>
              {enabledProviders.map(p => (
                <button key={p.id}
                  onClick={() => { onProviderChange(p.id); }}
                  className="flex-1 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: p.id === selectedProviderId ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                    color: p.id === selectedProviderId ? 'white' : 'var(--text-muted)'
                  }}>
                  {PROVIDER_LABELS[p.id] ?? p.name}
                </button>
              ))}
            </div>
          )}

          {/* Models list */}
          <div className="py-1">
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-subtle)', fontSize: 9 }}>Models</p>
            {models.map(m => {
              const active = activeProvider.model === m.value
              return (
                <button key={m.value}
                  onClick={() => { updateAIProvider({ ...activeProvider, model: m.value }); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{ background: 'transparent', color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Checkmark */}
                  <span className="w-4 flex-shrink-0 text-center" style={{ color: 'var(--accent-green)', fontSize: 12 }}>
                    {active ? '✓' : ''}
                  </span>
                  <div className="flex-1">
                    <span className="text-xs font-semibold">{m.label}</span>
                    {m.sublabel && <span className="text-xs ml-1.5" style={{ color: 'var(--text-subtle)' }}>{m.sublabel}</span>}
                  </div>
                  {/* Keyboard shortcut */}
                  {m.shortcut && (
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'var(--bg-crust)', color: 'var(--text-subtle)', fontFamily: 'monospace', fontSize: 10 }}>
                      {m.shortcut}
                    </span>
                  )}
                </button>
              )
            })}

            {/* Custom model input */}
            <div className="px-3 pb-2 pt-1" style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>CUSTOM MODEL ID</p>
              <input
                defaultValue={activeProvider.model}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v && v !== activeProvider.model) { updateAIProvider({ ...activeProvider, model: v }); setOpen(false) }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v) { updateAIProvider({ ...activeProvider, model: v }); setOpen(false) }
                  }
                }}
                placeholder="e.g. gemini-3-flash-preview"
                className="w-full px-2 py-1 rounded text-xs outline-none font-mono"
                style={{ background: 'var(--bg-crust)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 10 }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
