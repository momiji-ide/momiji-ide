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
              onClick={async () => { await saveWorkspaceSettings(); toast.success('Saved to .parallax/settings.json') }}
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
            <SettingRow label="Font Size">
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

const PROVIDER_MODELS: Record<string, { value: string; label: string; tier: 'free' | 'paid' }[]> = {
  claude: [
    { value: 'claude-haiku-4-5',    label: 'Claude Haiku 4.5 — fastest',   tier: 'paid' },
    { value: 'claude-sonnet-4-5',   label: 'Claude Sonnet 4.5 — balanced',  tier: 'paid' },
    { value: 'claude-sonnet-4-6',   label: 'Claude Sonnet 4.6 — latest',    tier: 'paid' },
    { value: 'claude-opus-4-5',     label: 'Claude Opus 4.5 — most capable',tier: 'paid' },
  ],
  gemini: [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview — latest ✨', tier: 'free' },
    { value: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash',                   tier: 'free' },
    { value: 'gemini-2.0-flash-exp',   label: 'Gemini 2.0 Flash Exp — experimental',tier: 'free' },
    { value: 'gemini-1.5-flash',       label: 'Gemini 1.5 Flash',                   tier: 'free' },
    { value: 'gemini-1.5-flash-8b',    label: 'Gemini 1.5 Flash 8B — faster',       tier: 'free' },
    { value: 'gemini-1.5-pro',         label: 'Gemini 1.5 Pro — most capable',      tier: 'free' },
  ],
  openai: [
    { value: 'gpt-4o-mini',   label: 'GPT-4o Mini — cheapest',    tier: 'paid' },
    { value: 'gpt-4o',        label: 'GPT-4o — fast & smart',      tier: 'paid' },
    { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo — most capable', tier: 'paid' },
    { value: 'o1-mini',       label: 'o1-mini — reasoning',         tier: 'paid' },
  ]
}

const PROVIDER_LINKS: Record<string, { label: string; url: string }> = {
  claude: { label: 'Get Claude API key', url: 'https://console.anthropic.com/keys' },
  gemini: { label: 'Get Gemini API key (free)', url: 'https://aistudio.google.com/apikey' },
  openai: { label: 'Get OpenAI API key', url: 'https://platform.openai.com/api-keys' },
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
            <button
              onClick={() => window.open(link.url, '_blank')}
              className="text-xs text-left transition-colors"
              style={{ color: 'var(--accent-blue)', fontSize: 10 }}>
              🔑 {link.label} ↗
            </button>
          )}
        </div>
        <Toggle
          checked={provider.enabled}
          onChange={(v) => onUpdate({ ...provider, enabled: v })}
        />
      </div>

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

      <div className="flex flex-col gap-1.5">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Model</label>
        {models.length > 0 && (
          <select
            value={isCustomModel ? '__custom__' : provider.model}
            onChange={(e) => {
              if (e.target.value !== '__custom__') onUpdate({ ...provider, model: e.target.value })
            }}
            className="px-2 py-1.5 rounded text-xs outline-none w-full"
            style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            {models.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
            {isCustomModel && <option value="__custom__">{provider.model} (custom)</option>}
          </select>
        )}
        {/* Custom model input */}
        <input
          type="text"
          value={provider.model}
          onChange={(e) => onUpdate({ ...provider, model: e.target.value })}
          placeholder="or type a custom model ID..."
          className="px-2 py-1 rounded text-xs outline-none font-mono"
          style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)', border: '1px dashed var(--border)', fontSize: 10 }}
        />
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
