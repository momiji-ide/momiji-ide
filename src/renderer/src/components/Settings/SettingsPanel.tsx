import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AIProvider } from '../../types'
import { LANGUAGES, getLang, setLang, type Language } from '../../utils/i18n'
import { toast } from '../../utils/toast'

type SettingsTab = 'editor' | 'ai' | 'appearance'

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor')
  const [savedAt, setSavedAt] = useState<number>(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { settings, updateSettings, aiProviders, updateAIProvider, currentFolder, saveWorkspaceSettings } = useAppStore()

  const applySettings = useCallback((patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch)
    setSavedAt(Date.now())
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSavedAt(0), 2000)
  }, [updateSettings])

  const isSaved = Date.now() - savedAt < 2000 && savedAt > 0

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'editor', label: 'Editor', icon: '📝' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'ai', label: 'AI & API Keys', icon: '✨' }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Settings
        </span>
        <div className="flex items-center gap-2">
          {currentFolder && (
            <button
              onClick={async () => { await saveWorkspaceSettings(); toast.success('Saved to .momiji/settings.json') }}
              className="text-xs px-2 py-0.5 rounded transition-all"
              style={{ color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', fontSize: 10 }}
              title="Save current settings to this project folder">
              💾 Workspace
            </button>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full transition-all"
            style={{ opacity: isSaved ? 1 : 0, background: 'var(--accent-green)', color: 'var(--bg-base)', fontSize: '10px', fontWeight: 600 }}>
            ✓ Saved
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0.5 px-2 pt-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-t transition-colors"
            style={{
              background: activeTab === tab.id ? 'var(--bg-base)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-0">
        {activeTab === 'editor' && (
          <div className="flex flex-col gap-4">
            <SettingRow label="🐍 Python Interpreter">
              <input
                value={settings.pythonPath}
                onChange={e => applySettings({ pythonPath: e.target.value })}
                placeholder="python  or  /path/to/venv/python"
                className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
                Click 🐍 in the status bar (bottom) when a .py file is open to pick from detected interpreters.
              </p>
            </SettingRow>

            <SettingRow label="🖥️ Terminal Shell">
              <Select
                value={settings.terminalShell}
                onChange={v => applySettings({ terminalShell: v })}
                options={[
                  { value: 'powershell', label: '⚡ PowerShell' },
                  { value: 'cmd',        label: '> Command Prompt' },
                  { value: 'bash',       label: '$ Git Bash / WSL' },
                  { value: 'zsh',        label: '$ Zsh (macOS/Linux)' },
                ]}
              />
            </SettingRow>
            {/* UI Zoom — scales entire app (fonts, icons, layout) */}
            <SettingRow label="UI Scale">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0.75} max={1.5} step={0.05}
                  value={settings.uiZoom ?? 1.15}
                  onChange={(e) => applySettings({ uiZoom: +e.target.value })}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-10 text-center"
                  style={{ color: 'var(--accent-blue)' }}>
                  {Math.round((settings.uiZoom ?? 1.15) * 100)}%
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                Scales the entire UI — fonts, icons, and layout
              </p>
            </SettingRow>

            <SettingRow label="Editor Font Size">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={10} max={28} value={settings.fontSize}
                  onChange={(e) => applySettings({ fontSize: +e.target.value })}
                  className="flex-1"
                />
                <input
                  type="number" min={10} max={28} value={settings.fontSize}
                  onChange={(e) => applySettings({ fontSize: Math.min(28, Math.max(10, +e.target.value)) })}
                  className="w-12 px-1.5 py-0.5 rounded text-xs text-center outline-none"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--accent-blue)', border: '1px solid var(--border)' }}
                />
              </div>
            </SettingRow>

            <SettingRow label="Tab Size">
              <Select
                value={String(settings.tabSize)}
                onChange={(v) => applySettings({ tabSize: +v })}
                options={[
                  { value: '2', label: '2 spaces' },
                  { value: '4', label: '4 spaces' },
                  { value: '8', label: '8 spaces' }
                ]}
              />
            </SettingRow>

            <SettingRow label="Word Wrap">
              <Select
                value={settings.wordWrap}
                onChange={(v) => applySettings({ wordWrap: v as typeof settings.wordWrap })}
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                  { value: 'bounded', label: 'Bounded' }
                ]}
              />
            </SettingRow>

            <SettingRow label="Line Numbers">
              <Select
                value={settings.lineNumbers}
                onChange={(v) => applySettings({ lineNumbers: v as typeof settings.lineNumbers })}
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                  { value: 'relative', label: 'Relative' }
                ]}
              />
            </SettingRow>

            <SettingRow label="Minimap">
              <Toggle
                checked={settings.minimap}
                onChange={(v) => applySettings({ minimap: v })}
              />
            </SettingRow>

            <SettingRow label="Auto Save">
              <Toggle
                checked={settings.autoSave}
                onChange={(v) => applySettings({ autoSave: v })}
              />
            </SettingRow>

            {settings.autoSave && (
              <SettingRow label="Auto Save Delay">
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={500} max={5000} step={500} value={settings.autoSaveDelay}
                    onChange={(e) => applySettings({ autoSaveDelay: +e.target.value })}
                    className="flex-1"
                  />
                  <span className="text-xs w-12 text-right" style={{ color: 'var(--accent-blue)' }}>
                    {settings.autoSaveDelay}ms
                  </span>
                </div>
              </SettingRow>
            )}
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="flex flex-col gap-4">
            <SettingRow label="Language / 言語 / Idioma">
              <select
                value={getLang()}
                onChange={e => { setLang(e.target.value as Language); window.location.reload() }}
                className="px-2 py-1.5 rounded text-xs outline-none w-full"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
              <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
                Restart wizard: Help → 🦊 Kitsune Setup Wizard
              </p>
            </SettingRow>
            <SettingRow label="Theme">
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      applySettings({ theme: t })
                      document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '')
                    }}
                    className="flex-1 py-2 rounded text-xs font-medium transition-all capitalize"
                    style={{
                      background: settings.theme === t ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                      color: settings.theme === t ? 'var(--bg-base)' : 'var(--text)'
                    }}
                  >
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow label="Font Family">
              <Select
                value={settings.fontFamily}
                onChange={(v) => applySettings({ fontFamily: v })}
                options={[
                  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
                  { value: "'Fira Code', monospace", label: 'Fira Code' },
                  { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
                  { value: "'Courier New', monospace", label: 'Courier New' }
                ]}
              />
            </SettingRow>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              🔐 API keys are stored locally and never sent to any server except the AI provider you choose.
            </p>
            {aiProviders.map((provider) => (
              <AIProviderCard
                key={provider.id}
                provider={provider}
                onUpdate={(p) => { updateAIProvider(p); setSavedAt(Date.now()) }}
              />
            ))}
          </div>
        )}

        {/* Reset footer */}
        {activeTab !== 'ai' && (
          <div className="mt-auto pt-4">
            <button
              onClick={() => applySettings({
                fontSize: 14, fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                tabSize: 2, wordWrap: 'on', minimap: false, lineNumbers: 'on',
                autoSave: true, autoSaveDelay: 1000,
                pythonPath: 'python', terminalShell: navigator.userAgent.includes('Win') ? 'powershell' : 'bash'
              })}
              className="w-full py-1.5 rounded text-xs transition-colors"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              ↺ Reset to defaults
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Model presets shown as quick-pick chips (not exhaustive — user can type any ID)
const PROVIDER_MODELS: Record<string, { value: string; label: string; sublabel: string; tier: 'free' | 'paid' }[]> = {
  claude: [
    { value: 'claude-haiku-4-5',  label: 'Haiku 4.5',  sublabel: 'fastest & cheap',  tier: 'paid' },
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', sublabel: 'recommended ⭐',   tier: 'paid' },
    { value: 'claude-opus-4-5',   label: 'Opus 4.5',   sublabel: 'most capable',     tier: 'paid' },
  ],
  gemini: [
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', sublabel: 'free, 500 RPD ⭐',  tier: 'free' },
    { value: 'gemini-3-flash',        label: 'Gemini 3 Flash',        sublabel: 'free, 20 RPD',     tier: 'free' },
    { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', sublabel: 'BYOK',        tier: 'paid' },
    { value: 'gemini-2.5-pro-preview-05-06',   label: 'Gemini 2.5 Pro',   sublabel: 'BYOK',        tier: 'paid' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', sublabel: 'cheap & fast ⭐', tier: 'paid' },
    { value: 'gpt-4o',      label: 'GPT-4o',      sublabel: 'flagship',        tier: 'paid' },
    { value: 'o3-mini',     label: 'o3 Mini',     sublabel: 'reasoning',       tier: 'paid' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',  sublabel: 'free, ultra fast ⭐', tier: 'free' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',   sublabel: 'free, fastest',      tier: 'free' },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1', sublabel: 'free, reasoning', tier: 'free' },
    { value: 'qwen-qwq-32b',            label: 'Qwen QwQ 32B',   sublabel: 'free, reasoning',   tier: 'free' },
  ],
  openrouter: [
    { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B',  sublabel: 'FREE ⭐', tier: 'free' },
    { value: 'deepseek/deepseek-r1:free',              label: 'DeepSeek R1',    sublabel: 'FREE',   tier: 'free' },
    { value: 'google/gemma-3-27b-it:free',             label: 'Gemma 3 27B',   sublabel: 'FREE',   tier: 'free' },
    { value: 'qwen/qwq-32b:free',                      label: 'Qwen QwQ 32B',  sublabel: 'FREE',   tier: 'free' },
    { value: 'anthropic/claude-sonnet-4-5',            label: 'Claude Sonnet', sublabel: 'paid',   tier: 'paid' },
  ],
  deepseek: [
    { value: 'deepseek-chat',    label: 'DeepSeek V3',  sublabel: '$0.014/M ⭐', tier: 'paid' },
    { value: 'deepseek-reasoner',label: 'DeepSeek R1',  sublabel: 'reasoning',   tier: 'paid' },
  ],
  mistral: [
    { value: 'mistral-small-latest', label: 'Mistral Small',  sublabel: 'fast ⭐', tier: 'paid' },
    { value: 'codestral-latest',     label: 'Codestral',      sublabel: 'code',    tier: 'paid' },
    { value: 'mistral-large-latest', label: 'Mistral Large',  sublabel: 'capable', tier: 'paid' },
  ],
}

const PROVIDER_LINKS: Record<string, { label: string; url: string; free?: boolean }> = {
  claude:     { label: 'Get Claude API key',          url: 'https://console.anthropic.com/keys' },
  gemini:     { label: 'Get Gemini API key (free)',   url: 'https://aistudio.google.com/apikey',            free: true },
  openai:     { label: 'Get OpenAI API key',          url: 'https://platform.openai.com/api-keys' },
  groq:       { label: 'Get Groq API key (free)',     url: 'https://console.groq.com/keys',                 free: true },
  openrouter: { label: 'Get OpenRouter key (free models)', url: 'https://openrouter.ai/keys',               free: true },
  deepseek:   { label: 'Get DeepSeek API key (cheap)', url: 'https://platform.deepseek.com/api_keys' },
  mistral:    { label: 'Get Mistral API key',         url: 'https://console.mistral.ai/api-keys' },
  ollama:     { label: 'Download Ollama (free, local)', url: 'https://ollama.com/download',                 free: true },
}

function FetchGeminiModels({ apiKey, onSelect }: { apiKey: string; onSelect: (m: string) => void }) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetch_ = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      const data = await resp.json()
      if (!resp.ok) { setModels([]); setLoading(false); return }
      const names: string[] = (data.models ?? [])
        .map((m: any) => m.name?.replace('models/', '') as string)
        .filter((n: string) => n && n.includes('gemini') && !n.includes('embedding') && !n.includes('aqa'))
        .sort()
      setModels(names)
      setOpen(true)
    } catch { setModels([]) }
    setLoading(false)
  }

  return (
    <div className="relative">
      <button onClick={fetch_} disabled={loading}
        className="w-full py-1 rounded text-xs transition-all"
        style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
        {loading ? '⏳ Loading models...' : '📋 Browse available models'}
      </button>
      {open && models.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
            <p className="px-3 py-1.5 text-xs font-semibold sticky top-0"
              style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)' }}>
              {models.length} models available with your key
            </p>
            {models.map(m => (
              <button key={m} onClick={() => { onSelect(m); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors font-mono"
                style={{ color: 'var(--text)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {m}
              </button>
            ))}
          </div>
        </>
      )}
      {open && models.length === 0 && !loading && (
        <p className="text-xs mt-1 px-2" style={{ color: 'var(--accent-red)', fontSize: 10 }}>
          Could not fetch models — check your API key
        </p>
      )}
    </div>
  )
}

async function testGeminiKey(apiKey: string, model: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with just: OK' }] }] })
      }
    )
    const data = await resp.json()
    if (!resp.ok) {
      const errMsg = data?.error?.message ?? JSON.stringify(data)
      return `❌ ${errMsg}`
    }
    return `✅ Connected! Model: ${model}`
  } catch (e: any) {
    return `❌ ${e.message}`
  }
}

async function testClaudeKey(apiKey: string, model: string): Promise<string> {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Reply OK' }] })
    })
    const data = await resp.json()
    if (!resp.ok) return `❌ ${data?.error?.message ?? JSON.stringify(data)}`
    return `✅ Connected! Model: ${model}`
  } catch (e: any) {
    return `❌ ${e.message}`
  }
}

async function testOpenAIKey(apiKey: string, model: string): Promise<string> {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Reply OK' }] })
    })
    const data = await resp.json()
    if (!resp.ok) return `❌ ${data?.error?.message ?? JSON.stringify(data)}`
    return `✅ Connected! Model: ${model}`
  } catch (e: any) {
    return `❌ ${e.message}`
  }
}

function AIProviderCard({ provider, onUpdate }: { provider: AIProvider; onUpdate: (p: AIProvider) => void }) {
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (!provider.apiKey) { setTestResult('⚠️ No API key entered'); return }
    setTesting(true)
    setTestResult('Testing...')
    let result = ''
    if (provider.id === 'gemini') result = await testGeminiKey(provider.apiKey, provider.model)
    else if (provider.id === 'claude') result = await testClaudeKey(provider.apiKey, provider.model)
    else result = await testOpenAIKey(provider.apiKey, provider.model)
    setTestResult(result)
    setTesting(false)
  }
  const models = PROVIDER_MODELS[provider.id] ?? []
  const link = PROVIDER_LINKS[provider.id]
  const selectedModel = models.find(m => m.value === provider.model)
  const isCustomModel = !selectedModel && provider.model

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-3"
      style={{ background: 'var(--bg-surface0)', border: `1px solid ${provider.enabled ? 'var(--accent-blue)' : 'var(--border)'}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {provider.name}
          </span>
          {link && (
            <div className="flex items-center gap-1.5">
              {link.free && (
                <span className="text-xs px-1 py-0.5 rounded font-bold"
                  style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44', fontSize: 9 }}>
                  FREE
                </span>
              )}
              {!link.free && provider.id !== 'ollama' && (
                <span className="text-xs px-1 py-0.5 rounded font-bold"
                  style={{ background: 'var(--accent-yellow)22', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)44', fontSize: 9 }}>
                  BYOK
                </span>
              )}
              <button
                onClick={() => window.open(link.url, '_blank')}
                className="text-xs text-left transition-colors"
                style={{ color: 'var(--accent-blue)', fontSize: 10 }}>
                🔑 {link.label} ↗
              </button>
            </div>
          )}
        </div>
        <Toggle
          checked={provider.enabled}
          onChange={(v) => onUpdate({ ...provider, enabled: v })}
        />
      </div>

      {provider.id !== 'ollama' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>API Key</label>
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder={provider.id === 'claude' ? 'sk-ant-...' : provider.id === 'gemini' ? 'AIza...' : 'sk-...'}
              value={provider.apiKey}
              onChange={(e) => onUpdate({ ...provider, apiKey: e.target.value })}
              className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono"
              style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-2 rounded text-xs"
              style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Model</label>

        {/* Primary: custom model ID input (like Cline) */}
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
            Type any model ID — or pick from presets below
          </p>
          <div className="flex gap-1 items-center">
            <input
              type="text"
              value={provider.model}
              onChange={(e) => onUpdate({ ...provider, model: e.target.value })}
              placeholder={
                provider.id === 'claude' ? 'claude-sonnet-4-5'
                : provider.id === 'gemini' ? 'gemini-3.1-flash-lite'
                : provider.id === 'openai' ? 'gpt-4o-mini'
                : provider.id === 'groq' ? 'llama-3.3-70b-versatile'
                : provider.id === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct:free'
                : provider.id === 'deepseek' ? 'deepseek-chat'
                : provider.id === 'mistral' ? 'mistral-small-latest'
                : 'model-id'
              }
              className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono"
              style={{ background: 'var(--bg-base)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)66', fontSize: 11 }}
            />
            {isCustomModel && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--accent-mauve)22', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44', fontSize: 9 }}>
                custom
              </span>
            )}
          </div>
        </div>

        {/* Context window info */}
        {provider.model && (
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10, fontFamily: 'monospace' }}>
            {provider.model.includes('gemini-3') ? '↔ Context: 1M tokens'
              : provider.model.includes('gemini-2.5-pro') ? '↔ Context: 2M tokens'
              : provider.model.includes('gemini') ? '↔ Context: 1M tokens'
              : provider.model.includes('claude') ? '↔ Context: 200K tokens'
              : provider.model.includes('llama-3.3') ? '↔ Context: 128K tokens'
              : provider.model.includes('gpt-4o') ? '↔ Context: 128K tokens'
              : provider.model.includes('deepseek') ? '↔ Context: 64K tokens'
              : provider.model.includes('mistral-large') ? '↔ Context: 128K tokens'
              : provider.model.includes('openrouter') || provider.model.includes(':free') ? '↔ Context: varies by model'
              : ''}
          </p>
        )}

        {/* Preset quick-pick chips */}
        {models.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase font-semibold tracking-wider" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>
              Quick select
            </p>
            <div className="flex flex-wrap gap-1">
              {models.map(m => {
                const isActive = provider.model === m.value
                return (
                  <button key={m.value}
                    onClick={() => onUpdate({ ...provider, model: m.value })}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                    style={{
                      background: isActive ? 'var(--accent-blue)' : 'var(--bg-crust)',
                      color: isActive ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                      fontSize: 10,
                    }}>
                    {isActive && <span>✓ </span>}
                    <span className="font-semibold">{m.label}</span>
                    <span style={{ opacity: 0.7, fontSize: 9 }}>{m.sublabel}</span>
                    {m.tier === 'free' && !isActive && (
                      <span style={{ background: 'var(--accent-green)33', color: 'var(--accent-green)', borderRadius: 3, padding: '0 3px', fontSize: 8, fontWeight: 700 }}>FREE</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Fetch available models (Gemini only) */}
        {provider.id === 'gemini' && provider.apiKey && (
          <FetchGeminiModels apiKey={provider.apiKey} onSelect={m => onUpdate({ ...provider, model: m })} />
        )}

        {/* Test connection */}
        <button onClick={handleTest} disabled={testing || !provider.apiKey}
          className="w-full py-1.5 rounded text-xs font-medium transition-all"
          style={{
            background: testing ? 'var(--bg-surface1)' : 'var(--bg-crust)',
            color: testing ? 'var(--text-subtle)' : 'var(--accent-blue)',
            border: '1px solid var(--accent-blue)'
          }}>
          {testing ? '⏳ Testing...' : '🔌 Test Connection'}
        </button>
        {testResult && (
          <p className="text-xs px-2 py-1.5 rounded font-mono"
            style={{
              background: testResult.startsWith('✅') ? 'var(--accent-green)11' : 'var(--accent-red)11',
              color: testResult.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${testResult.startsWith('✅') ? 'var(--accent-green)33' : 'var(--accent-red)33'}`,
              fontSize: 10, wordBreak: 'break-all'
            }}>
            {testResult}
          </p>
        )}

        {/* Gemini: free tier info */}
        {provider.id === 'gemini' && (
          <div className="flex items-start gap-2 px-2 py-2 rounded"
            style={{ background: 'var(--accent-blue)11', border: '1px solid var(--accent-blue)33' }}>
            <span style={{ fontSize: 13 }}>💡</span>
            <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent-blue)' }}>Free tier tip:</strong> Use <strong>Gemini 3.1 Flash Lite</strong> (500 RPD free) or <strong>Gemini 3 Flash</strong> (20 RPD free). Get key at <code>aistudio.google.com/apikey</code>
            </p>
          </div>
        )}

        {/* Groq: free tier info */}
        {provider.id === 'groq' && (
          <div className="flex items-start gap-2 px-2 py-2 rounded"
            style={{ background: 'var(--accent-green)11', border: '1px solid var(--accent-green)33' }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent-green)' }}>100% Free!</strong> Groq runs Llama 3.3 70B at 500+ tokens/sec — faster than any paid API. Get free key at <code>console.groq.com</code>
            </p>
          </div>
        )}

        {/* OpenRouter: free models info */}
        {provider.id === 'openrouter' && (
          <div className="flex items-start gap-2 px-2 py-2 rounded"
            style={{ background: 'var(--accent-mauve)11', border: '1px solid var(--accent-mauve)33' }}>
            <span style={{ fontSize: 13 }}>🌐</span>
            <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent-mauve)' }}>Many free models!</strong> Select models with <code>:free</code> suffix (Llama, DeepSeek, Gemma). Paid models available too. Get key at <code>openrouter.ai/keys</code>
            </p>
          </div>
        )}

        {/* Ollama: no API key needed, show base URL */}
        {provider.id === 'ollama' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2 px-2 py-2 rounded"
              style={{ background: 'var(--accent-green)11', border: '1px solid var(--accent-green)33' }}>
              <span style={{ fontSize: 14 }}>🦙</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>No API key needed — runs locally!</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                  1. Install Ollama → <code style={{ fontFamily: 'monospace' }}>ollama.com/download</code><br/>
                  2. Pull a model → <code style={{ fontFamily: 'monospace' }}>ollama pull qwen2.5-coder:7b</code><br/>
                  3. Enable toggle → done!
                </p>
              </div>
            </div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Ollama URL</label>
            <input
              type="text"
              value={provider.baseUrl ?? 'http://localhost:11434'}
              onChange={e => onUpdate({ ...provider, baseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="px-2 py-1.5 rounded text-xs outline-none font-mono"
              style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
        )}

        {/* Custom OpenAI-compatible endpoint */}
        {provider.id === 'custom' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded"
              style={{ background: 'var(--accent-mauve)11', border: '1px solid var(--accent-mauve)33' }}>
              <span style={{ fontSize: 12 }}>🔌</span>
              <p className="text-xs" style={{ color: 'var(--accent-mauve)', fontSize: 10, lineHeight: 1.5 }}>
                <strong>OpenAI Compatible</strong> — supports any API with OpenAI format.<br/>
                Works with: company VPN APIs, Azure OpenAI, local proxies, vLLM, LM Studio, etc.
              </p>
            </div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Base URL</label>
            <input
              type="text"
              value={provider.baseUrl ?? 'https://api.openai.com'}
              onChange={e => onUpdate({ ...provider, baseUrl: e.target.value })}
              placeholder="https://your-api-endpoint.com"
              className="px-2 py-1.5 rounded text-xs outline-none font-mono"
              style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
              Example: <code style={{ fontFamily: 'monospace' }}>https://oa-openai-01.openai.azure.com</code><br/>
              Kitsune will append <code style={{ fontFamily: 'monospace' }}>/v1/chat/completions</code> automatically.
            </p>
          </div>
        )}

        {/* Free tier note for Gemini */}
        {provider.id === 'gemini' && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded"
            style={{ background: 'var(--accent-green)11', border: '1px solid var(--accent-green)33' }}>
            <span style={{ fontSize: 12 }}>💡</span>
            <p className="text-xs" style={{ color: 'var(--accent-green)', fontSize: 10, lineHeight: 1.5 }}>
              <strong>Free tier:</strong> Use <code style={{ fontFamily: 'monospace' }}>gemini-1.5-flash</code> or <code style={{ fontFamily: 'monospace' }}>gemini-1.5-flash-8b</code>.
              Model <code style={{ fontFamily: 'monospace' }}>gemini-2.0-flash</code> requires Google Cloud billing to be enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function Select({
  value, onChange, options
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded text-xs outline-none w-full"
      style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
      style={{ background: checked ? 'var(--accent-blue)' : 'var(--bg-surface1)' }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{
          background: 'white',
          left: checked ? '18px' : '2px'
        }}
      />
    </button>
  )
}
