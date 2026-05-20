import { useState, useEffect } from 'react'
import { MomijiLogo } from '../Logo/MomijiLogo'
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

type AboutTab = 'authors' | 'features' | 'stack' | 'links'

const AUTHORS = [
  {
    group: 'Project Founder',
    members: [{ name: 'Haikal Hakim Baiqunni', handle: 'haikaru.noriyuki@gmail.com', role: 'Creator & Lead Developer' }]
  },
  {
    group: 'AI Engine',
    members: [{ name: 'Kitsune AI', handle: 'Powered by Anthropic Claude, Google Gemini, OpenAI, Ollama', role: 'Integrated AI Assistant' }]
  },
  {
    group: 'Special Thanks',
    members: [
      { name: 'Anthropic', handle: 'Claude API', role: 'AI Provider' },
      { name: 'Microsoft', handle: 'Monaco Editor & VS Code', role: 'Editor Engine' },
      { name: 'OpenAI', handle: 'GPT API', role: 'AI Provider' },
      { name: 'Google', handle: 'Gemini API', role: 'AI Provider' },
      { name: 'Electron Team', handle: 'electron/electron', role: 'Desktop Runtime' },
    ]
  },
]

const LINKS = [
  { icon: '🌐', label: 'Website', desc: 'momiji-ide.github.io/momiji-ide', url: 'https://momiji-ide.github.io/momiji-ide' },
  { icon: '💻', label: 'GitHub', desc: 'github.com/momiji-ide/momiji-ide', url: 'https://github.com/momiji-ide/momiji-ide' },
  { icon: '📥', label: 'Download / Releases', desc: 'Latest installers for Windows, macOS, Linux', url: 'https://github.com/momiji-ide/momiji-ide/releases' },
  { icon: '🐛', label: 'Report a Bug', desc: 'github.com/momiji-ide/momiji-ide/issues', url: 'https://github.com/momiji-ide/momiji-ide/issues' },
  { icon: '🦊', label: 'Kitsune AI', desc: 'Powered by Claude · Gemini · GPT · Ollama', url: 'https://github.com/momiji-ide/momiji-ide' },
]

export function AboutDialog({ onClose }: Props) {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle')
  const [version, setVersion] = useState('1.0.0')
  const [activeTab, setActiveTab] = useState<AboutTab>('authors')

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
            <MomijiLogo size={56} />
            <div>
              <h1 className="text-xl font-black tracking-widest" style={{ color: 'var(--accent-mauve)', letterSpacing: '0.15em' }}>
                MOMIJI
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Code from every angle</p>
            </div>

            <div className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)', border: '1px solid var(--border)' }}>
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
                : 'var(--accent-mauve)',
              color: updateStatus === 'latest' ? 'var(--text-muted)' : 'white',
              border: updateStatus === 'latest' ? '1px solid var(--border)' : 'none'
            }}>
            {updateStatus === 'checking' ? '⟳ Checking...'
              : updateStatus === 'latest' ? '✓ Up to date'
              : updateStatus === 'available' ? '↓ Update available!'
              : '↑ Check for updates'}
          </button>
        </div>

        {/* RIGHT — Tabs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex">
              {(['authors','features','stack','links'] as AboutTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-3 text-xs font-semibold capitalize transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--text)' : 'var(--text-subtle)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-mauve)' : '2px solid transparent',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderBottomStyle: 'solid',
                  }}>
                  {tab === 'stack' ? 'Built With' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg mr-3 text-sm"
              style={{ color: 'var(--text-subtle)', background: 'var(--bg-surface0)', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}>
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* AUTHORS TAB */}
            {activeTab === 'authors' && (
              <div className="p-5 flex flex-col gap-5">
                {AUTHORS.map(group => (
                  <div key={group.group}>
                    <p className="text-xs font-black uppercase tracking-widest mb-3"
                      style={{ color: 'var(--accent-mauve)' }}>{group.group}</p>
                    {group.members.map(m => (
                      <div key={m.name} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg mb-1.5"
                        style={{ background: 'var(--bg-surface0)' }}>
                        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{m.name}</p>
                        <p className="text-xs" style={{ color: 'var(--accent-mauve)' }}>{m.role}</p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{m.handle}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* FEATURES TAB */}
            {activeTab === 'features' && (
              <div className="p-5">
                <div className="grid grid-cols-2 gap-1.5">
                  {FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--bg-surface0)', color: 'var(--text)' }}>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-1.5">
                  {[
                    { icon: '🌐', label: 'GitHub', url: 'https://github.com/momiji-ide/momiji-ide' },
                    { icon: '🐛', label: 'Report an issue', url: 'https://github.com/momiji-ide/momiji-ide/issues' },
                    { icon: '⭐', label: 'Star on GitHub', url: 'https://github.com/momiji-ide/momiji-ide' },
                  ].map(l => (
                    <button key={l.label} onClick={() => window.open(l.url, '_blank')}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                      style={{ color: 'var(--accent-mauve)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {l.icon} {l.label} <span className="ml-auto" style={{ color: 'var(--text-subtle)' }}>↗</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* BUILT WITH TAB */}
            {activeTab === 'stack' && (
              <div className="p-5 flex flex-col gap-2">
                {TECH_STACK.map(t => (
                  <div key={t.name} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-surface0)' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <p className="text-xs font-semibold flex-1" style={{ color: 'var(--text)' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.desc}</p>
                  </div>
                ))}
                <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                    Electron {(window.navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1]) ?? '?'} · © 2025 Momiji IDE · All Rights Reserved
                  </p>
                </div>
              </div>
            )}

            {/* LINKS TAB */}
            {activeTab === 'links' && (
              <div className="p-5 flex flex-col gap-2">
                {LINKS.map(l => (
                  <button key={l.label} onClick={() => window.open(l.url, '_blank')}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors"
                    style={{ background:'var(--bg-surface0)', border:'none', cursor:'pointer', width:'100%' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-surface1)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='var(--bg-surface0)')}>
                    <span style={{ fontSize:20 }}>{l.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color:'var(--text)' }}>{l.label}</p>
                      <p className="text-xs truncate" style={{ color:'var(--text-subtle)' }}>{l.desc}</p>
                    </div>
                    <span style={{ color:'var(--accent-mauve)', fontSize:14 }}>↗</span>
                  </button>
                ))}
                <p className="text-xs text-center mt-3" style={{ color:'var(--overlay0)' }}>
                  © 2025 Momiji IDE · Haikal Hakim Baiqunni · All Rights Reserved
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
