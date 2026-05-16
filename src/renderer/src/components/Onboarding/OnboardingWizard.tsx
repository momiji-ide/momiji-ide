import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import { ParallaxLogo } from '../Logo/ParallaxLogo'
import { toast } from '../../utils/toast'
import { getT, getLang, setLang, LANGUAGES, type Language } from '../../utils/i18n'

type Step = 'welcome' | 'goal' | 'ai-setup' | 'ai-free' | 'ai-byok' | 'ai-local' | 'ready'
type Goal = 'learn' | 'website' | 'automate' | 'data' | 'pro'

interface Props { onComplete: () => void }

export function OnboardingWizard({ onComplete }: Props) {
  const { updateAIProvider, setActivePanel } = useAppStore()
  const [lang, setLangState] = useState<Language>(getLang())
  const t = getT(lang)

  const [step, setStep] = useState<Step>('welcome')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [geminiKey, setGeminiKey] = useState('')
  const [byokKey, setByokKey] = useState('')
  const [byokProvider, setByokProvider] = useState<'claude' | 'openai'>('claude')
  const [showKey, setShowKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)

  const handleLangChange = (l: Language) => {
    setLang(l)
    setLangState(l)
  }

  const testGeminiKey = async (key: string) => {
    if (!key.trim()) return
    setTestingKey(true); setKeyValid(null)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say ok.' }] }] }) }
      )
      setKeyValid(res.ok)
    } catch { setKeyValid(false) }
    setTestingKey(false)
  }

  const applyGeminiKey = () => {
    updateAIProvider({ id: 'gemini', name: 'Gemini (Google)', apiKey: geminiKey, model: 'gemini-2.0-flash', enabled: true })
    toast.success('🦊 Kitsune is ready! Gemini Flash active.')
    setStep('ready')
  }

  const applyByokKey = () => {
    if (byokProvider === 'claude') {
      updateAIProvider({ id: 'claude', name: 'Claude (Anthropic)', apiKey: byokKey, model: 'claude-sonnet-4-5', enabled: true })
    } else {
      updateAIProvider({ id: 'openai', name: 'GPT (OpenAI)', apiKey: byokKey, model: 'gpt-4o', enabled: true })
    }
    toast.success('🦊 Kitsune is ready!')
    setStep('ready')
  }

  const handleComplete = () => {
    if (goal === 'learn') setActivePanel('blocks')
    else if (goal === 'website' || goal === 'automate' || goal === 'data') setActivePanel('templates')
    else setActivePanel('explorer')
    onComplete()
  }

  const progress = { welcome: 14, goal: 30, 'ai-setup': 50, 'ai-free': 66, 'ai-byok': 66, 'ai-local': 66, ready: 100 }[step]

  const GOALS = [
    { id: 'learn'    as Goal, icon: '🧩', title: t.onb_goal_learn_title, desc: t.onb_goal_learn_desc },
    { id: 'website'  as Goal, icon: '🌐', title: t.onb_goal_web_title,   desc: t.onb_goal_web_desc },
    { id: 'automate' as Goal, icon: '🤖', title: t.onb_goal_auto_title,  desc: t.onb_goal_auto_desc },
    { id: 'data'     as Goal, icon: '📊', title: t.onb_goal_data_title,  desc: t.onb_goal_data_desc },
    { id: 'pro'      as Goal, icon: '💻', title: t.onb_goal_pro_title,   desc: t.onb_goal_pro_desc },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: 520, maxHeight: '90vh', background: 'var(--bg-base)', border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg-surface0)' }}>
          <div style={{ height: '100%', transition: 'width 0.4s ease', background: 'linear-gradient(90deg, #00CFFF, #7C3AED)', width: `${progress}%` }} />
        </div>

        {/* Language switcher */}
        <div className="flex items-center justify-end gap-1 px-4 pt-3 flex-shrink-0">
          <select value={lang} onChange={e => handleLangChange(e.target.value as Language)}
            className="text-xs px-2 py-1 rounded outline-none"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4">

          {/* WELCOME */}
          {step === 'welcome' && (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="flex items-center gap-3">
                <ParallaxLogo size={40} />
                <div className="text-left">
                  <h1 className="text-2xl font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>PARALLAX</h1>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>CODE FROM EVERY ANGLE</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <KitsuneLogo size={80} />
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                    {t.onb_welcome_title} <span style={{ color: 'var(--accent-mauve)' }}>🦊</span>
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                    {t.onb_welcome_sub}
                  </p>
                </div>
              </div>
              <div className="w-full grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                {([['🧩', t.onb_welcome_feat1], ['🤖', t.onb_welcome_feat2], ['💻', t.onb_welcome_feat3]] as [string,string][]).map(([icon, label]) => (
                  <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
                    <span className="text-xl">{icon}</span>
                    <span style={{ whiteSpace: 'pre-line', textAlign: 'center', lineHeight: 1.4 }}>{label}</span>
                  </div>
                ))}
              </div>
              <Btn onClick={() => setStep('goal')} primary>{t.onb_welcome_btn}</Btn>
            </div>
          )}

          {/* GOAL */}
          {step === 'goal' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{t.onb_goal_title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_goal_sub}</p>
              </div>
              <div className="flex flex-col gap-2">
                {GOALS.map(g => (
                  <button key={g.id} onClick={() => setGoal(g.id)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                    style={{ background: goal === g.id ? 'var(--bg-surface1)' : 'var(--bg-surface0)', border: `2px solid ${goal === g.id ? 'var(--accent-blue)' : 'transparent'}` }}>
                    <span className="text-2xl">{g.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{g.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.desc}</p>
                    </div>
                    {goal === g.id && <span style={{ color: 'var(--accent-blue)' }}>✓</span>}
                  </button>
                ))}
              </div>
              <Row>
                <Btn onClick={() => setStep('welcome')}>{t.btn_back}</Btn>
                <Btn onClick={() => setStep('ai-setup')} primary disabled={!goal}>{t.btn_next}</Btn>
              </Row>
            </div>
          )}

          {/* AI SETUP */}
          {step === 'ai-setup' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <KitsuneLogo size={40} />
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{t.onb_ai_title}</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_ai_sub}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <AiOption icon="🆓" title={t.onb_ai_free_title} desc={t.onb_ai_free_desc}
                  badge={t.onb_ai_free_badge} badgeColor="var(--accent-green)" borderColor="var(--accent-green)"
                  onClick={() => setStep('ai-free')} />
                <AiOption icon="🔑" title={t.onb_ai_byok_title} desc={t.onb_ai_byok_desc}
                  onClick={() => setStep('ai-byok')} />
                <AiOption icon="🖥️" title={t.onb_ai_local_title} desc={t.onb_ai_local_desc}
                  onClick={() => setStep('ai-local')} />
                <button onClick={() => setStep('ready')}
                  className="flex items-center gap-3 p-3 rounded-xl text-left"
                  style={{ background: 'transparent', border: '2px solid var(--border)' }}>
                  <span className="text-xl">⏭️</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_ai_skip}</span>
                </button>
              </div>
              <Btn onClick={() => setStep('goal')}>{t.btn_back}</Btn>
            </div>
          )}

          {/* FREE GEMINI */}
          {step === 'ai-free' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{t.onb_free_title} 🆓</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_free_sub}</p>
              </div>
              <div className="flex flex-col gap-4">
                <StepRow n="1" title={t.onb_free_step1}>
                  <button onClick={() => window.open('https://aistudio.google.com/apikey', '_blank')}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: 'var(--accent-blue)', color: 'white' }}>{t.onb_free_step1_btn}</button>
                </StepRow>
                <StepRow n="2" title={t.onb_free_step2} />
                <StepRow n="3" title={t.onb_free_step3}>
                  <div className="flex gap-2 mt-1">
                    <input type={showKey ? 'text' : 'password'} value={geminiKey}
                      onChange={e => { setGeminiKey(e.target.value); setKeyValid(null) }}
                      placeholder="AIza..."
                      className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono"
                      style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: `1px solid ${keyValid === false ? 'var(--accent-red)' : keyValid ? 'var(--accent-green)' : 'var(--border)'}` }} />
                    <button onClick={() => setShowKey(!showKey)} className="px-2 rounded text-xs"
                      style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
                      {showKey ? '🙈' : '👁️'}
                    </button>
                    <button onClick={() => testGeminiKey(geminiKey)} disabled={testingKey || !geminiKey.trim()}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: 'var(--bg-surface1)', color: 'var(--text)' }}>
                      {testingKey ? '…' : t.btn_test}
                    </button>
                  </div>
                </StepRow>
              </div>
              {keyValid === true && <Alert color="var(--accent-green)">{t.onb_free_ok}</Alert>}
              {keyValid === false && <Alert color="var(--accent-red)">{t.onb_free_fail}</Alert>}
              <Row>
                <Btn onClick={() => setStep('ai-setup')}>{t.btn_back}</Btn>
                <Btn onClick={applyGeminiKey} primary disabled={!geminiKey.trim()}>{t.onb_free_activate}</Btn>
              </Row>
            </div>
          )}

          {/* BYOK */}
          {step === 'ai-byok' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{t.onb_byok_title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_byok_sub}</p>
              </div>
              <div className="flex gap-2">
                {(['claude', 'openai'] as const).map(p => (
                  <button key={p} onClick={() => setByokProvider(p)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: byokProvider === p ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: byokProvider === p ? 'white' : 'var(--text-muted)', border: `1px solid ${byokProvider === p ? 'var(--accent-blue)' : 'var(--border)'}` }}>
                    {p === 'claude' ? '🟣 Claude (Anthropic)' : '🟢 GPT (OpenAI)'}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>API Key</label>
                <div className="flex gap-1">
                  <input type={showKey ? 'text' : 'password'} value={byokKey}
                    onChange={e => setByokKey(e.target.value)}
                    placeholder={byokProvider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                    className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono"
                    style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }} />
                  <button onClick={() => setShowKey(!showKey)} className="px-2 rounded text-xs"
                    style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
                    {showKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <a href={byokProvider === 'claude' ? 'https://console.anthropic.com' : 'https://platform.openai.com/api-keys'}
                  target="_blank" rel="noreferrer" className="text-xs" style={{ color: 'var(--accent-blue)' }}>
                  → Get {byokProvider === 'claude' ? 'Anthropic' : 'OpenAI'} API key
                </a>
              </div>
              <Row>
                <Btn onClick={() => setStep('ai-setup')}>{t.btn_back}</Btn>
                <Btn onClick={applyByokKey} primary disabled={!byokKey.trim()}>{t.btn_activate}</Btn>
              </Row>
            </div>
          )}

          {/* LOCAL */}
          {step === 'ai-local' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>{t.onb_local_title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.onb_local_sub}</p>
              </div>
              <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
                {[
                  { n: '1', title: t.onb_local_step1, code: 'https://ollama.ai → Download' },
                  { n: '2', title: t.onb_local_step2, code: 'ollama pull llama3.2\nollama pull qwen2.5-coder' },
                  { n: '3', title: t.onb_local_step3, code: 'ollama serve' },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--accent-mauve)', color: 'white' }}>{s.n}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{s.title}</p>
                      <pre className="text-xs mt-0.5" style={{ color: 'var(--accent-green)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{s.code}</pre>
                    </div>
                  </div>
                ))}
              </div>
              <Alert color="var(--accent-yellow)">{t.onb_local_warn}</Alert>
              <Row>
                <Btn onClick={() => setStep('ai-setup')}>{t.btn_back}</Btn>
                <Btn onClick={() => setStep('ready')} primary>{t.btn_understand}</Btn>
              </Row>
            </div>
          )}

          {/* READY */}
          {step === 'ready' && (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="relative">
                <KitsuneLogo size={90} />
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'var(--accent-green)', boxShadow: '0 0 12px var(--accent-green)' }}>✓</div>
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>{t.onb_ready_title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {goal === 'learn' ? t.onb_ready_learn
                    : goal === 'website' ? t.onb_ready_web
                    : goal === 'automate' ? t.onb_ready_auto
                    : goal === 'data' ? t.onb_ready_data
                    : goal === 'pro' ? t.onb_ready_pro
                    : t.onb_ready_default}
                </p>
              </div>
              <div className="w-full flex flex-col gap-2 text-left p-4 rounded-xl" style={{ background: 'var(--bg-surface0)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t.onb_tips_title}</p>
                {([
                  ['Ctrl+P', t.onb_tips_palette],
                  ['Ctrl+`', t.onb_tips_terminal],
                  ['✨ sidebar', t.onb_tips_ai],
                  ['⫴ toolbar', t.onb_tips_split],
                ] as [string, string][]).map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                      style={{ background: 'var(--bg-surface1)', color: 'var(--text)', border: '1px solid var(--border)' }}>{key}</kbd>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
                  </div>
                ))}
              </div>
              <Btn onClick={handleComplete} primary>{t.onb_ready_btn}</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Btn({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1"
      style={{
        background: disabled ? 'var(--bg-surface0)' : primary ? 'linear-gradient(135deg, #00CFFF, #7C3AED)' : 'var(--bg-surface0)',
        color: disabled ? 'var(--text-subtle)' : primary ? 'white' : 'var(--text)',
        opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        border: primary ? 'none' : '1px solid var(--border)',
      }}>{children}</button>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>
}

function AiOption({ icon, title, desc, badge, badgeColor, borderColor, onClick }: {
  icon: string; title: string; desc: string; badge?: string; badgeColor?: string; borderColor?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all w-full"
      style={{ background: 'var(--bg-surface0)', border: `2px solid ${borderColor ?? 'var(--border)'}` }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold" style={{ color: borderColor ?? 'var(--text)' }}>{title}</p>
          {badge && <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: badgeColor, color: 'var(--bg-base)' }}>{badge}</span>}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      <span style={{ color: 'var(--text-subtle)', alignSelf: 'center' }}>→</span>
    </button>
  )
}

function StepRow({ n, title, children }: { n: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'var(--accent-blue)', color: 'white' }}>{n}</div>
      <div className="flex-1">
        <p className="text-sm" style={{ color: 'var(--text)' }}>{title}</p>
        {children}
      </div>
    </div>
  )
}

function Alert({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
      style={{ background: color + '18', border: `1px solid ${color}55`, color }}>
      {children}
    </div>
  )
}
