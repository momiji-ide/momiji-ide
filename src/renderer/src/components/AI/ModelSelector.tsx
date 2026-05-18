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
    { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5',   sublabel: 'most capable',     shortcut: 1 },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', sublabel: 'recommended ⭐',   shortcut: 2 },
    { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5',  sublabel: 'fastest & cheap',  shortcut: 3 },
  ],
  gemini: [
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', sublabel: 'free tier, 500 RPD ⭐', shortcut: 1 },
    { value: 'gemini-3-flash',        label: 'Gemini 3 Flash',        sublabel: 'free tier, 20 RPD',    shortcut: 2 },
    { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', sublabel: 'BYOK',            shortcut: 3 },
    { value: 'gemini-2.5-pro-preview-05-06',   label: 'Gemini 2.5 Pro',   sublabel: 'BYOK',            shortcut: 4 },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', sublabel: 'BYOK, recommended ⭐', shortcut: 1 },
    { value: 'gpt-4o',      label: 'GPT-4o',      sublabel: 'BYOK, flagship',       shortcut: 2 },
    { value: 'o3-mini',     label: 'o3 Mini',     sublabel: 'BYOK, reasoning',      shortcut: 3 },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile',    label: 'Llama 3.3 70B',    sublabel: 'free, ultra fast ⭐', shortcut: 1 },
    { value: 'llama-3.1-8b-instant',       label: 'Llama 3.1 8B',     sublabel: 'free, fastest',      shortcut: 2 },
    { value: 'mixtral-8x7b-32768',         label: 'Mixtral 8x7B',     sublabel: 'free, 32k ctx',      shortcut: 3 },
    { value: 'gemma2-9b-it',               label: 'Gemma 2 9B',       sublabel: 'free, Google',       shortcut: 4 },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1',   sublabel: 'free, reasoning' },
    { value: 'qwen-qwq-32b',               label: 'Qwen QwQ 32B',     sublabel: 'free, reasoning' },
  ],
  openrouter: [
    { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B',    sublabel: 'FREE ⭐',     shortcut: 1 },
    { value: 'deepseek/deepseek-r1:free',              label: 'DeepSeek R1',      sublabel: 'FREE, reason', shortcut: 2 },
    { value: 'google/gemma-3-27b-it:free',             label: 'Gemma 3 27B',      sublabel: 'FREE',         shortcut: 3 },
    { value: 'qwen/qwq-32b:free',                      label: 'Qwen QwQ 32B',     sublabel: 'FREE, reason', shortcut: 4 },
    { value: 'anthropic/claude-sonnet-4-5',            label: 'Claude Sonnet 4.5',sublabel: 'paid, best' },
    { value: 'openai/gpt-4o-mini',                     label: 'GPT-4o Mini',      sublabel: 'paid' },
  ],
  deepseek: [
    { value: 'deepseek-chat',    label: 'DeepSeek Chat V3', sublabel: '$0.014/M tokens ⭐', shortcut: 1 },
    { value: 'deepseek-reasoner',label: 'DeepSeek R1',     sublabel: 'reasoning model',     shortcut: 2 },
  ],
  mistral: [
    { value: 'mistral-small-latest',  label: 'Mistral Small',  sublabel: 'fast & cheap ⭐', shortcut: 1 },
    { value: 'mistral-medium-latest', label: 'Mistral Medium', sublabel: 'balanced',         shortcut: 2 },
    { value: 'mistral-large-latest',  label: 'Mistral Large',  sublabel: 'most capable',    shortcut: 3 },
    { value: 'codestral-latest',      label: 'Codestral',      sublabel: 'code specialist', shortcut: 4 },
  ],
  ollama: [
    { value: 'qwen2.5-coder:7b',  label: 'Qwen2.5 Coder 7B',  sublabel: 'best for code ⭐', shortcut: 1 },
    { value: 'qwen2.5-coder:32b', label: 'Qwen2.5 Coder 32B', sublabel: 'GPT-4 level',      shortcut: 2 },
    { value: 'gemma3:12b',        label: 'Gemma 3 12B',        sublabel: 'Google, balanced', shortcut: 3 },
    { value: 'llama3.3:70b',      label: 'Llama 3.3 70B',      sublabel: 'most capable',     shortcut: 4 },
    { value: 'deepseek-coder-v2', label: 'DeepSeek Coder V2',  sublabel: 'code specialist' },
    { value: 'phi4',              label: 'Phi-4',              sublabel: 'Microsoft, fast' },
    { value: 'mistral:7b',        label: 'Mistral 7B',         sublabel: 'fast & capable' },
    { value: 'codellama:13b',     label: 'CodeLlama 13B',      sublabel: 'Meta code' },
  ]
}

const PROVIDER_LABELS: Record<string, string> = {
  claude:     'Claude',
  gemini:     'Gemini',
  openai:     'GPT',
  groq:       'Groq',
  openrouter: 'OpenRouter',
  deepseek:   'DeepSeek',
  mistral:    'Mistral',
  ollama:     'Ollama',
}

// Fetch locally installed Ollama models
async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.models ?? []).map((m: any) => m.name as string)
  } catch { return [] }
}

function shortModelLabel(model: string): string {
  const SHORTS: Record<string, string> = {
    // Claude
    'claude-opus-4-5':   'Opus 4.5',
    'claude-sonnet-4-5': 'Sonnet 4.5',
    'claude-haiku-4-5':  'Haiku 4.5',
    // Gemini
    'gemini-3.1-flash-lite':          '3.1 Flash Lite',
    'gemini-3-flash':                 '3 Flash',
    'gemini-2.5-flash-preview-05-20': '2.5 Flash',
    'gemini-2.5-pro-preview-05-06':   '2.5 Pro',
    // OpenAI
    'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o Mini', 'o3-mini': 'o3 Mini', 'o1-mini': 'o1 Mini',
    // Groq
    'llama-3.3-70b-versatile': 'Llama 3.3 70B',
    'llama-3.1-8b-instant': 'Llama 3.1 8B',
    'mixtral-8x7b-32768': 'Mixtral 8x7B',
    'gemma2-9b-it': 'Gemma 2 9B',
    'deepseek-r1-distill-llama-70b': 'DeepSeek R1',
    'qwen-qwq-32b': 'Qwen QwQ 32B',
    // OpenRouter
    'meta-llama/llama-3.3-70b-instruct:free': 'Llama 3.3 (free)',
    'deepseek/deepseek-r1:free': 'DeepSeek R1 (free)',
    'google/gemma-3-27b-it:free': 'Gemma 3 27B (free)',
    'qwen/qwq-32b:free': 'QwQ 32B (free)',
    // DeepSeek
    'deepseek-chat': 'DeepSeek V3', 'deepseek-reasoner': 'DeepSeek R1',
    // Mistral
    'mistral-small-latest': 'Mistral Small', 'mistral-medium-latest': 'Mistral Medium',
    'mistral-large-latest': 'Mistral Large', 'codestral-latest': 'Codestral',
  }
  if (SHORTS[model]) return SHORTS[model]
  // Fallback: last 2 dash-segments or last 20 chars
  const parts = model.split(/[-/:]/)
  return parts.slice(-2).join(' ').slice(0, 20)
}

interface Props {
  selectedProviderId: string
  onProviderChange: (id: string) => void
}

export function ModelSelector({ selectedProviderId, onProviderChange }: Props) {
  const { aiProviders, updateAIProvider } = useAppStore()
  const [open, setOpen] = useState(false)
  const [localModels, setLocalModels] = useState<string[]>([])
  const [fetchingLocal, setFetchingLocal] = useState(false)
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

            {/* Ollama — local model browser */}
            {activeProvider.id === 'ollama' && (
              <div className="px-3 pb-2 pt-1" style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <div className="flex items-center justify-between mb-1">
                  <p style={{ color: 'var(--text-subtle)', fontSize: 9 }} className="text-xs font-semibold uppercase">Installed locally</p>
                  <button
                    onClick={async () => {
                      setFetchingLocal(true)
                      const ms = await fetchOllamaModels(activeProvider.baseUrl ?? 'http://localhost:11434')
                      setLocalModels(ms)
                      setFetchingLocal(false)
                    }}
                    className="text-xs px-1.5 py-0.5 rounded transition-all"
                    style={{ color: 'var(--accent-green)', border: '1px solid var(--accent-green)44', fontSize: 9 }}>
                    {fetchingLocal ? '⟳' : '↻ Scan'}
                  </button>
                </div>
                {localModels.length > 0 ? (
                  <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                    {localModels.map(m => (
                      <button key={m} onClick={() => { updateAIProvider({ ...activeProvider, model: m }); setOpen(false) }}
                        className="w-full text-left px-2 py-1 rounded text-xs font-mono transition-all flex items-center gap-1"
                        style={{ background: activeProvider.model === m ? 'var(--accent-green)22' : 'var(--bg-crust)', color: activeProvider.model === m ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 10 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = activeProvider.model === m ? 'var(--accent-green)22' : 'var(--bg-crust)')}>
                        {activeProvider.model === m && <span style={{ color: 'var(--accent-green)' }}>✓ </span>}
                        {m}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-subtle)', fontSize: 9 }}>
                    {fetchingLocal ? 'Scanning...' : 'Click ↻ Scan to detect installed models'}
                  </p>
                )}
              </div>
            )}

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
                placeholder={activeProvider.id === 'ollama' ? 'e.g. qwen2.5-coder:7b' : 'e.g. gemini-3-flash-preview'}
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
