import { useState, useRef, useEffect } from 'react'

interface Props {
  isFolder: boolean
  currentFolder: string | null
  onClose: () => void
  onCreate: (fullPath: string, isFolder: boolean) => void
}

const FILE_TEMPLATES: Record<string, string> = {
  '.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>

</body>
</html>`,
  '.js': `// JavaScript file
`,
  '.ts': `// TypeScript file
`,
  '.py': `# Python file
`,
  '.css': `/* CSS file */
`,
  '.json': `{
}`,
  '.md': `# Title

`,
}

export function NewFileDialog({ isFolder, currentFolder, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState(currentFolder ?? '')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const getExt = (n: string) => {
    const parts = n.split('.')
    return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
  }

  const getPreview = () => {
    if (!name.trim()) return ''
    const ext = getExt(name)
    return FILE_TEMPLATES[ext] ?? ''
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name cannot be empty'); return }
    if (trimmed.match(/[<>:"/\\|?*]/)) { setError('Name contains invalid characters'); return }

    const base = location || currentFolder || ''
    const fullPath = base + '\\' + trimmed
    onCreate(fullPath, isFolder)
  }

  const quickFiles = [
    { name: 'index.html',   icon: '🌐' },
    { name: 'index.js',     icon: '🟨' },
    { name: 'main.py',      icon: '🐍' },
    { name: 'style.css',    icon: '🎨' },
    { name: 'index.ts',     icon: '🔷' },
    { name: 'README.md',    icon: '📝' },
    { name: 'data.json',    icon: '📋' },
    { name: 'script.sh',    icon: '⚡' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}>

        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface0)',
            border: '1px solid var(--border)',
            width: '440px',
            animation: 'scaleIn 0.15s ease-out'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{isFolder ? '📁' : '📄'}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {isFolder ? 'New Folder' : 'New File'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {location ? location.split(/[\\/]/).slice(-2).join('/') : 'Choose a folder first'}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              ✕
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Name input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {isFolder ? 'Folder Name' : 'File Name'}
              </label>
              <input
                ref={inputRef}
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder={isFolder ? 'my-folder' : 'index.js'}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--bg-base)',
                  color: 'var(--text)',
                  border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`
                }}
              />
              {error && <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>}
            </div>

            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Location
              </label>
              <div className="flex gap-2">
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Path to parent folder"
                  className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={async () => {
                    const folder = await window.api.dialog.openFolder()
                    if (folder) setLocation(folder)
                  }}
                  className="px-3 py-2 rounded-lg text-xs flex-shrink-0"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--text)' }}>
                  Browse…
                </button>
              </div>
            </div>

            {/* Quick file templates */}
            {!isFolder && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Quick Files
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickFiles.map(f => (
                    <button key={f.name} onClick={() => setName(f.name)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors"
                      style={{
                        background: name === f.name ? 'var(--accent-blue)' : 'var(--bg-surface1)',
                        color: name === f.name ? 'var(--bg-base)' : 'var(--text)'
                      }}>
                      <span>{f.icon}</span>
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {!isFolder && getPreview() && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-3 py-1 text-xs" style={{ background: 'var(--bg-mantle)', color: 'var(--text-subtle)' }}>
                  Template preview
                </div>
                <pre className="px-3 py-2 text-xs overflow-auto"
                  style={{ background: 'var(--bg-crust)', color: 'var(--accent-green)', fontFamily: 'monospace', maxHeight: 80 }}>
                  {getPreview().slice(0, 200)}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--bg-surface1)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !location}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: name.trim() && location ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                  color: name.trim() && location ? 'var(--bg-base)' : 'var(--text-muted)'
                }}>
                {isFolder ? 'Create Folder' : 'Create File'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
