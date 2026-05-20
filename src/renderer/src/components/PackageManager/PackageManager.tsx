import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

type PM = 'npm' | 'pip' | 'cargo' | 'go'
type PMTab = 'packages' | 'scripts'

interface Pkg { name: string; version: string; dev?: boolean }
interface NpmScript { name: string; cmd: string }

const PM_META: Record<PM, { label: string; color: string; installCmd: string[]; removeCmd: string[]; icon: string }> = {
  npm:   { label: 'npm',   color: '#f38ba8', icon: '📦', installCmd: ['npm', 'install'],      removeCmd: ['npm', 'uninstall'] },
  pip:   { label: 'pip',   color: '#89b4fa', icon: '🐍', installCmd: ['pip', 'install'],       removeCmd: ['pip', 'uninstall', '-y'] },
  cargo: { label: 'cargo', color: '#fab387', icon: '🦀', installCmd: ['cargo', 'add'],         removeCmd: ['cargo', 'remove'] },
  go:    { label: 'go',    color: '#94e2d5', icon: '🐹', installCmd: ['go', 'get'],            removeCmd: ['go', 'mod', 'edit', '-droprequire'] }
}

function parseNpm(json: string): Pkg[] {
  try {
    const data = JSON.parse(json)
    const deps = Object.entries(data.dependencies ?? {}).map(([name, version]) => ({ name, version: String(version), dev: false }))
    const devDeps = Object.entries(data.devDependencies ?? {}).map(([name, version]) => ({ name, version: String(version), dev: true }))
    return [...deps, ...devDeps].sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

function parsePip(txt: string): Pkg[] {
  return txt.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^([^=<>!~\s]+)\s*([=<>!~].+)?/)
    return m ? { name: m[1].trim(), version: m[2]?.trim() ?? '*' } : null
  }).filter(Boolean) as Pkg[]
}

function parseCargo(toml: string): Pkg[] {
  const results: Pkg[] = []
  let inDep = false
  for (const line of toml.split('\n')) {
    if (line.startsWith('[dependencies]')) { inDep = true; continue }
    if (line.startsWith('[')) { inDep = false; continue }
    if (!inDep) continue
    const m = line.match(/^(\S+)\s*=\s*"([^"]+)"/)
    if (m) results.push({ name: m[1], version: m[2] })
  }
  return results
}

function parseGo(mod: string): Pkg[] {
  const results: Pkg[] = []
  let inReq = false
  for (const line of mod.split('\n')) {
    if (line.trim() === 'require (') { inReq = true; continue }
    if (inReq && line.trim() === ')') { inReq = false; continue }
    if (inReq || line.startsWith('require ')) {
      const m = (line.trim()).match(/(\S+)\s+(v[\d.]+)/)
      if (m) results.push({ name: m[1], version: m[2] })
    }
  }
  return results
}

export function PackageManager() {
  const { currentFolder } = useAppStore()
  const [pm, setPm] = useState<PM | null>(null)
  const [availablePMs, setAvailablePMs] = useState<PM[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [npmScripts, setNpmScripts] = useState<NpmScript[]>([])
  const [activeScript, setActiveScript] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [installInput, setInstallInput] = useState('')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [filter, setFilter] = useState<'all' | 'prod' | 'dev'>('all')
  const [pmTab, setPmTab] = useState<PMTab>('packages')
  const outputRef = useRef<HTMLPreElement>(null)

  const detect = useCallback(async () => {
    if (!currentFolder) return
    const pms: PM[] = []
    const checks: [PM, string][] = [['npm','package.json'],['pip','requirements.txt'],['cargo','Cargo.toml'],['go','go.mod']]
    for (const [type, file] of checks) {
      const r = await window.api.fs.readFile(`${currentFolder}/${file}`)
      if (r.content !== null) pms.push(type)
    }
    setAvailablePMs(pms)
    if (pms.length > 0) setPm(pms[0])
  }, [currentFolder])

  const loadPackages = useCallback(async () => {
    if (!currentFolder || !pm) return
    const files: Record<PM, string> = { npm: 'package.json', pip: 'requirements.txt', cargo: 'Cargo.toml', go: 'go.mod' }
    const r = await window.api.fs.readFile(`${currentFolder}/${files[pm]}`)
    if (!r.content) { setPackages([]); return }
    const parsers: Record<PM, (s: string) => Pkg[]> = { npm: parseNpm, pip: parsePip, cargo: parseCargo, go: parseGo }
    setPackages(parsers[pm](r.content))
    // Load npm scripts
    if (pm === 'npm') {
      try {
        const data = JSON.parse(r.content)
        const scripts: NpmScript[] = Object.entries(data.scripts ?? {}).map(([name, cmd]) => ({ name, cmd: String(cmd) }))
        setNpmScripts(scripts)
      } catch { setNpmScripts([]) }
    }
  }, [currentFolder, pm])

  useEffect(() => { detect() }, [detect])
  useEffect(() => { loadPackages() }, [loadPackages])

  const runCmd = useCallback(async (cmd: string, args: string[], devFlag?: string) => {
    if (!currentFolder || running) return
    setRunning(true)
    setOutput('')
    const id = `pkg-${Date.now()}`
    const fullArgs = devFlag ? [...args, devFlag] : args

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
        if (code === 0) toast.success('Done!')
        else toast.error(`Exit code ${code}`)
        resolve()
      })
      window.api.process.run(id, cmd, fullArgs, currentFolder)
    })

    setRunning(false)
    loadPackages()
  }, [currentFolder, running, loadPackages])

  const handleRunScript = useCallback(async (scriptName: string) => {
    if (!currentFolder || running) return
    setRunning(true)
    setActiveScript(scriptName)
    setOutput(`▶ npm run ${scriptName}\n`)
    const id = `npm-script-${Date.now()}`
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
        setOutput(o => o + `\n${code === 0 ? '✓ Done' : `✗ Exited with code ${code}`}`)
        if (code === 0) toast.success(`Script "${scriptName}" finished`)
        else toast.error(`Script "${scriptName}" failed (code ${code})`)
        resolve()
      })
      window.api.process.run(id, 'npm', ['run', scriptName], currentFolder)
    })
    setRunning(false)
    setActiveScript(null)
  }, [currentFolder, running])

  const handleStopScript = () => {
    // Kill any running npm process
    toast.info('Stopping script...')
    setRunning(false)
    setActiveScript(null)
  }

  const handleInstall = () => {
    if (!pm || !installInput.trim()) return
    const meta = PM_META[pm]
    const [cmd, ...baseArgs] = meta.installCmd
    runCmd(cmd, [...baseArgs, ...installInput.trim().split(/\s+/)])
    setInstallInput('')
  }

  const handleRemove = (name: string) => {
    if (!pm) return
    const meta = PM_META[pm]
    const [cmd, ...baseArgs] = meta.removeCmd
    runCmd(cmd, [...baseArgs, name])
  }

  const filtered = packages.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || (filter === 'dev' ? p.dev : !p.dev)
    return matchSearch && matchFilter
  })

  if (!currentFolder) {
    return <Empty icon="📁" title="No folder open" desc="Open a project folder to manage packages" />
  }

  if (availablePMs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
        <span className="text-4xl">📦</span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No package file found</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Expected: package.json, requirements.txt, Cargo.toml, or go.mod
        </p>
      </div>
    )
  }

  const meta = pm ? PM_META[pm] : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          📦 Package Manager
        </span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{packages.length} pkgs</span>
      </div>

      {/* Tabs (packages | scripts) — only for npm */}
      {pm === 'npm' && (
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['packages', 'scripts'] as const).map(t => (
            <button key={t} onClick={() => setPmTab(t)}
              className="flex-1 py-1.5 text-xs transition-colors capitalize"
              style={{
                color: pmTab === t ? 'var(--accent-mauve)' : 'var(--text-muted)',
                borderBottom: pmTab === t ? '2px solid var(--accent-mauve)' : '2px solid transparent'
              }}>
              {t === 'scripts' ? `▶ Scripts (${npmScripts.length})` : `📦 Packages (${packages.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Scripts tab */}
      {pm === 'npm' && pmTab === 'scripts' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {npmScripts.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-subtle)' }}>
              No scripts in package.json
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
              {npmScripts.map(s => (
                <div key={s.name}
                  className="rounded-lg px-3 py-2 flex flex-col gap-1"
                  style={{ background: 'var(--bg-surface0)', border: `1px solid ${activeScript === s.name ? 'var(--accent-green)' : 'var(--border)'}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{s.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'monospace', fontSize: 10 }}>{s.cmd}</p>
                    </div>
                    <button
                      onClick={() => activeScript === s.name ? handleStopScript() : handleRunScript(s.name)}
                      disabled={running && activeScript !== s.name}
                      className="flex-shrink-0 px-2.5 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: activeScript === s.name ? 'var(--accent-red)' : (running ? 'var(--bg-surface1)' : 'var(--accent-green)'),
                        color: running && activeScript !== s.name ? 'var(--text-subtle)' : 'var(--bg-base)',
                        cursor: running && activeScript !== s.name ? 'not-allowed' : 'pointer'
                      }}>
                      {activeScript === s.name ? '■ Stop' : '▶ Run'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Output */}
          {output && (
            <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', maxHeight: 140 }}>
              <pre ref={outputRef}
                className="text-xs p-2 overflow-y-auto h-full"
                style={{ color: 'var(--accent-green)', background: 'var(--bg-crust)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 140 }}>
                {output}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Packages tab content — shown when not scripts */}
      {(pm !== 'npm' || pmTab === 'packages') && (
      <>

      {/* PM switcher */}
      {availablePMs.length > 1 && (
        <div className="flex gap-1 px-2 pt-2 flex-shrink-0">
          {availablePMs.map(p => (
            <button key={p} onClick={() => setPm(p)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-all"
              style={{
                background: pm === p ? PM_META[p].color + '22' : 'var(--bg-surface0)',
                color: pm === p ? PM_META[p].color : 'var(--text-muted)',
                border: `1px solid ${pm === p ? PM_META[p].color : 'var(--border)'}`
              }}>
              {PM_META[p].icon} {PM_META[p].label}
            </button>
          ))}
        </div>
      )}

      {/* Install bar */}
      <div className="px-2 pt-2 pb-1 flex gap-1 flex-shrink-0">
        <input
          value={installInput}
          onChange={e => setInstallInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInstall()}
          placeholder={`Install package... (e.g. lodash)`}
          className="flex-1 px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <button onClick={handleInstall} disabled={running || !installInput.trim()}
          className="px-2 py-1 rounded text-xs font-medium transition-all"
          style={{
            background: running || !installInput.trim() ? 'var(--bg-surface0)' : (meta?.color ?? 'var(--accent-mauve)'),
            color: running || !installInput.trim() ? 'var(--text-muted)' : 'white'
          }}>
          {running ? '…' : '+ Add'}
        </button>
      </div>

      {/* Search + filter */}
      <div className="px-2 pb-1 flex gap-1 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter installed..."
          className="flex-1 px-2 py-0.5 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        {pm === 'npm' && (['all','prod','dev'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-1.5 py-0.5 rounded text-xs transition-all capitalize"
            style={{
              background: filter === f ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
              color: filter === f ? 'white' : 'var(--text-muted)'
            }}>{f}</button>
        ))}
      </div>

      {/* Package list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>No packages found</p>
        ) : (
          filtered.map(pkg => (
            <div key={pkg.name}
              className="flex items-center gap-2 py-1.5 px-1 rounded group"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{pkg.name}</span>
                  {pkg.dev && (
                    <span className="text-xs px-1 rounded" style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)', fontSize: '9px' }}>DEV</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>{pkg.version}</span>
              </div>
              <button
                onClick={() => handleRemove(pkg.name)}
                className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded transition-all"
                style={{ color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-red)'; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-red)' }}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Output console */}
      {output && (
        <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', maxHeight: 100 }}>
          <pre ref={outputRef}
            className="text-xs p-2 overflow-y-auto h-full"
            style={{ color: 'var(--accent-green)', background: 'var(--bg-crust)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {output}
          </pre>
        </div>
      )}

      </> /* end packages tab */
      )}
    </div>
  )
}

function Empty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </div>
  )
}
