import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import type { AIProvider } from '../../types'

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
  // ── FREE tier (limited — just enough to try Kitsune) ───────────────────
  { id: 'gemini-35-flash-f', label: 'Gemini 3.5 Flash',      sublabel: '20 req/day free',        providerId: 'gemini',     model: 'gemini-3.5-flash',                       tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'gemini-flash-lite', label: 'Gemini 3.1 Flash Lite', sublabel: '500 req/day free',       providerId: 'gemini',     model: 'gemini-3.1-flash-lite',                  tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'groq-llama-8b',     label: 'Llama 3.1 8B',          sublabel: 'fastest · light',        providerId: 'groq',       model: 'llama-3.1-8b-instant',                   tier: 'free',   badge: 'FREE',  emoji: '⚡' },
  { id: 'gemma-4-27b',       label: 'Gemma 4 27B',           sublabel: 'Google open · 1.5K/day', providerId: 'gemini',     model: 'gemma-4-27b-it',                         tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'gemma-4-31b',       label: 'Gemma 4 31B',           sublabel: 'largest Gemma · free',   providerId: 'gemini',     model: 'gemma-4-31b-it',                         tier: 'free',   badge: 'FREE',  emoji: '🟠' },
  { id: 'sn-llama-70b',      label: 'Llama 3.3 70B',         sublabel: 'SambaNova · ultra fast', providerId: 'sambanova',  model: 'Meta-Llama-3.3-70B-Instruct',            tier: 'free',   badge: 'FREE',  emoji: '🔶' },
  { id: 'sn-deepseek-r1',    label: 'DeepSeek R1 70B',       sublabel: 'SambaNova · reasoning',  providerId: 'sambanova',  model: 'DeepSeek-R1-Distill-Llama-70B',          tier: 'free',   badge: 'FREE',  emoji: '🔶' },
  { id: 'sn-qwq',            label: 'QwQ 32B',               sublabel: 'SambaNova · reasoning',  providerId: 'sambanova',  model: 'QwQ-32B',                                tier: 'free',   badge: 'FREE',  emoji: '🔶' },
  { id: 'cb-llama-70b',      label: 'Llama 3.3 70B',         sublabel: 'Cerebras · ~2000 t/s',   providerId: 'cerebras',   model: 'llama-3.3-70b',                          tier: 'free',   badge: 'FREE',  emoji: '🧠' },
  { id: 'cb-llama4-scout',   label: 'Llama 4 Scout',         sublabel: 'Cerebras · latest',      providerId: 'cerebras',   model: 'llama-4-scout-17b-16e-instruct',         tier: 'free',   badge: 'FREE',  emoji: '🧠' },

  // ── PRO tier ($15/mo — all cloud models) ──────────────────────────────
  { id: 'groq-llama-70b',    label: 'Llama 3.3 70B',         sublabel: 'fast · versatile',      providerId: 'groq',       model: 'llama-3.3-70b-versatile',                tier: 'pro',    badge: 'Pro',   emoji: '⚡' },
  { id: 'groq-deepseek-r1',  label: 'DeepSeek R1',           sublabel: 'reasoning via Groq',    providerId: 'groq',       model: 'deepseek-r1-distill-llama-70b',          tier: 'pro',    badge: 'Pro',   emoji: '⚡' },
  { id: 'groq-qwen',         label: 'Qwen QwQ 32B',          sublabel: 'reasoning via Groq',    providerId: 'groq',       model: 'qwen-qwq-32b',                           tier: 'pro',    badge: 'Pro',   emoji: '⚡' },
  { id: 'gemini-3-flash-f',  label: 'Gemini 3 Flash',        sublabel: 'fast · capable',        providerId: 'gemini',     model: 'gemini-3-flash',                         tier: 'pro',    badge: 'Pro',   emoji: '🟠' },
  { id: 'gemini-25-flash',   label: 'Gemini 2.5 Flash',      sublabel: 'balanced · 1M ctx',     providerId: 'gemini',     model: 'gemini-2.5-flash',                       tier: 'pro',    badge: 'Pro',   emoji: '🟠' },
  { id: 'gemini-25-lite',    label: 'Gemini 2.5 Flash-Lite', sublabel: 'ultra cheap',            providerId: 'gemini',     model: 'gemini-2.5-flash-lite',                  tier: 'pro',    badge: 'Pro',   emoji: '🟠' },
  { id: 'claude-haiku',      label: 'Claude Haiku 4.5',      sublabel: 'fastest Anthropic',      providerId: 'claude',     model: 'claude-haiku-4-5',                       tier: 'pro',    badge: 'Pro',   emoji: '🟣' },
  { id: 'gpt-5-mini',        label: 'GPT-5 Mini',            sublabel: 'fast · affordable',      providerId: 'openai',     model: 'gpt-5-mini',                             tier: 'pro',    badge: 'New',   emoji: '🟢' },
  { id: 'deepseek-chat',     label: 'DeepSeek V3',           sublabel: 'very cheap · capable',   providerId: 'deepseek',   model: 'deepseek-chat',                          tier: 'pro',    badge: 'Pro',   emoji: '🔵' },
  { id: 'mistral-small',     label: 'Mistral Small 3.1',     sublabel: 'fast & cheap',           providerId: 'mistral',    model: 'mistral-small-latest',                   tier: 'pro',    badge: 'Pro',   emoji: '⚪' },
  { id: 'or-llama-free',     label: 'Llama 3.3 70B',         sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', tier: 'pro',    badge: 'Pro',   emoji: '🌐' },
  { id: 'or-deepseek-free',  label: 'DeepSeek R1',           sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'deepseek/deepseek-r1:free',              tier: 'pro',    badge: 'Pro',   emoji: '🌐' },
  { id: 'or-gemma-free',     label: 'Gemma 3 27B',           sublabel: 'via OpenRouter',        providerId: 'openrouter', model: 'google/gemma-3-27b-it:free',             tier: 'pro',    badge: 'Pro',   emoji: '🌐' },

  // ── STUDIO tier ───────────────────────────────────────────────────────────
  { id: 'claude-sonnet',     label: 'Claude Sonnet 4.6',     sublabel: 'best speed+intel ⭐',    providerId: 'claude',     model: 'claude-sonnet-4-6',                      tier: 'studio', badge: 'New',    emoji: '🟣' },
  { id: 'claude-opus',       label: 'Claude Opus 4.7',       sublabel: 'most capable · 1M ctx',  providerId: 'claude',     model: 'claude-opus-4-7',                        tier: 'studio', badge: 'New',    emoji: '🟣' },
  { id: 'gemini-3-pro',      label: 'Gemini 3 Pro',          sublabel: 'best reasoning Google',   providerId: 'gemini',     model: 'gemini-3-pro',                           tier: 'studio', badge: 'Studio', emoji: '🟠' },
  { id: 'gemini-25-pro',     label: 'Gemini 2.5 Pro',        sublabel: 'advanced reasoning',      providerId: 'gemini',     model: 'gemini-2.5-pro',                         tier: 'studio', badge: 'Studio', emoji: '🟠' },
  { id: 'gpt-5',             label: 'GPT-5',                 sublabel: 'flagship OpenAI',         providerId: 'openai',     model: 'gpt-5',                                  tier: 'studio', badge: 'New',    emoji: '🟢' },
  { id: 'gpt-5-5',           label: 'GPT-5.5',               sublabel: 'latest OpenAI',           providerId: 'openai',     model: 'gpt-5.5',                                tier: 'studio', badge: 'New',    emoji: '🟢' },
  { id: 'grok-4',            label: 'Grok 4',                sublabel: 'xAI · reasoning',         providerId: 'custom',     model: 'grok-4',                                 tier: 'studio', badge: 'Studio', emoji: '𝕏' },
  { id: 'mistral-large',     label: 'Mistral Large 2',       sublabel: 'most capable Mistral',    providerId: 'mistral',    model: 'mistral-large-latest',                   tier: 'studio', badge: 'Studio', emoji: '⚪' },
  { id: 'deepseek-r1',       label: 'DeepSeek R1',           sublabel: 'reasoning specialist',    providerId: 'deepseek',   model: 'deepseek-reasoner',                      tier: 'studio', badge: 'Studio', emoji: '🔵' },
]

const OLLAMA_DEFAULTS: ModelEntry[] = [
  { id: 'ollama-qwen',       label: 'Qwen2.5 Coder 7B',      sublabel: 'best for code ⭐',       providerId: 'ollama', model: 'qwen2.5-coder:7b',   tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-qwen32',     label: 'Qwen2.5 Coder 32B',     sublabel: 'GPT-4 level',             providerId: 'ollama', model: 'qwen2.5-coder:32b',  tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-llama',      label: 'Llama 3.3 70B',         sublabel: 'most capable',            providerId: 'ollama', model: 'llama3.3:70b',       tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-gemma3',     label: 'Gemma 3 12B',           sublabel: 'Google · balanced',       providerId: 'ollama', model: 'gemma3:12b',         tier: 'local', badge: 'Local', emoji: '🏠' },
  { id: 'ollama-deepseek',   label: 'DeepSeek Coder V2',     sublabel: 'code specialist',         providerId: 'ollama', model: 'deepseek-coder-v2',  tier: 'local', badge: 'Local', emoji: '🏠' },
]

// ── Live model discovery — ask each provider's API which models this key can use ──

const PROVIDER_EMOJI: Record<string, string> = {
  gemini: '🟠', claude: '🟣', openai: '🟢', deepseek: '🔵',
  mistral: '⚪', groq: '⚡', openrouter: '🌐', sambanova: '🔶', cerebras: '🧠', custom: '🔧',
}

async function fetchProviderModels(provider: AIProvider): Promise<string[]> {
  try {
    const bearer = { Authorization: `Bearer ${provider.apiKey}` }
    switch (provider.id) {
      case 'gemini': {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`)
        if (!r.ok) return []
        const d = await r.json()
        return (d.models ?? [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''))
      }
      case 'claude': {
        const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' } })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'openai': {
        const r = await fetch('https://api.openai.com/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id as string).filter((id: string) => /^(gpt|o[134]|chatgpt)/.test(id))
      }
      case 'groq': {
        const r = await fetch('https://api.groq.com/openai/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'mistral': {
        const r = await fetch('https://api.mistral.ai/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'deepseek': {
        const r = await fetch('https://api.deepseek.com/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'openrouter': {
        const r = await fetch('https://openrouter.ai/api/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'sambanova': {
        const r = await fetch('https://api.sambanova.ai/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'cerebras': {
        const r = await fetch('https://api.cerebras.ai/v1/models', { headers: bearer })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      case 'custom': {
        if (!provider.baseUrl) return []
        const r = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/v1/models`, { headers: provider.apiKey ? bearer : undefined })
        if (!r.ok) return []
        const d = await r.json()
        return (d.data ?? []).map((m: any) => m.id)
      }
      default: return []
    }
  } catch { return [] }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(entry: ModelEntry): string {
  return entry.label.replace('Claude ', '').replace('Gemini ', '').replace('GPT-', '').slice(0, 22)
}

const CHECKOUT_URL = 'https://momiji-ide.lemonsqueezy.com/checkout/buy/495febcd-8f43-44cc-9fab-7cd2896874a5'

const TIER_ORDER: Tier[] = ['free', 'pro', 'studio', 'byok', 'local']

const TIER_LABELS: Record<Tier, string> = {
  free:   '🆓 Free',
  pro:    '🦊 Pro · $15/mo',
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
  const { aiProviders, updateAIProvider, licenseTier } = useAppStore()
  const [open, setOpen]               = useState(false)
  const [search, setSearch]           = useState('')
  const [localModels, setLocalModels] = useState<string[]>([])
  const [customModel, setCustomModel] = useState('')
  const [detectedModels, setDetectedModels] = useState<Record<string, string[]>>({})
  const detectedKeysRef = useRef<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const userTier = licenseTier

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

  // Ask each provider's API which models this key actually has access to —
  // cached per (provider, key, baseUrl) so re-opening the dropdown doesn't refetch.
  useEffect(() => {
    if (!open) return
    aiProviders.forEach(p => {
      if (!p.enabled || p.id === 'ollama') return
      if (!p.apiKey && p.id !== 'custom') return
      const cacheKey = `${p.id}:${p.apiKey}:${p.baseUrl ?? ''}`
      if (detectedKeysRef.current.has(cacheKey)) return
      detectedKeysRef.current.add(cacheKey)
      fetchProviderModels(p).then(models => {
        if (models.length) setDetectedModels(prev => ({ ...prev, [p.id]: models }))
      })
    })
  }, [open]) // eslint-disable-line

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

  // Models the user's own API keys actually support but aren't in our curated
  // catalogue — only surfaced while searching, since lists like OpenRouter's
  // can have hundreds of entries.
  const detectedEntries: ModelEntry[] = search
    ? Object.entries(detectedModels).flatMap(([providerId, models]) =>
        models
          .filter(m => !ALL_MODELS.some(e => e.providerId === providerId && e.model === m))
          .map(m => ({
            id: `detected-${providerId}-${m}`, label: m, providerId, model: m,
            tier: 'byok' as Tier, badge: 'On your key', emoji: PROVIDER_EMOJI[providerId] ?? '🔑'
          }))
      )
    : []

  const allEntries = [...ALL_MODELS, ...ollamaModels, ...detectedEntries]

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
                onClick={() => { setOpen(false); window.open(CHECKOUT_URL, '_blank') }}
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
