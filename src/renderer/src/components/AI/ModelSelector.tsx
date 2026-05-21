import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'

// ── Tier definitions ─────────────────────────────────────────────────────────

type Tier = 'free' | 'pro' | 'studio' | 'byok' | 'local'

interface ModelEntry {
  id:         string     // unique key
  label:      string     // display name
  sublabel?:  string     // e.g. "fastest · cheap"
  providerId: string     // which provider handles this
  model:      string     // actual model ID
  tier:       Tier
  badge?:     string     // "FREE", "Pro", "New", etc.
  emoji?:     string     // provider emoji
}

// ── All models catalogue ─────────────────────────────────────────────────────

const ALL_MODELS: ModelEntry[] = [
  // ── FREE tier ─────────────────────────────────────────────────────────────
  { id: 'groq-llama-70b',    label: 'Llama 3.3 70B',      sublabel: 'fast · versatile',     providerId: 'groq',       model: 'llama-3.3-70b-versatile',                    tier: 'free',   badge: 'FREE',  emoji: '⚡' },
  { id: 'groq-llama-8b',     label: 'Llama 3.1 8B',       sublabel: 'fastest · light',       providerId: 'groq',       model: 'llama-3.1-8b-instant',                       tier: 'free',   badge: 'FREE',  emoji: '⚡' },
  { id: 'groq-deepseek-r1',  label: 'DeepSeek R1',        sublabel: 'reasoning',             providerId: 'groq',       model: 'deepseek-r1-distill-llama-70b',               tier: 'free',   badge: 'FREE',  emoji: '⚡' },
  { id: 'groq-qwen',         label: 'Qwen QwQ 32B',       sublabel: 'reasoning',             providerId: 'groq',       model: 'qwen-qwq-32b',                               tier: 'free',   badge: 'FREE',  emoji: '⚡' },
  { id: 'gemini-flash-lite', label: 'Gemini 3.1 Flash Lite', sublabel: '500 RPD',            providerId: 'gemini',     model: 'gemini-3.1-flash-lite',                      tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'gemini-3-flash',    label: 'Gemini 3 Flash',     sublabel: '20 RPD',                providerId: 'gemini',     model: 'gemini-3-flash',                             tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'or-llama-free',     label: 'Llama 3.3 70B',      sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free',     tier: 'free',   badge: 'FREE',  emoji: '🌐' },
  { id: 'or-deepseek-free',  label: 'DeepSeek R1',        sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'deepseek/deepseek-r1:free',                  tier: 'free',   badge: 'FREE',  emoji: '🌐' },
  { id: 'or-gemma-free',     label: 'Gemma 3 27B',        sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'google/gemma-3-27b-it:free',                 tier: 'free',   badge: 'FREE',  emoji: '🌐' },

  // ── PRO tier ──────────────────────────────────────────────────────────────
  { id: 'gemini-25-flash',   label: 'Gemini 2.5 Flash',   sublabel: 'best balance · 1M ctx', providerId: 'gemini',     model: 'gemini-2.5-flash',                           tier: 'pro',    badge: 'Pro',   emoji: '🟠' },
  { id: 'gemini-25-lite',    label: 'Gemini 2.5 Flash-Lite', sublabel: 'ultra cheap',        providerId: 'gemini',     model: 'gemini-2.5-flash-lite',                      tier: 'pro',    badge: 'Pro',   emoji: '🟠' },
  { id: 'claude-haiku',      label: 'Claude Haiku 4.5',   sublabel: 'fastest Anthropic',     providerId: 'claude',     model: 'claude-haiku-4-5',                           tier: 'pro',    badge: 'Pro',   emoji: '🟣' },
  { id: 'gpt-4o-mini',       label: 'GPT-4o Mini',        sublabel: 'recommended OpenAI',    providerId: 'openai',     model: 'gpt-4o-mini',                                tier: 'pro',    badge: 'Pro',   emoji: '🟢' },
  { id: 'deepseek-chat',     label: 'DeepSeek Chat V3',   sublabel: 'very cheap BYOK',       providerId: 'deepseek',   model: 'deepseek-chat',                              tier: 'pro',    badge: 'Pro',   emoji: '🔵' },
  { id: 'mistral-small',     label: 'Mistral Small',      sublabel: 'fast & cheap',          providerId: 'mistral',    model: 'mistral-small-latest',                       tier: 'pro',    badge: 'Pro',   emoji: '⚪' },

  // ── STUDIO tier ───────────────────────────────────────────────────────────
  { id: 'claude-sonnet',     label: 'Claude Sonnet 4.5',  sublabel: 'recommended · best',    providerId: 'claude',     model: 'claude-sonnet-4-5',                          tier: 'studio', badge: 'Studio', emoji: '🟣' },
  { id: 'claude-opus',       label: 'Claude Opus 4.5',    sublabel: 'most capable',          providerId: 'claude',     model: 'claude-opus-4-5',                            tier: 'studio', badge: 'Studio', emoji: '🟣' },
  { id: 'gemini-35-flash',   label: 'Gemini 3.5 Flash',   sublabel: 'newest · fastest',      providerId: 'gemini',     model: 'gemini-3.5-flash',                           tier: 'studio', badge: 'Studio', emoji: '🟠' },
  { id: 'gemini-25-pro',     label: 'Gemini 2.5 Pro',     sublabel: 'best reasoning',        providerId: 'gemini',     model: 'gemini-2.5-pro',                             tier: 'studio', badge: 'Studio', emoji: '🟠' },
  { id: 'gpt-4o',            label: 'GPT-4o',             sublabel: 'flagship OpenAI',       providerId: 'openai',     model: 'gpt-4o',                                     tier: 'studio', badge: 'Studio', emoji: '🟢' },
  { id: 'mistral-large',     label: 'Mistral Large',      sublabel: 'most capable',          providerId: 'mistral',    model: 'mistral-large-latest',                       tier: 'studio', badge: 'Studio', emoji: '⚪' },
  { id: 'deepseek-r1',       label: 'DeepSeek R1',        sublabel: 'reasoning specialist',  providerId: 'deepseek',   model: 'deepseek-reasoner',                          tier: 'studio', badge: 'Studio', emoji: '🔵' },
]

const OLLAMA_DEFAULTS: ModelEntry[] = [
  { id: 'ollama-qwen',    label: 'Qwen2.5 Coder 7B',  sublabel: 'best for code ⭐', providerId: 'ollama', model: 'qwen2.5-coder:7b',  tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-qwen32',  label: 'Qwen2.5 Coder 32B', sublabel: 'GPT-4 level',      providerId: 'ollama', model: 'qwen2.5-coder:32b', tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-llama',   label: 'Llama 3.3 70B',      sublabel: 'most capable',     providerId: 'ollama', model: 'llama3.3:70b',      tier: 'local', badge: 'Local', emoji: '🏠' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(entry: ModelEntry): string {
  return entry.label.replace('Claude ', '').replace('Gemini ', '').replace('GPT-', '').slice(0, 22)
}

// Check user tier from license key (placeholder — will connect to Supabase later)
function getUserTier(): 'free' | 'pro' | 'studio' {
  const key = localStorage.getItem('momiji:license-tier')
  if (key === 'studio') return 'studio'
  if (key === 'pro') return 'pro'
  return 'free'
}

const TIER_ORDER: Tier[] = ['free', 'pro', 'studio', 'local']

const TIER_LABELS: Record<Tier, string> = {
  free:   '🆓 Free',
  pro:    '🦊 Pro · $12/mo',
  studio: '🏆 Studio · $29/seat',
  byok:   '🔑 BYOK',
  local:  '🏠 Local (Ollama)',
}

const TIER_COLORS: Record<Tier, string> = {
  free:   'var(--accent-green)',
  pro:    'var(--accent-mauve)',
  studio: 'var(--accent-yellow)',
  byok:   'var(--text-subtle)',
  local:  '#89dceb',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  selectedProviderId: string
  onProviderChange: (providerId: string, model: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function ModelSelector({ selectedProviderId, onProviderChange }: Props) {
  const { aiProviders, updateAIProvider } = useAppStore()
  const [open, setOpen]               = useState(false)
  const [search, setSearch]           = useState('')
  const [localModels, setLocalModels] = useState<string[]>([])
  const [customModel, setCustomModel] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const userTier = getUserTier()

  // Active provider + model
  const enabledProviders = aiProviders.filter(p => p.enabled && (p.apiKey || p.id === 'ollama' || p.id === 'custom'))
  const activeProvider   = enabledProviders.find(p => p.id === selectedProviderId) ?? enabledProviders[0]

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Fetch Ollama models when opened
  useEffect(() => {
    if (!open) return
    const ollama = aiProviders.find(p => p.id === 'ollama' && p.enabled)
    if (!ollama) return
    const base = ollama.baseUrl ?? 'http://localhost:11434'
    fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.json())
      .then(d => setLocalModels((d.models ?? []).map((m: any) => m.name)))
      .catch(() => {})
  }, [open])

  if (!activeProvider) return null

  // Current active model entry
  const activeEntry = ALL_MODELS.find(m => m.providerId === activeProvider.id && m.model === activeProvider.model)
  const displayLabel = activeEntry ? `${activeEntry.emoji} ${shortLabel(activeEntry)}` : `${activeProvider.name} · ${activeProvider.model.slice(0, 18)}`

  // Build visible model list
  const enabledProviderIds = new Set(enabledProviders.map(p => p.id))
  const ollamaEnabled = enabledProviderIds.has('ollama')
  const ollamaModels: ModelEntry[] = ollamaEnabled
    ? (localModels.length > 0 ? localModels : OLLAMA_DEFAULTS.map(m => m.model))
        .map((m, i) => ({
          id: `ollama-${i}`, label: m, providerId: 'ollama', model: m,
          tier: 'local' as Tier, badge: 'Local', emoji: '🏠'
        }))
    : []

  const allEntries = [...ALL_MODELS, ...ollamaModels]

  // Filter by search
  const filtered = search
    ? allEntries.filter(m => m.label.toLowerCase().includes(search.toLowerCase()) || m.model.toLowerCase().includes(search.toLowerCase()))
    : allEntries

  // Group by tier
  const grouped = TIER_ORDER.reduce((acc, tier) => {
    const items = filtered.filter(m => m.tier === tier)
    if (items.length) acc[tier] = items
    return acc
  }, {} as Record<Tier, ModelEntry[]>)

  const canAccess = (tier: Tier) => {
    if (tier === 'free' || tier === 'local' || tier === 'byok') return true
    if (tier === 'pro')    return userTier === 'pro' || userTier === 'studio'
    if (tier === 'studio') return userTier === 'studio'
    return true
  }

  const isProviderEnabled = (providerId: string) => enabledProviderIds.has(providerId)

  const selectModel = (entry: ModelEntry) => {
    if (!isProviderEnabled(entry.providerId)) return
    const prov = aiProviders.find(p => p.id === entry.providerId)
    if (!prov) return
    updateAIProvider({ ...prov, model: entry.model })
    onProviderChange(entry.providerId, entry.model)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">

      {/* ── Trigger pill ── */}
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: open ? 'var(--bg-surface1)' : 'var(--bg-surface0)',
          border: `1px solid ${open ? 'var(--accent-mauve)' : 'var(--border)'}`,
          color: 'var(--text)'
        }}>
        <KitsuneLogo size={13} />
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>
          {displayLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>▾</span>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 300, maxHeight: 480, background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>

          {/* Search */}
          <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Model groups */}
          <div className="overflow-y-auto flex-1">

            {/* Auto mode */}
            {!search && (
              <div>
                <button
                  onClick={() => { setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span className="w-4 text-center text-xs" style={{ color: 'var(--accent-green)' }}>✓</span>
                  <div className="flex-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Auto</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-subtle)' }}>best available model</span>
                  </div>
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '0 8px' }} />
              </div>
            )}

            {/* Grouped model rows */}
            {TIER_ORDER.map(tier => {
              const items = grouped[tier]
              if (!items?.length) return null
              const unlocked = canAccess(tier)
              return (
                <div key={tier}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TIER_COLORS[tier], fontSize: 9 }}>
                      {TIER_LABELS[tier]}
                    </span>
                    {!unlocked && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', fontSize: 8, fontWeight: 700 }}>
                        UPGRADE
                      </span>
                    )}
                  </div>

                  {/* Model rows */}
                  {items.map(entry => {
                    const isActive   = activeProvider.id === entry.providerId && activeProvider.model === entry.model
                    const hasKey     = isProviderEnabled(entry.providerId)
                    const accessible = unlocked && hasKey

                    return (
                      <button key={entry.id}
                        onClick={() => accessible ? selectModel(entry) : undefined}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                        style={{
                          background: 'transparent',
                          cursor: accessible ? 'pointer' : 'default',
                          opacity: accessible ? 1 : 0.45,
                        }}
                        onMouseEnter={e => { if (accessible) e.currentTarget.style.background = 'var(--bg-surface1)' }}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                        {/* Check / lock icon */}
                        <span className="w-4 flex-shrink-0 text-center text-xs">
                          {isActive ? <span style={{ color: 'var(--accent-green)' }}>✓</span>
                            : !unlocked ? <span style={{ color: 'var(--accent-yellow)' }}>🔒</span>
                            : !hasKey   ? <span style={{ color: 'var(--text-subtle)', fontSize: 8 }}>key?</span>
                            : null}
                        </span>

                        {/* Provider emoji + name */}
                        <span style={{ fontSize: 13, flexShrink: 0 }}>{entry.emoji}</span>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold" style={{ color: isActive ? 'var(--accent-mauve)' : 'var(--text)' }}>
                            {entry.label}
                          </span>
                          {entry.sublabel && (
                            <span className="text-xs ml-1.5 truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                              {entry.sublabel}
                            </span>
                          )}
                        </div>

                        {/* Badge */}
                        {entry.badge && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-bold"
                            style={{
                              fontSize: 8,
                              background: !unlocked ? 'var(--accent-yellow)22'
                                : entry.tier === 'free' || entry.tier === 'local' ? 'var(--accent-green)22'
                                : entry.tier === 'pro' ? 'var(--accent-mauve)22'
                                : 'var(--accent-yellow)22',
                              color: !unlocked ? 'var(--accent-yellow)'
                                : entry.tier === 'free' || entry.tier === 'local' ? 'var(--accent-green)'
                                : entry.tier === 'pro' ? 'var(--accent-mauve)'
                                : 'var(--accent-yellow)',
                            }}>
                            {!unlocked ? 'Upgrade' : !hasKey ? 'Add key' : entry.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {/* No results */}
            {Object.keys(grouped).length === 0 && (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-subtle)' }}>
                <p className="text-xs">No models match "{search}"</p>
              </div>
            )}

            {/* BYOK / Custom model */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <div className="px-3 pt-2.5 pb-1">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TIER_COLORS['byok'], fontSize: 9 }}>
                  🔑 Custom Model ID
                </span>
              </div>
              <div className="px-3 pb-3 flex gap-1">
                <input
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customModel.trim() && activeProvider) {
                      updateAIProvider({ ...activeProvider, model: customModel.trim() })
                      setOpen(false)
                    }
                  }}
                  placeholder={`e.g. gemini-3.5-flash, gpt-5...`}
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none font-mono"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 10 }}
                  onClick={e => e.stopPropagation()}
                />
                <button
                  onClick={() => {
                    if (customModel.trim() && activeProvider) {
                      updateAIProvider({ ...activeProvider, model: customModel.trim() })
                      setOpen(false)
                    }
                  }}
                  className="px-2 rounded-lg text-xs"
                  style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  ↵
                </button>
              </div>
            </div>
          </div>

          {/* Footer — tier status */}
          <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
              {userTier === 'studio' ? '🏆 Studio' : userTier === 'pro' ? '🦊 Pro' : '🆓 Free'}
            </span>
            <div className="flex-1" />
            {userTier === 'free' && (
              <button
                onClick={() => { setOpen(false); window.open('https://momiji-ide.lemonsqueezy.com', '_blank') }}
                className="text-xs px-2 py-1 rounded-lg font-semibold"
                style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer' }}>
                Upgrade to Pro →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
