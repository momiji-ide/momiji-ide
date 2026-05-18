/**
 * NpmScriptsPanel — Run package.json scripts with 1 click
 * Shows all scripts, click to run in terminal, live output inline
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'

interface Script { name: string; cmd: string }
interface RunState { running: boolean; output: string[]; code?: number }

export function NpmScriptsPanel() {
  const { currentFolder } = useAppStore()
  const [scripts, setScripts]   = useState<Script[]>([])
  const [pkgName, setPkgName]   = useState('')
  const [states,  setStates]    = useState<Record<string, RunState>>({})
  const [active,  setActive]    = useState<string | null>(null)
  const [noJson,  setNoJson]    = useState(false)
  const outputEndRef = useRef<HTMLDivElement>(null)

  // ── Load package.json ────────────────────────────────────────────────────
  const loadPkg = useCallback(async () => {
    if (!currentFolder) return
    const r = await window.api.fs.readFile(`${currentFolder}/package.json`)
    if (!r.content) { setNoJson(true); setScripts([]); return }
    setNoJson(false)
    try {
      const json = JSON.parse(r.content)
      setPkgName(json.name ?? '')
      const list: Script[] = Object.entries(json.scripts ?? {}).map(([name, cmd]) => ({
        name, cmd: cmd as string
      }))
      setScripts(list)
    } catch { setNoJson(true) }
  }, [currentFolder])

  useEffect(() => { loadPkg() }, [loadPkg])

  // ── Listen for process output ────────────────────────────────────────────
  useEffect(() => {
    const offOut = window.api.process.onStdout((id, data) => {
      setStates(prev => {
        if (!prev[id]) return prev
        const lines = [...(prev[id].output), ...data.split('\n').filter(Boolean)]
        return { ...prev, [id]: { ...prev[id], output: lines.slice(-200) } }
      })
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    const offErr = window.api.process.onStderr((id, data) => {
      setStates(prev => {
        if (!prev[id]) return prev
        const lines = [...(prev[id].output), ...data.split('\n').filter(Boolean).map(l => `\x1b[31m${l}\x1b[0m`)]
        return { ...prev, [id]: { ...prev[id], output: lines.slice(-200) } }
      })
    })
    const offExit = window.api.process.onExit((id, code) => {
      setStates(prev => {
        if (!prev[id]) return prev
        return { ...prev, [id]: { ...prev[id], running: false, code,
          output: [...prev[id].output, `\n[Process exited with code ${code}]`]
        }}
      })
    })
    return () => { offOut(); offErr(); offExit() }
  }, [])

  // ── Run script ───────────────────────────────────────────────────────────
  const runScript = async (s: Script) => {
    if (!currentFolder) return
    const id = `npm-${s.name}-${Date.now()}`
    setActive(s.name)
    setStates(prev => ({ ...prev, [s.name]: { running: true, output: [`> ${s.cmd}\n`] } }))

    // Detect platform-appropriate runner
    const isWin = navigator.userAgent.includes('Windows')
    const shell = isWin ? 'cmd' : 'sh'
    const args  = isWin ? ['/c', s.cmd] : ['-c', s.cmd]

    await window.api.process.run(id, shell, args, currentFolder)
    // store id for kill
    setStates(prev => ({ ...prev, [s.name]: { ...prev[s.name], _id: id } as any }))
  }

  const killScript = async (name: string) => {
    const id = (states[name] as any)?._id
    if (id) await window.api.process.kill(id)
    setStates(prev => ({ ...prev, [name]: { ...prev[name], running: false } }))
  }

  const COLORS: Record<string, string> = {
    dev: 'var(--accent-green)', start: 'var(--accent-green)',
    build: 'var(--accent-blue)', test: 'var(--accent-yellow)',
    lint: 'var(--accent-peach)', preview: 'var(--accent-teal)',
    clean: 'var(--accent-red)', deploy: 'var(--accent-mauve)',
  }
  const getColor = (name: string) => {
    for (const [k, c] of Object.entries(COLORS)) if (name.includes(k)) return c
    return 'var(--accent-blue)'
  }

  if (!currentFolder) return (
    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
      <span style={{ fontSize: 28 }}>📦</span>
      <p className="text-xs">Open a project folder first</p>
    </div>
  )

  if (noJson) return (
    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
      <span style={{ fontSize: 28 }}>📄</span>
      <p className="text-xs">No package.json found in project</p>
      <button onClick={loadPkg} style={{ fontSize: 11, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Refresh</button>
    </div>
  )

  const activeState = active ? states[active] : null

  return (
    <div className="flex h-full" style={{ fontSize: 12 }}>

      {/* ── Script list ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ width: 180, borderRight: '1px solid var(--border)', background: 'var(--bg-crust)' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14 }}>📦</span>
          <span className="text-xs font-bold truncate" style={{ color: 'var(--text-muted)' }}>{pkgName || 'Scripts'}</span>
          <button onClick={loadPkg} title="Refresh" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 13 }}>⟳</button>
        </div>

        {scripts.length === 0
          ? <p className="text-xs px-3 py-4" style={{ color: 'var(--text-subtle)' }}>No scripts defined</p>
          : scripts.map(s => {
            const st = states[s.name]
            const isRunning = st?.running
            const color = getColor(s.name)
            return (
              <button key={s.name}
                onClick={() => { setActive(s.name); if (!isRunning) runScript(s) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', textAlign: 'left', cursor: 'pointer',
                  background: active === s.name ? 'var(--bg-surface0)' : 'transparent',
                  border: 'none', borderLeft: active === s.name ? `2px solid ${color}` : '2px solid transparent',
                  width: '100%',
                }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: isRunning ? 'var(--accent-green)' : st?.code === 0 ? 'var(--accent-blue)' : st?.code != null ? 'var(--accent-red)' : color,
                  animation: isRunning ? 'pulse 1s infinite' : 'none'
                }} />
                <span className="flex-1 truncate text-xs font-semibold" style={{ color: active === s.name ? color : 'var(--text-muted)' }}>{s.name}</span>
                {isRunning && (
                  <span onClick={e => { e.stopPropagation(); killScript(s.name) }}
                    title="Stop" style={{ color: 'var(--accent-red)', fontSize: 12, flexShrink: 0, cursor: 'pointer' }}>■</span>
                )}
              </button>
            )
          })
        }
      </div>

      {/* ── Output area ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {active && scripts.find(s => s.name === active) ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                $ {scripts.find(s => s.name === active)?.cmd}
              </span>
              {activeState?.running && (
                <span className="animate-pulse text-xs" style={{ color: 'var(--accent-green)', marginLeft: 'auto' }}>● running</span>
              )}
              {!activeState?.running && activeState?.code != null && (
                <span className="text-xs" style={{ color: activeState.code === 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginLeft: 'auto' }}>
                  Exit {activeState.code}
                </span>
              )}
              {!activeState?.running && (
                <button onClick={() => runScript(scripts.find(s => s.name === active)!)}
                  style={{ marginLeft: activeState?.code == null ? 'auto' : 4, background: 'var(--accent-green)', color: 'var(--bg-base)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  ▶ Run
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ fontFamily: 'monospace', fontSize: 11, background: '#1e1e2e' }}>
              {(activeState?.output ?? []).map((line, i) => (
                <div key={i} style={{ lineHeight: 1.6, color: line.includes('\x1b[31m') ? '#f38ba8' : '#cdd6f4', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {line.replace(/\x1b\[\d+m/g, '')}
                </div>
              ))}
              <div ref={outputEndRef} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
            <span style={{ fontSize: 28 }}>▶</span>
            <p className="text-xs">Select a script to run</p>
          </div>
        )}
      </div>
    </div>
  )
}
