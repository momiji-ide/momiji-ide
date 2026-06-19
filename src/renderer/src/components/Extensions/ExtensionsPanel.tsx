import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

type ExtCategory = 'all' | 'themes' | 'languages' | 'tools' | 'installed'

interface Extension {
  id: string
  name: string
  desc: string
  author: string
  icon: string
  category: 'themes' | 'languages' | 'tools'
  version: string
  installs: string
  action?: 'theme' | 'setting' | 'external'
  themeValue?: string
  settingKey?: string
  settingValue?: unknown
  installUrl?: string
  requiresTool?: string
}

const EXTENSIONS: Extension[] = [
  // ── Themes ────────────────────────────────────────────────────────
  {
    id: 'theme-dracula', name: 'Dracula Theme', desc: 'The famous dark theme with purple accents',
    author: 'Dracula', icon: '🧛', category: 'themes', version: '3.1.0', installs: '12M',
    action: 'theme', themeValue: 'dracula'
  },
  {
    id: 'theme-monokai', name: 'Monokai Pro', desc: 'Classic Sublime Text dark theme',
    author: 'Wimer Hazenberg', icon: '🎨', category: 'themes', version: '1.3.2', installs: '8M',
    action: 'theme', themeValue: 'monokai'
  },
  {
    id: 'theme-tokyonight', name: 'Tokyo Night', desc: 'Calm dark theme inspired by Tokyo neon lights',
    author: 'enkia', icon: '🌃', category: 'themes', version: '1.0.7', installs: '6M',
    action: 'theme', themeValue: 'tokyonight'
  },
  {
    id: 'theme-github', name: 'GitHub Dark', desc: 'GitHub\'s official dark theme',
    author: 'GitHub', icon: '🐙', category: 'themes', version: '2.5.0', installs: '5M',
    action: 'theme', themeValue: 'github-dark'
  },
  {
    id: 'theme-nord', name: 'Nord', desc: 'Arctic, north-bluish clean theme',
    author: 'arcticicestudio', icon: '❄️', category: 'themes', version: '1.0.0', installs: '4M',
    action: 'theme', themeValue: 'nord'
  },
  {
    id: 'theme-solarized', name: 'Solarized Dark', desc: 'Precision colors for machines and people',
    author: 'Ethan Schoonover', icon: '☀️', category: 'themes', version: '2.0.0', installs: '3M',
    action: 'theme', themeValue: 'solarized'
  },
  {
    id: 'theme-onedark', name: 'One Dark Pro', desc: 'Atom\'s iconic One Dark theme',
    author: 'binaryify', icon: '⚫', category: 'themes', version: '3.3.14', installs: '10M',
    action: 'theme', themeValue: 'onedark'
  },
  // ── Language runners ───────────────────────────────────────────────
  {
    id: 'lang-csharp', name: 'C# / .NET Runner', desc: 'Run C# files with dotnet-script or Mono',
    author: 'Momiji', icon: '🟣', category: 'languages', version: '1.0.0', installs: 'built-in',
    action: 'external', requiresTool: 'dotnet-script',
    installUrl: 'dotnet tool install -g dotnet-script'
  },
  {
    id: 'lang-cpp', name: 'C / C++ Runner', desc: 'Compile and run C/C++ with GCC/G++',
    author: 'Momiji', icon: '🔵', category: 'languages', version: '1.0.0', installs: 'built-in',
    action: 'external', requiresTool: 'gcc/g++',
    installUrl: 'winget install GnuWin32.GCC  (or install MinGW)'
  },
  {
    id: 'lang-kotlin', name: 'Kotlin Runner', desc: 'Compile and run Kotlin via kotlinc',
    author: 'Momiji', icon: '🟣', category: 'languages', version: '1.0.0', installs: 'built-in',
    action: 'external', requiresTool: 'kotlinc',
    installUrl: 'https://kotlinlang.org/docs/command-line.html'
  },
  {
    id: 'lang-dart', name: 'Dart / Flutter Runner', desc: 'Run Dart files with the Dart SDK',
    author: 'Momiji', icon: '🎯', category: 'languages', version: '1.0.0', installs: 'built-in',
    action: 'external', requiresTool: 'dart',
    installUrl: 'https://dart.dev/get-dart'
  },
  {
    id: 'lang-lua', name: 'Lua Runner', desc: 'Run Lua scripts with lua interpreter',
    author: 'Momiji', icon: '🌙', category: 'languages', version: '1.0.0', installs: 'built-in',
    action: 'external', requiresTool: 'lua',
    installUrl: 'winget install lua  (or https://www.lua.org/download.html)'
  },
  // ── Tools ──────────────────────────────────────────────────────────
  {
    id: 'tool-minimap', name: 'Minimap', desc: 'Show code minimap on the right side of editor',
    author: 'Momiji', icon: '🗺️', category: 'tools', version: '1.0.0', installs: 'built-in',
    action: 'setting', settingKey: 'minimap', settingValue: true
  },
  {
    id: 'tool-prettier', name: 'Prettier', desc: 'Opinionated code formatter for JS/TS/CSS/HTML',
    author: 'Prettier', icon: '✨', category: 'tools', version: '3.3.2', installs: 'external',
    action: 'external', requiresTool: 'prettier',
    installUrl: 'npm install -g prettier'
  },
  {
    id: 'tool-eslint', name: 'ESLint', desc: 'Lint JavaScript/TypeScript code',
    author: 'ESLint', icon: '🔍', category: 'tools', version: '9.x', installs: 'external',
    action: 'external', requiresTool: 'eslint',
    installUrl: 'npm install -g eslint'
  },
  {
    id: 'tool-sqlite', name: 'SQLite CLI', desc: 'Required for the SQLite Browser panel',
    author: 'SQLite', icon: '🗄️', category: 'tools', version: '3.46', installs: 'external',
    action: 'external', requiresTool: 'sqlite3',
    installUrl: 'winget install SQLite.SQLite'
  },
]

// Extra Monaco themes definitions
const EXTRA_THEMES: Record<string, { base: 'vs-dark' | 'vs'; rules: any[]; colors: Record<string, string> }> = {
  dracula: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#282a36', 'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a',
      'editor.selectionBackground': '#44475a88',
      'editorLineNumber.foreground': '#6272a4',
      'editorCursor.foreground': '#f8f8f2',
      'editorWidget.background': '#21222c',
    }
  },
  monokai: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'type', foreground: '66d9e8' },
      { token: 'function', foreground: 'a6e22e' },
      { token: 'variable', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#272822', 'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#3e3d32',
      'editor.selectionBackground': '#49483e',
      'editorLineNumber.foreground': '#75715e',
      'editorCursor.foreground': '#f8f8f0',
      'editorWidget.background': '#1e1f1c',
    }
  },
  tokyonight: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'bb9af7' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'type', foreground: '2ac3de' },
      { token: 'function', foreground: '7aa2f7' },
      { token: 'variable', foreground: 'c0caf5' },
    ],
    colors: {
      'editor.background': '#1a1b26', 'editor.foreground': '#c0caf5',
      'editor.lineHighlightBackground': '#292e42',
      'editor.selectionBackground': '#33467c',
      'editorLineNumber.foreground': '#3b4261',
      'editorCursor.foreground': '#c0caf5',
      'editorWidget.background': '#16161e',
    }
  },
  'github-dark': {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'e6edf3' },
    ],
    colors: {
      'editor.background': '#0d1117', 'editor.foreground': '#e6edf3',
      'editor.lineHighlightBackground': '#161b22',
      'editor.selectionBackground': '#264f78',
      'editorLineNumber.foreground': '#484f58',
      'editorCursor.foreground': '#e6edf3',
      'editorWidget.background': '#161b22',
    }
  },
  nord: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'keyword', foreground: '81a1c1' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'function', foreground: '88c0d0' },
      { token: 'variable', foreground: 'd8dee9' },
    ],
    colors: {
      'editor.background': '#2e3440', 'editor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editor.selectionBackground': '#434c5e',
      'editorLineNumber.foreground': '#4c566a',
      'editorCursor.foreground': '#d8dee9',
      'editorWidget.background': '#2e3440',
    }
  },
  solarized: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '586e75', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'type', foreground: '268bd2' },
      { token: 'function', foreground: '268bd2' },
      { token: 'variable', foreground: '839496' },
    ],
    colors: {
      'editor.background': '#002b36', 'editor.foreground': '#839496',
      'editor.lineHighlightBackground': '#073642',
      'editor.selectionBackground': '#073642',
      'editorLineNumber.foreground': '#586e75',
      'editorCursor.foreground': '#839496',
      'editorWidget.background': '#073642',
    }
  },
  onedark: {
    base: 'vs-dark',
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: '56b6c2' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'abb2bf' },
    ],
    colors: {
      'editor.background': '#282c34', 'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313c',
      'editor.selectionBackground': '#3e4451',
      'editorLineNumber.foreground': '#495162',
      'editorCursor.foreground': '#528bff',
      'editorWidget.background': '#21252b',
    }
  }
}

// Expose themes globally so CodeEditor can register them
;(window as any).__momijiExtraThemes = EXTRA_THEMES

export function ExtensionsPanel() {
  const { settings, updateSettings } = useAppStore()
  const [category, setCategory] = useState<ExtCategory>('all')
  const [search, setSearch] = useState('')
  const [installedIds, setInstalledIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('momiji:extensions') ?? '[]')) }
    catch { return new Set() }
  })
  const [activeTheme, setActiveTheme] = useState<string>(() =>
    localStorage.getItem('momiji:active-theme') ?? 'momiji-dark'
  )

  const saveInstalled = (ids: Set<string>) => {
    setInstalledIds(new Set(ids))
    localStorage.setItem('momiji:extensions', JSON.stringify([...ids]))
  }

  const handleInstall = (ext: Extension) => {
    if (ext.action === 'theme' && ext.themeValue) {
      // Apply Monaco theme
      const themeId = `ext-${ext.themeValue}`
      const themeDef = EXTRA_THEMES[ext.themeValue]
      if (themeDef && (window as any).monaco) {
        ;(window as any).monaco.editor.defineTheme(themeId, { ...themeDef, inherit: true })
        ;(window as any).monaco.editor.setTheme(themeId)
      }
      setActiveTheme(themeId)
      localStorage.setItem('momiji:active-theme', themeId)
      const ids = new Set(installedIds)
      ids.add(ext.id)
      saveInstalled(ids)
      toast.success(`${ext.name} theme applied!`)
    } else if (ext.action === 'setting' && ext.settingKey) {
      updateSettings({ [ext.settingKey]: ext.settingValue } as any)
      const ids = new Set(installedIds)
      ids.add(ext.id)
      saveInstalled(ids)
      toast.success(`${ext.name} enabled!`)
    } else if (ext.action === 'external') {
      window.api.clipboard.writeText(ext.installUrl ?? '')
      toast.info(`Install command copied: ${ext.installUrl}`)
    }
  }

  const handleUninstall = (ext: Extension) => {
    if (ext.action === 'theme') {
      // Revert to Catppuccin
      const defaultTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'
      if ((window as any).monaco) (window as any).monaco.editor.setTheme(defaultTheme)
      setActiveTheme(defaultTheme)
      localStorage.setItem('momiji:active-theme', defaultTheme)
    } else if (ext.action === 'setting' && ext.settingKey) {
      updateSettings({ [ext.settingKey]: !ext.settingValue } as any)
    }
    const ids = new Set(installedIds)
    ids.delete(ext.id)
    saveInstalled(ids)
    toast.info(`${ext.name} removed`)
  }

  const filtered = EXTENSIONS.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = e.name.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)
    const matchCat = category === 'all' ? true
      : category === 'installed' ? installedIds.has(e.id)
      : e.category === category
    return matchSearch && matchCat
  })

  const cats: { id: ExtCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'installed', label: `Installed (${installedIds.size})` },
    { id: 'themes', label: 'Themes' },
    { id: 'languages', label: 'Languages' },
    { id: 'tools', label: 'Tools' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          🧩 Extensions
        </span>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search extensions..."
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 px-2 pb-1.5 flex-shrink-0 flex-wrap">
        {cats.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              background: category === c.id ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
              color: category === c.id ? 'white' : 'var(--text-muted)'
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>No extensions found</p>
        )}
        {filtered.map(ext => {
          const installed = installedIds.has(ext.id)
          const isActiveTheme = ext.action === 'theme' && activeTheme === `ext-${ext.themeValue}`
          return (
            <div key={ext.id}
              className="rounded-lg p-2.5 flex flex-col gap-1.5"
              style={{
                background: 'var(--bg-surface0)',
                border: `1px solid ${installed ? 'var(--accent-mauve)44' : 'var(--border)'}`
              }}>
              <div className="flex items-start gap-2">
                <span className="text-xl flex-shrink-0">{ext.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{ext.name}</span>
                    <span className="text-xs px-1 rounded" style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)', fontSize: '9px' }}>
                      v{ext.version}
                    </span>
                    {isActiveTheme && (
                      <span className="text-xs px-1 rounded" style={{ background: 'var(--accent-green)', color: 'white', fontSize: '9px' }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{ext.desc}</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: '9px' }}>by {ext.author} · {ext.installs} installs</p>
                </div>
              </div>

              {/* Install command for external tools */}
              {ext.action === 'external' && ext.installUrl && (
                <div className="flex items-center gap-1 px-1.5 py-1 rounded"
                  style={{ background: 'var(--bg-crust)', border: '1px solid var(--border)' }}>
                  <code className="text-xs flex-1 truncate" style={{ color: 'var(--accent-yellow)', fontFamily: 'monospace', fontSize: '9px' }}>
                    {ext.installUrl}
                  </code>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs px-1.5 py-0.5 rounded capitalize"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)', fontSize: '9px' }}>
                  {ext.category}
                  {ext.requiresTool && ` · requires ${ext.requiresTool}`}
                </span>
                <div className="flex gap-1">
                  {installed && (
                    <button onClick={() => handleUninstall(ext)}
                      className="text-xs px-2 py-0.5 rounded transition-all"
                      style={{ color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-red)'; e.currentTarget.style.color = 'white' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-red)' }}>
                      {ext.action === 'theme' ? 'Remove theme' : 'Disable'}
                    </button>
                  )}
                  <button onClick={() => handleInstall(ext)}
                    className="text-xs px-2 py-0.5 rounded transition-all font-medium"
                    style={{
                      background: ext.action === 'external' ? 'var(--accent-yellow)' : installed ? 'var(--bg-surface1)' : 'var(--accent-mauve)',
                      color: ext.action === 'external' ? 'var(--bg-base)' : installed ? 'var(--text-muted)' : 'white'
                    }}>
                    {ext.action === 'external' ? '📋 Copy cmd'
                      : installed ? (isActiveTheme ? '✓ Applied' : '✓ Enabled')
                      : ext.action === 'theme' ? 'Apply' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
