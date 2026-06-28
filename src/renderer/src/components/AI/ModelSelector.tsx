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
  // ── Google ────────────────────────────────────────────────────────────
  { id: 'gemini-35-flash',   label: 'Gemini 3.5 Flash',      sublabel: 'newest · fast',          providerId: 'gemini',     model: 'gemini-3.5-flash',                       tier: 'free',   emoji: '🟠' },
  { id: 'gemini-3-flash',    label: 'Gemini 3 Flash',        sublabel: 'fast · capable',         providerId: 'gemini',     model: 'gemini-3-flash',                         tier: 'free',   emoji: '🟠' },
  { id: 'gemini-25-flash',   label: 'Gemini 2.5 Flash',      sublabel: '1M ctx · reasoning',     providerId: 'gemini',     model: 'gemini-2.5-flash',                       tier: 'free',   emoji: '🟠' },
  { id: 'gemini-3-pro',      label: 'Gemini 3 Pro',          sublabel: 'best reasoning',         providerId: 'gemini',     model: 'gemini-3-pro',                           tier: 'free',   emoji: '🟠' },
  { id: 'gemini-flash-lite', label: 'Gemini 3.1 Flash Lite', sublabel: 'ultra light',            providerId: 'gemini',     model: 'gemini-3.1-flash-lite',                  tier: 'free',   emoji: '🟠' },
  { id: 'gemma-4-26b',       label: 'Gemma 4 26B',           sublabel: 'open model',             providerId: 'gemini',     model: 'gemma-4-26b-a4b-it',                     tier: 'free',   emoji: '🟠' },
  { id: 'gemma-4-31b',       label: 'Gemma 4 31B',           sublabel: 'largest Gemma',          providerId: 'gemini',     model: 'gemma-4-31b-it',                         tier: 'free',   emoji: '🟠' },

  // ── Anthropic ─────────────────────────────────────────────────────────
  { id: 'claude-haiku',      label: 'Claude Haiku 4.5',      sublabel: 'fastest',                providerId: 'claude',     model: 'claude-haiku-4-5',                       tier: 'free',   emoji: '🟣' },
  { id: 'claude-sonnet',     label: 'Claude Sonnet 4.6',     sublabel: 'best balance ⭐',        providerId: 'claude',     model: 'claude-sonnet-4-6',                      tier: 'free',   emoji: '🟣' },
  { id: 'claude-opus',       label: 'Claude Opus 4.7',       sublabel: 'most capable',           providerId: 'claude',     model: 'claude-opus-4-7',                        tier: 'free',   emoji: '🟣' },

  // ── OpenAI ────────────────────────────────────────────────────────────
  { id: 'gpt-5-mini',        label: 'GPT-5 Mini',            sublabel: 'fast · affordable',      providerId: 'openai',     model: 'gpt-5-mini',                             tier: 'free',   emoji: '🟢' },
  { id: 'gpt-5',             label: 'GPT-5',                 sublabel: 'flagship',               providerId: 'openai',     model: 'gpt-5',                                  tier: 'free',   emoji: '🟢' },
  { id: 'gpt-5-5',           label: 'GPT-5.5',               sublabel: 'latest',                 providerId: 'openai',     model: 'gpt-5.5',                                tier: 'free',   emoji: '🟢' },

  // ── Groq (free, fast) ────────────────────────────────────────────────
  { id: 'groq-llama-70b',    label: 'Llama 3.3 70B',         sublabel: 'fast · versatile',       providerId: 'groq',       model: 'llama-3.3-70b-versatile',                tier: 'free',   emoji: '⚡' },
  { id: 'groq-llama-8b',     label: 'Llama 3.1 8B',          sublabel: 'fastest · light',        providerId: 'groq',       model: 'llama-3.1-8b-instant',                   tier: 'free',   emoji: '⚡' },
  { id: 'groq-deepseek-r1',  label: 'DeepSeek R1',           sublabel: 'reasoning',              providerId: 'groq',       model: 'deepseek-r1-distill-llama-70b',          tier: 'free',   emoji: '⚡' },
  { id: 'groq-qwen',         label: 'Qwen QwQ 32B',          sublabel: 'reasoning',              providerId: 'groq',       model: 'qwen-qwq-32b',                           tier: 'free',   emoji: '⚡' },

  // ── SambaNova (free, fast) ───────────────────────────────────────────
  { id: 'sn-llama-70b',      label: 'Llama 3.3 70B',         sublabel: 'ultra fast',             providerId: 'sambanova',  model: 'Meta-Llama-3.3-70B-Instruct',            tier: 'free',   emoji: '🔶' },
  { id: 'sn-deepseek-r1',    label: 'DeepSeek R1 70B',       sublabel: 'reasoning',              providerId: 'sambanova',  model: 'DeepSeek-R1-Distill-Llama-70B',          tier: 'free',   emoji: '🔶' },
  { id: 'sn-qwq',            label: 'QwQ 32B',               sublabel: 'reasoning',              providerId: 'sambanova',  model: 'QwQ-32B',                                tier: 'free',   emoji: '🔶' },

  // ── Cerebras (free, ultra fast) ──────────────────────────────────────
  { id: 'cb-llama-70b',      label: 'Llama 3.3 70B',         sublabel: '~2000 tok/s',            providerId: 'cerebras',   model: 'llama-3.3-70b',                          tier: 'free',   emoji: '🧠' },
  { id: 'cb-llama4-scout',   label: 'Llama 4 Scout',         sublabel: 'latest',                 providerId: 'cerebras',   model: 'llama-4-scout-17b-16e-instruct',         tier: 'free',   emoji: '🧠' },

  // ── Others ────────────────────────────────────────────────────────────
  { id: 'deepseek-chat',     label: 'DeepSeek V3',           sublabel: 'very cheap',             providerId: 'deepseek',   model: 'deepseek-chat',                          tier: 'free',   emoji: '🔵' },
  { id: 'deepseek-r1',       label: 'DeepSeek R1',           sublabel: 'reasoning',              providerId: 'deepseek',   model: 'deepseek-reasoner',                      tier: 'free',   emoji: '🔵' },
  { id: 'mistral-small',     label: 'Mistral Small 3.1',     sublabel: 'fast & cheap',           providerId: 'mistral',    model: 'mistral-small-latest',                   tier: 'free',   emoji: '⚪' },
  { id: 'mistral-large',     label: 'Mistral Large 2',       sublabel: 'most capable',           providerId: 'mistral',    model: 'mistral-large-latest',                   tier: 'free',   emoji: '⚪' },
  { id: 'or-llama-free',     label: 'Llama 3.3 70B',         sublabel: 'OpenRouter free',        providerId: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', tier: 'free',   emoji: '🌐' },
  { id: 'or-deepseek-free',  label: 'DeepSeek R1',           sublabel: 'OpenRouter free',        providerId: 'openrouter', model: 'deepseek/deepseek-r1:free',              tier: 'free',   emoji: '🌐' },
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


const TIER_ORDER: Tier[] = ['free', 'byok', 'local']

const TIER_LABELS: Record<Tier, string> = {
  free:   '',
  pro:    '',
  studio: '',
  byok:   '🔑 Your models',
  local:  '🏠 Local (Ollama)',
}

const TIER_COLORS: Record<Tier, string> = {
  free:   'var(--text-subtle)',
  pro:    'var(--text-subtle)',
  studio: 'var(--text-subtle)',
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
  const [detectedModels, setDetectedModels] = useState<Record<string, string[]>>({})
  const detectedKeysRef = useRef<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)


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

  const canAccess = (_tier: Tier) => true

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

      {/* Trigger — minimal text pill */}
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
        style={{ background: 'transparent', color: 'var(--text-subtle)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: 11 }}>{activeEntry?.emoji ?? '🤖'}</span>
        <span className="font-medium" style={{ fontSize: 11 }}>{activeEntry?.label ?? activeProvider?.model.slice(0, 20) ?? 'Model'}</span>
        <span style={{ fontSize: 8, marginLeft: 1 }}>▾</span>
      </button>

      {/* Dropdown — compact flat list */}
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ width: 260, maxHeight: 400, background: 'var(--bg-mantle)', border: '1px solid var(--border)' }}>

          <div className="overflow-y-auto flex-1 py-1">
            {TIER_ORDER.map(tier => {
              const items = grouped[tier]
              if (!items?.length) return null
              const unlocked = canAccess(tier)
              return (
                <div key={tier}>
                  <div className="px-3 pt-2 pb-0.5">
                    <span className="uppercase tracking-wider font-bold" style={{ color: TIER_COLORS[tier], fontSize: 9 }}>
                      {TIER_LABELS[tier]}
                    </span>
                  </div>
                  {items.map(entry => {
                    const isActive   = activeProvider.id === entry.providerId && activeProvider.model === entry.model
                    const hasKey     = isProviderEnabled(entry.providerId)
                    const accessible = unlocked && hasKey
                    return (
                      <button key={entry.id}
                        onClick={() => accessible ? selectModel(entry) : undefined}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
                        style={{ background: isActive ? 'var(--bg-surface1)' : 'transparent', cursor: accessible ? 'pointer' : 'default', opacity: accessible ? 1 : 0.4 }}
                        onMouseEnter={e => { if (accessible && !isActive) e.currentTarget.style.background = 'var(--bg-surface0)' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontSize: 12, flexShrink: 0, width: 16, textAlign: 'center' }}>
                          {isActive ? <span style={{ color: 'var(--accent-green)' }}>✓</span> : !unlocked ? <span style={{ fontSize: 10 }}>🔒</span> : entry.emoji}
                        </span>
                        <span className="flex-1 truncate" style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>
                          {entry.label}
                        </span>
                        {!unlocked && <span style={{ fontSize: 8, color: 'var(--accent-yellow)', fontWeight: 700 }}>PRO</span>}
                        {!hasKey && unlocked && <span style={{ fontSize: 8, color: 'var(--text-subtle)' }}>key?</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}
