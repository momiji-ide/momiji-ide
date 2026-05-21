import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

const CHECKOUT_URL = 'https://momiji-ide.lemonsqueezy.com/checkout/buy/495febcd-8f43-44cc-9fab-7cd2896874a5'

const TIER_CONFIG = {
  free: {
    label: '🆓 Free',
    color: 'var(--text-subtle)',
    bg:    'var(--bg-surface0)',
    desc:  'Full IDE, BYOK AI, free tier models (Groq, Gemini Flash-Lite)',
  },
  pro: {
    label: '🦊 Pro',
    color: 'var(--accent-mauve)',
    bg:    'rgba(249,115,22,0.08)',
    desc:  'Pro models unlocked: Gemini 2.5 Flash, Claude Haiku, GPT-4o Mini',
  },
  studio: {
    label: '🏆 Studio',
    color: 'var(--accent-yellow)',
    bg:    'rgba(249,226,175,0.08)',
    desc:  'All models unlocked: Claude Sonnet, Gemini 3.5 Flash, GPT-4o',
  },
}

export function LicensePanel() {
  const { licenseTier, licenseKey, licenseExpiry, activateLicense, deactivateLicense } = useAppStore()
  const [inputKey, setInputKey]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [error, setError]         = useState('')

  const cfg = TIER_CONFIG[licenseTier]
  const isPro = licenseTier !== 'free'

  const handleActivate = async () => {
    if (!inputKey.trim()) return
    setLoading(true); setError('')
    const result = await activateLicense(inputKey.trim())
    setLoading(false)
    if (result.ok) {
      toast.success('🦊 License activated! Pro models unlocked.')
      setShowInput(false)
      setInputKey('')
    } else {
      setError(result.error ?? 'Invalid key')
    }
  }

  const handleDeactivate = () => {
    if (!confirm('Deactivate license on this device?')) return
    deactivateLicense()
    toast.info('License deactivated')
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Current tier card */}
      <div className="p-4 rounded-2xl flex flex-col gap-2"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}44` }}>

        <div className="flex items-center gap-2">
          <span className="text-sm font-black" style={{ color: cfg.color }}>{cfg.label}</span>
          {isPro && licenseExpiry && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontSize: 10 }}>
              expires {new Date(licenseExpiry).toLocaleDateString()}
            </span>
          )}
          <div className="flex-1" />
          {isPro && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: cfg.color, color: 'var(--bg-base)' }}>
              ACTIVE
            </span>
          )}
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{cfg.desc}</p>

        {isPro && licenseKey && (
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs font-mono flex-1 truncate"
              style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
              {licenseKey.slice(0, 8)}{'•'.repeat(16)}{licenseKey.slice(-4)}
            </code>
            <button onClick={handleDeactivate}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--accent-red)', border: '1px solid var(--accent-red)44', cursor: 'pointer', background: 'none' }}>
              Deactivate
            </button>
          </div>
        )}
      </div>

      {/* Activate / Upgrade */}
      {!isPro ? (
        <div className="flex flex-col gap-2">

          {/* Upgrade button */}
          <button
            onClick={() => window.open(CHECKOUT_URL, '_blank')}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            🦊 Upgrade to Pro — $12/mo
          </button>

          <button
            onClick={() => window.open(`${CHECKOUT_URL}?checkout[custom][variant]=annual`, '_blank')}
            className="w-full py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-surface0)', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)44', cursor: 'pointer' }}>
            🏅 Annual — $96/yr · save 33% ($8/mo)
          </button>

          {/* Already have a key */}
          {!showInput ? (
            <button onClick={() => setShowInput(true)}
              className="text-xs text-center mt-1"
              style={{ color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Already have a license key? Activate here
            </button>
          ) : (
            <div className="flex flex-col gap-2 p-3 rounded-xl"
              style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Enter License Key</p>
              <input
                value={inputKey}
                onChange={e => { setInputKey(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                className="px-3 py-2 rounded-lg text-xs font-mono outline-none"
                style={{
                  background: 'var(--bg-surface1)', color: 'var(--text)',
                  border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`
                }}
                autoFocus
              />
              {error && <p className="text-xs" style={{ color: 'var(--accent-red)' }}>❌ {error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowInput(false); setInputKey(''); setError('') }}
                  className="flex-1 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleActivate} disabled={loading || !inputKey.trim()}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--accent-mauve)', color: 'white', border: 'none', cursor: 'pointer', opacity: loading || !inputKey.trim() ? 0.6 : 1 }}>
                  {loading ? '⟳ Validating…' : '✓ Activate'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pro/Studio — what's unlocked */
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Unlocked models</p>
          {[
            licenseTier === 'pro' && '🟠 Gemini 2.5 Flash',
            licenseTier === 'pro' && '🟣 Claude Haiku 4.5',
            licenseTier === 'pro' && '🟢 GPT-4o Mini',
            licenseTier === 'studio' && '🟣 Claude Sonnet 4.5',
            licenseTier === 'studio' && '🟠 Gemini 3.5 Flash',
            licenseTier === 'studio' && '🟢 GPT-4o',
          ].filter(Boolean).map(m => (
            <div key={m as string} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-surface0)' }}>
              <span style={{ color: cfg.color, fontSize: 10 }}>✓</span>
              <span className="text-xs" style={{ color: 'var(--text)' }}>{m}</span>
            </div>
          ))}
          {licenseTier === 'pro' && (
            <button onClick={() => window.open(CHECKOUT_URL, '_blank')}
              className="text-xs mt-1 text-center"
              style={{ color: 'var(--accent-yellow)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Upgrade to Studio for Claude Sonnet + GPT-4o →
            </button>
          )}
        </div>
      )}

      {/* BYOK note */}
      <p className="text-xs text-center" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
        🔐 Keys stored locally · Never sent to Momiji servers · Cancel anytime
      </p>
    </div>
  )
}
