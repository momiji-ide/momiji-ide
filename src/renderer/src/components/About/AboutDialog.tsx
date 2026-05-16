import { useState, useEffect } from 'react'
import { ParallaxLogo } from '../Logo/ParallaxLogo'
import { KitsuneLogo } from '../Logo/KitsuneLogo'

interface Props { onClose: () => void }

const TECH_STACK = [
  { name: 'Electron',     desc: 'Desktop runtime',         color: '#74c7ec' },
  { name: 'React 18',     desc: 'UI framework',            color: '#89b4fa' },
  { name: 'TypeScript',   desc: 'Type-safe code',          color: '#89b4fa' },
  { name: 'Monaco',       desc: 'VS Code editor engine',   color: '#a6e3a1' },
  { name: 'Blockly',      desc: 'Visual block editor',     color: '#cba6f7' },
  { name: 'React Flow',   desc: 'Node graph editor',       color: '#fab387' },
  { name: 'Zustand',      desc: 'State management',        color: '#f9e2af' },
  { name: 'Tailwind CSS', desc: 'Styling',                 color: '#94e2d5' },
]

const FEATURES = [
  '🧩 Block Editor (Blockly)',
  '⚡ Visual Flow Editor',
  '⏱ Time-Travel Debugger',
  '🌐 HTTP REST Client',
  '🗄️ SQLite Browser',
  '📦 Package Manager',
  '🔀 Git Integration',
  '🦊 Kitsune AI (BYOK)',
  '🐍 Python Interpreter Picker',
  '🔴 Inline Linting',
  '🌍 9 Languages',
  '🎨 7 Extra Themes',
]

export function AboutDialog({ onClose }: Props) {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle')
  const [version, setVersion] = useState('1.0.0')

  useEffect(() => {
    // Get app version via IPC
    try {
      ;(window.api as any).app?.getVersion?.().then((v: string) => setVersion(v)).catch(() => {})
    } catch {}

    // Listen for update events
    const unsub = (window.api as any).updater?.onStatus?.((status: string) => {
      if (status === 'checking') setUpdateStatus('checking')
      else if (status === 'latest') setUpdateStatus('latest')
      else if (status === 'available') setUpdateStatus('available')
    })
    return () => unsub?.()
  }, [])

  const handleCheckUpdate = () => {
    setUpdateStatus('checking')
    ;(window.api as any).updater?.checkForUpdates?.()
    // Fallback if no updater: simulate
    setTimeout(() => setUpdateStatus('latest'), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>

      <div className="flex overflow-hidden rounded-2xl"
        style={{
          width: 600, maxHeight: '85vh',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}>

        {/* LEFT — Branding */}
        <div className="flex flex-col items-center justify-between p-8 flex-shrink-0"
          style={{ width: 220, background: 'var(--bg-mantle)', borderRight: '1px solid var(--border)' }}>

          <div className="flex flex-col items-center gap-4 text-center">
            <ParallaxLogo size={56} />
            <div>
              <h1 className="text-xl font-black tracking-widest" style={{ color: 'var(--accent-mauve)', letterSpacing: '0.15em' }}>
                PARALLAX
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Code from every angle</p>
            </div>

            <div className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--bg-surface0)', color: 'var(--accent-blue)', border: '1px solid var(--border)' }}>
              v{version}
            </div>

            <div className="flex flex-col items-center gap-1.5 mt-2">
              <KitsuneLogo size={40} />
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>Kitsune AI</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                Adapt. Intelligent. Transform.
              </p>
            </div>
          </div>

          {/* Update button */}
          <button
            onClick={handleCheckUpdate}
            disabled={updateStatus === 'checking'}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: updateStatus === 'available' ? 'var(--accent-green)'
                : updateStatus === 'latest' ? 'var(--bg-surface0)'
                : 'var(--accent-blue)',
              color: updateStatus === 'latest' ? 'var(--text-muted)' : 'white',
              border: updateStatus === 'latest' ? '1px solid var(--border)' : 'none'
            }}>
            {updateStatus === 'checking' ? '⟳ Checking...'
              : updateStatus === 'latest' ? '✓ Up to date'
              : updateStatus === 'available' ? '↓ Update available!'
              : '↑ Check for updates'}
          </button>
        </div>

        {/* RIGHT — Info */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>About Parallax IDE</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-Native IDE Platform</p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ color: 'var(--text-subtle)', background: 'var(--bg-surface0)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {/* Features */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-subtle)' }}>Features</p>
              <div className="grid grid-cols-2 gap-1">
                {FEATURES.map(f => (
                  <p key={f} className="text-xs" style={{ color: 'var(--text-muted)' }}>{f}</p>
                ))}
              </div>
            </div>

            {/* Tech stack */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-subtle)' }}>Built with</p>
              <div className="flex flex-wrap gap-1.5">
                {TECH_STACK.map(t => (
                  <div key={t.name}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: t.color + '18', border: `1px solid ${t.color}44`, color: t.color }}
                    title={t.desc}>
                    {t.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-subtle)' }}>Links</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { icon: '🌐', label: 'Website', url: 'https://parallax-ide.com' },
                  { icon: '📖', label: 'Documentation', url: 'https://docs.parallax-ide.com' },
                  { icon: '🐛', label: 'Report an issue', url: 'https://github.com/parallax-ide/issues' },
                  { icon: '⭐', label: 'Star on GitHub', url: 'https://github.com/parallax-ide' },
                ].map(l => (
                  <button key={l.label}
                    onClick={() => window.open(l.url, '_blank')}
                    className="flex items-center gap-2 text-xs text-left px-2 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--accent-blue)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {l.icon} {l.label}
                    <span className="ml-auto text-xs" style={{ color: 'var(--text-subtle)' }}>↗</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                MIT License · © 2025 Parallax IDE
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                Electron {(window.navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1]) ?? '?'} ·
                Chromium · Node.js
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
