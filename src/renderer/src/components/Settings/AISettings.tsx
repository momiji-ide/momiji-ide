import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AIProvider } from '../../types'
import { toast } from '../../utils/toast'

// ── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'claude',     name: 'Claude',     org: 'Anthropic',  emoji: '🟣', free: false, defaultModel: 'claude-sonnet-4-5',              keyHint: 'sk-ant-...',    keyLink: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini',     name: 'Gemini',     org: 'Google',     emoji: '🟠', free: true,  defaultModel: 'gemini-2.5-flash',                keyHint: 'AIza...',       keyLink: 'https://aistudio.google.com/apikey' },
  { id: 'openai',     name: 'ChatGPT',    org: 'OpenAI',     emoji: '🟢', free: false, defaultModel: 'gpt-4o-mini',                     keyHint: 'sk-...',        keyLink: 'https://platform.openai.com/api-keys' },
  { id: 'groq',       name: 'Groq',       org: 'Groq',       emoji: '⚡', free: true,  defaultModel: 'llama-3.3-70b-versatile',         keyHint: 'gsk_...',       keyLink: 'https://console.groq.com/keys' },
  { id: 'openrouter', name: 'OpenRouter', org: 'OpenRouter', emoji: '🌐', free: true,  defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', keyHint: 'sk-or-...', keyLink: 'https://openrouter.ai/keys' },
  { id: 'deepseek',   name: 'DeepSeek',   org: 'DeepSeek',   emoji: '🔵', free: false, defaultModel: 'deepseek-chat',                   keyHint: 'sk-...',        keyLink: 'https://platform.deepseek.com/api_keys' },
  { id: 'mistral',    name: 'Mistral',    org: 'Mistral AI', emoji: '⚪', free: false, defaultModel: 'mistral-small-latest',            keyHint: '...',           keyLink: 'https://console.mistral.ai/api-keys' },
  { id: 'ollama',     name: 'Ollama',     org: 'Local',      emoji: '🏠', free: true,  defaultModel: 'qwen2.5-coder:7b',                keyHint: '',              keyLink: 'https://ollama.ai' },
  { id: 'custom',     name: 'Custom',     org: 'OpenAI-API', emoji: '⚙️', free: false, defaultModel: 'gpt-4o',                          keyHint: 'sk-...',        keyLink: '' },
] as const

type ProviderId = typeof PROVIDERS[number]['id']

// Quick model presets per provider
const MODEL_PRESETS: Record<string, { label: string; model: string; badge?: string }[]> = {
  claude: [
    { label: 'Haiku 3.5',  model: 'claude-haiku-3-5',   badge: 'fastest' },
    { label: 'Sonnet 4.5', model: 'claude-sonnet-4-5',  badge: 'recommended' },
    { label: 'Opus 4.5',   model: 'claude-opus-4-5',    badge: 'best' },
  ],
  gemini: [
    { label: '2.5 Flash-Lite', model: 'gemini-2.5-flash-lite', badge: 'free' },
    { label: '3.1 Flash-Lite', model: 'gemini-3.1-flash-lite', badge: 'free' },
    { label: '2.5 Flash',      model: 'gemini-2.5-flash',      badge: 'BYOK' },
    { label: '3.5 Flash',      model: 'gemini-3.5-flash',      badge: 'latest' },
    { label: '2.5 Pro',        model: 'gemini-2.5-pro',        badge: 'BYOK' },
  ],
  openai: [
    { label: 'GPT-4o Mini', model: 'gpt-4o-mini', badge: 'cheap' },
    { label: 'GPT-4o',      model: 'gpt-4o',      badge: 'recommended' },
    { label: 'o1 Mini',     model: 'o1-mini',     badge: 'reasoning' },
  ],
  groq: [
    { label: 'Llama 3.3 70B',  model: 'llama-3.3-70b-versatile',    badge: 'free' },
    { label: 'Llama 3.1 8B',   model: 'llama-3.1-8b-instant',       badge: 'free·fast' },
    { label: 'Mixtral 8x7B',   model: 'mixtral-8x7b-32768',         badge: 'free' },
    { label: 'Gemma2 9B',      model: 'gemma2-9b-it',               badge: 'free' },
  ],
  openrouter: [
    { label: 'Llama 3.3 70B (free)', model: 'meta-llama/llama-3.3-70b-instruct:free', badge: 'free' },
    { label: 'Gemma 3 27B (free)',   model: 'google/gemma-3-27b-it:free',              badge: 'free' },
    { label: 'DeepSeek R1 (free)',   model: 'deepseek/deepseek-r1:free',               badge: 'free' },
    { label: 'Claude Sonnet',        model: 'anthropic/claude-sonnet-4-5',             badge: 'paid' },
  ],
  deepseek: [
    { label: 'DeepSeek Chat',     model: 'deepseek-chat',     badge: 'recommended' },
    { label: 'DeepSeek Reasoner', model: 'deepseek-reasoner', badge: 'reasoning' },
  ],
  mistral: [
    { label: 'Small Latest',  model: 'mistral-small-latest',  badge: 'cheap' },
    { label: 'Medium Latest', model: 'mistral-medium-latest', badge: 'balanced' },
    { label: 'Large Latest',  model: 'mistral-large-latest',  badge: 'best' },
  ],
  ollama:  [],
  custom:  [],
}

// ── Model fetcher ────────────────────────────────────────────────────────────

async function fetchModels(provider: AIProvider): Promise<string[]> {
  try {
    if (provider.id === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`)
      const d = await r.json()
      return (d.models ?? [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''))
        .sort()
    }
    if (provider.id === 'ollama') {
      const base = provider.baseUrl ?? 'http://localhost:11434'
      const r = await fetch(`${base}/api/tags`)
      const d = await r.json()
      return (d.models ?? []).map((m: any) => m.name).sort()
    }
    if (provider.id === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' }
      })
      const d = await r.json()
      return (d.data ?? []).map((m: any) => m.id).sort()
    }
    // OpenAI-compatible
    const baseUrl: Record<string, string> = {
      openai: 'https://api.openai.com',
      groq: 'https://api.groq.com/openai',
      openrouter: 'https://openrouter.ai/api',
      deepseek: 'https://api.deepseek.com',
      mistral: 'https://api.mistral.ai',
    }
    const base = provider.baseUrl ?? baseUrl[provider.id] ?? 'https://api.openai.com'
    const r = await fetch(`${base}/v1/models`, {
      headers: { 'Authorization': `Bearer ${provider.apiKey}` }
    })
    const d = await r.json()
    return (d.data ?? []).map((m: any) => m.id).sort()
  } catch {
    return []
  }
}

// ── Test connection ──────────────────────────────────────────────────────────

async function testConnection(provider: AIProvider): Promise<string> {
  try {
    if (provider.id === 'gemini') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say: ok' }] }] }) }
      )
      const d = await r.json()
      if (!r.ok) return `❌ ${d.error?.message ?? 'API error'}`
      return `✅ Connected — ${d.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 40) ?? 'ok'}`
    }
    if (provider.id === 'ollama') {
      const base = provider.baseUrl ?? 'http://localhost:11434'
      const r = await fetch(`${base}/api/tags`)
      if (!r.ok) return '❌ Ollama not running — run: ollama serve'
      const d = await r.json()
      return `✅ Ollama connected — ${d.models?.length ?? 0} models`
    }
    if (provider.id === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: provider.model, max_tokens: 10, messages: [{ role: 'user', content: 'Say: ok' }] })
      })
      const d = await r.json()
      if (!r.ok) return `❌ ${d.error?.message ?? 'API error'}`
      return `✅ Connected — ${d.content?.[0]?.text?.slice(0, 40) ?? 'ok'}`
    }
    // OpenAI-compatible
    const baseUrl: Record<string, string> = {
      openai: 'https://api.openai.com', groq: 'https://api.groq.com/openai',
      openrouter: 'https://openrouter.ai/api', deepseek: 'https://api.deepseek.com',
      mistral: 'https://api.mistral.ai',
    }
    const base = provider.baseUrl ?? baseUrl[provider.id] ?? 'https://api.openai.com'
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, max_tokens: 10, messages: [{ role: 'user', content: 'Say: ok' }] })
    })
    const d = await r.json()
    if (!r.ok) return `❌ ${d.error?.message ?? 'API error'}`
    return `✅ Connected — ${d.choices?.[0]?.message?.content?.slice(0, 40) ?? 'ok'}`
  } catch (e: any) {
    return `❌ ${e.message}`
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function AISettings() {
  const { aiProviders, updateAIProvider } = useAppStore()
  const [selectedId, setSelectedId] = useState<ProviderId>('gemini')
  const [showKey, setShowKey] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const meta     = PROVIDERS.find(p => p.id === selectedId)!
  const provider = aiProviders.find(p => p.id === selectedId)!
  const presets  = MODEL_PRESETS[selectedId] ?? []

  // Reset state when switching providers
  useEffect(() => {
    setShowKey(false)
    setFetchedModels([])
    setTestResult('')
  }, [selectedId])

  const update = (patch: Partial<AIProvider>) =>
    updateAIProvider({ ...provider, ...patch })

  const handleFetchModels = useCallback(async () => {
    if (selectedId !== 'ollama' && !provider.apiKey) {
      toast.warning('Enter API key first')
      return
    }
    setFetching(true)
    const models = await fetchModels(provider)
    setFetchedModels(models)
    setFetching(false)
    if (models.length === 0) toast.warning('No models found — check API key')
    else toast.success(`${models.length} models loaded`)
  }, [provider, selectedId])

  const handleTest = useCallback(async () => {
    setTesting(true); setTestResult('')
    const result = await testConnection(provider)
    setTestResult(result)
    setTesting(false)
  }, [provider])

  const needsKey  = selectedId !== 'ollama'
  const needsBase = selectedId === 'ollama' || selectedId === 'custom'

  return (
    <div className="flex flex-col gap-4">

      {/* Provider chips */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-subtle)' }}>AI Provider</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PROVIDERS.map(p => {
            const prov = aiProviders.find(a => a.id === p.id)
            const isActive = selectedId === p.id
            const isEnabled = prov?.enabled
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id as ProviderId)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                style={{
                  background: isActive ? 'var(--accent-mauve)18' : 'var(--bg-surface0)',
                  border: `1.5px solid ${isActive ? 'var(--accent-mauve)' : isEnabled ? 'var(--accent-green)44' : 'var(--border)'}`,
                }}>
                <span style={{ fontSize: 16 }}>{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--accent-mauve)' : 'var(--text)' }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{p.org}</p>
                </div>
                {isEnabled && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} />}
                {p.free && !isEnabled && <span style={{ fontSize: 8, color: 'var(--accent-green)', fontWeight: 700, flexShrink: 0 }}>FREE</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Config panel */}
      <div className="flex flex-col gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{meta.emoji}</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{meta.name}</p>
            <p style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{meta.org}</p>
          </div>
          {/* Enable toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{provider.enabled ? 'On' : 'Off'}</span>
            <button onClick={() => update({ enabled: !provider.enabled })}
              style={{
                width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                background: provider.enabled ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                transition: 'background 0.2s'
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute',
                top: 3, left: provider.enabled ? 19 : 3, transition: 'left 0.2s'
              }} />
            </button>
          </div>
        </div>

        {/* API Key */}
        {needsKey && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>API Key</label>
              {meta.keyLink && (
                <a href={meta.keyLink} target="_blank" rel="noreferrer"
                  className="text-xs" style={{ color: 'var(--accent-mauve)' }}>
                  Get key ↗
                </a>
              )}
            </div>
            <div className="flex gap-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={provider.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                placeholder={meta.keyHint || 'Paste API key here'}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <button onClick={() => setShowKey(!showKey)}
                className="px-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-surface1)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        )}

        {/* Base URL (Ollama + Custom) */}
        {needsBase && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {selectedId === 'ollama' ? 'Ollama URL' : 'Base URL'}
            </label>
            <input
              value={provider.baseUrl ?? (selectedId === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com')}
              onChange={e => update({ baseUrl: e.target.value })}
              placeholder={selectedId === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com'}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
              style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            {selectedId === 'custom' && (
              <p style={{ fontSize: 10, color: 'var(--text-subtle)' }}>Appends /v1/chat/completions automatically</p>
            )}
          </div>
        )}

        {/* Model */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Model</label>
          <div className="flex gap-1">
            {fetchedModels.length > 0 ? (
              <select value={provider.model} onChange={e => update({ model: e.target.value })}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                {fetchedModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input value={provider.model} onChange={e => update({ model: e.target.value })}
                placeholder="model-name"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            )}
            <button onClick={handleFetchModels} disabled={fetching}
              title="Fetch available models from API"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--bg-surface1)', color: fetching ? 'var(--text-subtle)' : 'var(--accent-mauve)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              {fetching ? '⟳' : '↻ Fetch'}
            </button>
          </div>

          {/* Quick select presets */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {presets.map(p => (
                <button key={p.model} onClick={() => update({ model: p.model })}
                  className="text-xs px-2 py-0.5 rounded-full transition-all"
                  style={{
                    background: provider.model === p.model ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                    color: provider.model === p.model ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${provider.model === p.model ? 'var(--accent-mauve)' : 'var(--border)'}`,
                    fontSize: 10
                  }}>
                  {p.label}
                  {p.badge && (
                    <span style={{
                      marginLeft: 3, fontSize: 8, fontWeight: 700,
                      color: p.badge === 'free' || p.badge === 'free·fast' ? 'var(--accent-green)' :
                             p.badge === 'recommended' || p.badge === 'latest' ? 'var(--accent-yellow)' :
                             'var(--text-subtle)'
                    }}>{p.badge}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Test connection */}
        <div className="flex flex-col gap-1.5">
          <button onClick={handleTest} disabled={testing || (needsKey && !provider.apiKey)}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: testing ? 'var(--bg-surface1)' : 'var(--accent-mauve)',
              color: testing ? 'var(--text-subtle)' : 'white',
              border: 'none', cursor: testing || (needsKey && !provider.apiKey) ? 'not-allowed' : 'pointer',
              opacity: needsKey && !provider.apiKey ? 0.5 : 1
            }}>
            {testing ? '⟳ Testing…' : '🔌 Test Connection'}
          </button>
          {testResult && (
            <div className="px-3 py-1.5 rounded-lg text-xs font-mono"
              style={{
                background: testResult.startsWith('✅') ? 'var(--accent-green)18' : 'var(--accent-red)18',
                color: testResult.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)',
                border: `1px solid ${testResult.startsWith('✅') ? 'var(--accent-green)44' : 'var(--accent-red)44'}`
              }}>
              {testResult}
            </div>
          )}
        </div>

        {/* Ollama install hint */}
        {selectedId === 'ollama' && (
          <div className="p-2.5 rounded-xl text-xs" style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)', lineHeight: 1.6 }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>🏠 Setup Ollama</p>
            <code style={{ color: 'var(--accent-green)', display: 'block' }}>1. Download: ollama.ai</code>
            <code style={{ color: 'var(--accent-green)', display: 'block' }}>2. ollama pull qwen2.5-coder</code>
            <code style={{ color: 'var(--accent-green)', display: 'block' }}>3. ollama serve</code>
            <p className="mt-1">Then click ↻ Fetch to see your models</p>
          </div>
        )}
      </div>
    </div>
  )
}
