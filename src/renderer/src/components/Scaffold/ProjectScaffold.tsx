import { useState, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

interface Template {
  id: string
  name: string
  desc: string
  icon: string
  lang: string
  color: string
  cmd: string
  args: (name: string) => string[]
  note?: string
}

const TEMPLATES: Template[] = [
  {
    id: 'react-vite', name: 'React + Vite', desc: 'Modern React with Vite bundler & TypeScript',
    icon: '⚛️', lang: 'TypeScript', color: '#89b4fa',
    cmd: 'npm', args: (n) => ['create', 'vite@latest', n, '--', '--template', 'react-ts'],
  },
  {
    id: 'nextjs', name: 'Next.js', desc: 'Full-stack React framework with SSR/SSG',
    icon: '▲', lang: 'TypeScript', color: '#cdd6f4',
    cmd: 'npx', args: (n) => ['create-next-app@latest', n, '--typescript', '--eslint', '--tailwind', '--app'],
  },
  {
    id: 'node-express', name: 'Node.js Express', desc: 'REST API server with Express & TypeScript',
    icon: '🟢', lang: 'TypeScript', color: '#a6e3a1',
    cmd: 'npx', args: (n) => ['express-generator', '--no-view', n],
    note: 'Then: cd <name> && npm install'
  },
  {
    id: 'python-flask', name: 'Python Flask', desc: 'Lightweight Python web framework',
    icon: '🐍', lang: 'Python', color: '#fab387',
    cmd: 'pip', args: () => ['install', 'flask'],
    note: 'Creates folder structure manually'
  },
  {
    id: 'python-fastapi', name: 'FastAPI', desc: 'Modern async Python API with auto docs',
    icon: '⚡', lang: 'Python', color: '#f9e2af',
    cmd: 'pip', args: () => ['install', 'fastapi', 'uvicorn'],
    note: 'Creates folder structure manually'
  },
  {
    id: 'electron-vite', name: 'Electron App', desc: 'Desktop app with Electron + Vite + React',
    icon: '🖥️', lang: 'TypeScript', color: '#cba6f7',
    cmd: 'npm', args: (n) => ['create', '@quick-start/electron@latest', n, '--', '--template', 'react-ts'],
  },
  {
    id: 'rust', name: 'Rust Binary', desc: 'New Rust project with Cargo',
    icon: '🦀', lang: 'Rust', color: '#fab387',
    cmd: 'cargo', args: (n) => ['new', n],
  },
  {
    id: 'go-module', name: 'Go Module', desc: 'New Go module with go mod init',
    icon: '🐹', lang: 'Go', color: '#94e2d5',
    cmd: 'go', args: (n) => ['mod', 'init', n],
    note: 'Creates go.mod in current folder'
  },
  {
    id: 'vue-vite', name: 'Vue 3 + Vite', desc: 'Vue 3 with Composition API & TypeScript',
    icon: '💚', lang: 'TypeScript', color: '#a6e3a1',
    cmd: 'npm', args: (n) => ['create', 'vite@latest', n, '--', '--template', 'vue-ts'],
  },
  {
    id: 'svelte', name: 'SvelteKit', desc: 'Full-stack Svelte framework',
    icon: '🔥', lang: 'JavaScript', color: '#fab387',
    cmd: 'npm', args: (n) => ['create', 'svelte@latest', n],
  },
]

export function ProjectScaffold() {
  const { currentFolder } = useAppStore()
  const [selected, setSelected] = useState<Template | null>(null)
  const [projectName, setProjectName] = useState('')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [done, setDone] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  const handleCreate = async () => {
    if (!selected || !projectName.trim() || !currentFolder || running) return
    const name = projectName.trim().replace(/\s+/g, '-').toLowerCase()

    // For Python, create folder structure manually
    if (selected.id === 'python-flask') {
      await createFlask(name)
      return
    }
    if (selected.id === 'python-fastapi') {
      await createFastAPI(name)
      return
    }

    setRunning(true)
    setOutput('')
    setDone(false)
    const id = `scaffold-${Date.now()}`

    await new Promise<void>((resolve) => {
      const offOut = window.api.process.onStdout((pid, data) => {
        if (pid !== id) return
        setOutput(o => o + data)
        setTimeout(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight }, 10)
      })
      const offErr = window.api.process.onStderr((pid, data) => {
        if (pid !== id) return
        setOutput(o => o + data)
      })
      const offExit = window.api.process.onExit((pid, code) => {
        if (pid !== id) return
        offOut(); offErr(); offExit()
        if (code === 0 || code === null) { toast.success(`${name} created!`); setDone(true) }
        else toast.error(`Failed (exit ${code})`)
        resolve()
      })
      window.api.process.run(id, selected.cmd, selected.args(name), currentFolder)
    })
    setRunning(false)
  }

  const createFlask = async (name: string) => {
    if (!currentFolder) return
    setRunning(true); setOutput('Creating Flask project structure...\n')
    const base = `${currentFolder}/${name}`
    await window.api.fs.createFolder(base)
    await window.api.fs.createFolder(`${base}/static`)
    await window.api.fs.createFolder(`${base}/templates`)
    await window.api.fs.writeFile(`${base}/app.py`,
      `from flask import Flask, render_template\n\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n    return render_template('index.html')\n\nif __name__ == '__main__':\n    app.run(debug=True)\n`)
    await window.api.fs.writeFile(`${base}/requirements.txt`, `flask\n`)
    await window.api.fs.writeFile(`${base}/templates/index.html`,
      `<!DOCTYPE html>\n<html>\n<head><title>Flask App</title></head>\n<body><h1>Hello from Flask!</h1></body>\n</html>\n`)
    setOutput(o => o + `✓ ${name}/app.py\n✓ ${name}/templates/index.html\n✓ ${name}/requirements.txt\n\nDone! Run: cd ${name} && pip install flask && python app.py\n`)
    toast.success(`${name} created!`)
    setDone(true); setRunning(false)
  }

  const createFastAPI = async (name: string) => {
    if (!currentFolder) return
    setRunning(true); setOutput('Creating FastAPI project structure...\n')
    const base = `${currentFolder}/${name}`
    await window.api.fs.createFolder(base)
    await window.api.fs.writeFile(`${base}/main.py`,
      `from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"message": "Hello from FastAPI!"}\n\n@app.get("/items/{item_id}")\ndef read_item(item_id: int, q: str | None = None):\n    return {"item_id": item_id, "q": q}\n`)
    await window.api.fs.writeFile(`${base}/requirements.txt`, `fastapi\nuvicorn[standard]\n`)
    setOutput(o => o + `✓ ${name}/main.py\n✓ ${name}/requirements.txt\n\nDone! Run: cd ${name} && pip install -r requirements.txt && uvicorn main:app --reload\n`)
    toast.success(`${name} created!`)
    setDone(true); setRunning(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          🚀 New Project
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {/* Template grid */}
        <p className="text-xs px-1" style={{ color: 'var(--text-subtle)' }}>Choose a template:</p>
        <div className="grid grid-cols-1 gap-1">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setProjectName(''); setOutput(''); setDone(false) }}
              className="flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all"
              style={{
                background: selected?.id === t.id ? t.color + '18' : 'var(--bg-surface0)',
                border: `1px solid ${selected?.id === t.id ? t.color : 'var(--border)'}`,
              }}>
              <span className="text-lg flex-shrink-0">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: selected?.id === t.id ? t.color : 'var(--text)' }}>
                    {t.name}
                  </span>
                  <span className="text-xs px-1 rounded" style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)', fontSize: '9px' }}>
                    {t.lang}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Create form */}
        {selected && (
          <div className="flex flex-col gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-surface0)', border: `1px solid ${selected.color}44` }}>
            <p className="text-xs font-semibold" style={{ color: selected.color }}>
              {selected.icon} {selected.name}
            </p>
            {selected.note && (
              <p className="text-xs" style={{ color: 'var(--accent-yellow)', fontSize: '10px' }}>ℹ️ {selected.note}</p>
            )}
            <div className="flex gap-1">
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="project-name"
                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <button
                onClick={handleCreate}
                disabled={running || !projectName.trim() || !currentFolder}
                className="px-3 py-1 rounded text-xs font-semibold transition-all"
                style={{
                  background: running || !projectName.trim() ? 'var(--bg-surface1)' : selected.color,
                  color: running || !projectName.trim() ? 'var(--text-muted)' : 'white'
                }}>
                {running ? '⏳' : done ? '✓ Done' : 'Create'}
              </button>
            </div>
            {!currentFolder && (
              <p className="text-xs" style={{ color: 'var(--accent-red)' }}>⚠ Open a folder first</p>
            )}
          </div>
        )}

        {/* Output */}
        {output && (
          <pre ref={outputRef}
            className="text-xs p-2 rounded overflow-y-auto"
            style={{
              background: 'var(--bg-crust)', color: done ? 'var(--accent-green)' : 'var(--text)',
              fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 160
            }}>
            {output}
          </pre>
        )}
      </div>
    </div>
  )
}
