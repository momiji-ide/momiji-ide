import { useEffect, useState, useRef } from 'react'
import normalImg  from '../../assets/kitsune-normal.png'
import happyImg   from '../../assets/kitsune-happy.png'
import confuseImg from '../../assets/kitsune-confuse.png'

export type KitsuneState = 'idle' | 'error' | 'success' | 'thinking' | 'proactive'

interface StateConfig {
  image:   string
  label:   string
  color:   string
  glow:    string
  spin?:   boolean
}

const STATE_CFG: Record<KitsuneState, StateConfig> = {
  idle:      { image: normalImg,  label: 'Ready to help',        color: '#a6e3a1', glow: 'rgba(166,227,161,0.3)' },
  error:     { image: confuseImg, label: 'Found an issue!',      color: '#f38ba8', glow: 'rgba(243,139,168,0.3)' },
  success:   { image: happyImg,   label: "Let's go! 🎉",         color: '#f9e2af', glow: 'rgba(249,226,175,0.35)' },
  thinking:  { image: confuseImg, label: 'Hmm, thinking…',       color: '#cba6f7', glow: 'rgba(203,166,247,0.3)', spin: true },
  proactive: { image: normalImg,  label: 'I noticed something!', color: '#89dceb', glow: 'rgba(137,220,235,0.3)' },
}

/** Dispatching helper — use from anywhere in the app */
export function setKitsuneState(state: KitsuneState, duration?: number) {
  window.dispatchEvent(new CustomEvent('kitsune:avatar', { detail: { state, duration } }))
}

export function KitsuneAvatarWidget() {
  const [state, setState] = useState<KitsuneState>('idle')
  const [visible, setVisible] = useState(true)
  const [tooltip, setTooltip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen to state change events
  useEffect(() => {
    const onAvatar = (e: Event) => {
      const { state: s, duration } = (e as CustomEvent).detail
      setState(s)
      setVisible(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (duration) {
        timerRef.current = setTimeout(() => setState('idle'), duration)
      }
    }
    window.addEventListener('kitsune:avatar', onAvatar)
    return () => window.removeEventListener('kitsune:avatar', onAvatar)
  }, [])

  // Listen to Monaco error markers
  useEffect(() => {
    const onMarkers = (e: Event) => {
      const markers = (e as CustomEvent).detail as Array<{ severity: number }>
      const hasError = markers.some(m => m.severity === 8) // MarkerSeverity.Error = 8
      if (hasError) {
        setState('error')
        setVisible(true)
      } else if (state === 'error') {
        setState('idle')
      }
    }
    window.addEventListener('editor:markers', onMarkers)
    return () => window.removeEventListener('editor:markers', onMarkers)
  }, [state])

  // Listen to code runner events
  useEffect(() => {
    const onRunStart = () => {
      setState('thinking')
      setVisible(true)
    }
    const onProcessExit = (e: Event) => {
      const { code } = (e as CustomEvent).detail ?? {}
      if (code === 0 || code === null || code === undefined) {
        setState('success')
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setState('idle'), 4000)
      } else {
        setState('error')
      }
    }
    window.addEventListener('runner:start', onRunStart)
    window.addEventListener('runner:exit', onProcessExit)
    return () => {
      window.removeEventListener('runner:start', onRunStart)
      window.removeEventListener('runner:exit', onProcessExit)
    }
  }, [])

  // Listen to Kitsune AI thinking/done
  useEffect(() => {
    const onThink = () => { setState('thinking'); setVisible(true) }
    const onDone  = () => { setState('idle') }
    window.addEventListener('kitsune:thinking', onThink)
    window.addEventListener('kitsune:done', onDone)
    return () => {
      window.removeEventListener('kitsune:thinking', onThink)
      window.removeEventListener('kitsune:done', onDone)
    }
  }, [])

  // Proactive idle hint: if user stays on 'idle' for 10 minutes
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (state === 'idle') {
      idleTimerRef.current = setTimeout(() => {
        setState('proactive')
        setVisible(true)
        // auto-clear proactive after 8s
        timerRef.current = setTimeout(() => setState('idle'), 8000)
      }, 10 * 60 * 1000)
    }
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }
  }, [state])

  const cfg = STATE_CFG[state]

  if (!visible) return null

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
      style={{ padding: '4px 0' }}
    >
      {/* Divider */}
      <div style={{ width: 24, height: 1, background: 'var(--border)', marginBottom: 6 }} />

      {/* Avatar image */}
      <div
        style={{
          position: 'relative',
          width: 36, height: 36,
          borderRadius: '50%',
          background: cfg.glow,
          boxShadow: `0 0 12px ${cfg.glow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.4s ease',
          animation: cfg.spin ? 'kitsuneWiggle 1s ease-in-out infinite alternate' :
                     state === 'success' ? 'kitsuneJump 0.5s ease-in-out 2' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => {
          if (state === 'error') {
            window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'problems' } }))
          } else if (state === 'proactive') {
            window.dispatchEvent(new CustomEvent('kitsune:askWithPrompt', {
              detail: { prompt: 'What do you notice about my code? Any quick tips?' }
            }))
            setState('idle')
          }
        }}
      >
        <img
          src={cfg.image}
          width={28}
          height={28}
          draggable={false}
          style={{ objectFit: 'contain', display: 'block' }}
        />
        {/* State dot */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 8, height: 8, borderRadius: '50%',
          background: cfg.color,
          border: '1.5px solid var(--bg-crust)',
          boxShadow: `0 0 4px ${cfg.color}`,
        }} />
      </div>

      {/* Tooltip on hover */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: 44, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--bg-surface1)',
          border: `1px solid ${cfg.color}55`,
          color: cfg.color,
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          zIndex: 999,
          pointerEvents: 'none',
          boxShadow: `0 4px 16px rgba(0,0,0,0.3)`,
        }}>
          {cfg.label}
          <div style={{
            position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: `5px solid ${cfg.color}55`,
          }} />
        </div>
      )}

      {/* Inline mini label */}
      <span style={{
        fontSize: 8, color: cfg.color, marginTop: 2,
        fontWeight: 700, letterSpacing: '0.03em',
        maxWidth: 40, textAlign: 'center', lineHeight: 1.2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: state === 'idle' ? 'none' : 'block',
      }}>
        {state === 'error' ? 'ERROR' : state === 'success' ? 'NICE!' : state === 'thinking' ? '...' : state === 'proactive' ? 'PSST' : ''}
      </span>

      {/* CSS animations */}
      <style>{`
        @keyframes kitsuneWiggle {
          0%   { transform: rotate(-6deg) scale(1.0); }
          100% { transform: rotate(6deg)  scale(1.05); }
        }
        @keyframes kitsuneJump {
          0%   { transform: translateY(0)   scale(1); }
          50%  { transform: translateY(-6px) scale(1.1); }
          100% { transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )
}
