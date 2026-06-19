import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, addEdge, useNodesState, useEdgesState,
  Controls, MiniMap, Background, BackgroundVariant,
  type Connection, type Node, type Edge, useReactFlow, ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MonacoEditor from '@monaco-editor/react'
import { NODE_TYPES, NODE_PALETTE, DEFAULT_NODE_DATA } from './FlowNodes'
import { generateCodeFromFlow } from '../../utils/flowCodeGen'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

const INITIAL_NODES: Node[] = [
  { id: 'start-1', type: 'start', position: { x: 200, y: 80 }, data: { type: 'start', label: 'Start' } }
]
const INITIAL_EDGES: Edge[] = []

type RunLine = { id: number; text: string; type: 'out' | 'err' | 'sys' }
type Lang = 'javascript' | 'python'

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { settings, openTab } = useAppStore()

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [lang, setLang] = useState<Lang>('javascript')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [showFlowTemplates, setShowFlowTemplates] = useState(false)

  // ─── Inline run output ────────────────────────────────────────────
  const [rightTab, setRightTab]       = useState<'code'|'output'>('code')
  const [runLines, setRunLines]       = useState<RunLine[]>([])
  const [runStatus, setRunStatus]     = useState<'idle'|'running'|'done'|'error'>('idle')
  const [runElapsed, setRunElapsed]   = useState<number|null>(null)
  const runStartTime = useRef(0)
  const runTimer     = useRef<ReturnType<typeof setInterval>|null>(null)
  const runOutputRef = useRef<HTMLDivElement>(null)
  const runLineId    = useRef(0)

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  // Regenerate code whenever nodes/edges change
  useEffect(() => {
    const generated = generateCodeFromFlow(nodes, edges, lang)
    setCode(generated)
  }, [nodes, edges, lang])

  // Handle node data updates from child components
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { id, patch } = e.detail
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    }
    window.addEventListener('flow:updateNode', handler as EventListener)
    return () => window.removeEventListener('flow:updateNode', handler as EventListener)
  }, [setNodes])

  // ─── Inline run output listeners ─────────────────────────────────
  useEffect(() => {
    const addLine = (text: string, type: RunLine['type']) => {
      text.split('\n').filter(l => l !== '').forEach(t => {
        setRunLines(prev => [...prev, { id: runLineId.current++, text: t, type }])
      })
    }
    const onStart = (e: CustomEvent) => {
      if (e.detail?.processId !== 'runner-main') return
      setRunLines([]); setRunStatus('running'); setRunElapsed(null)
      setRightTab('output')    // auto-switch to output tab
      runStartTime.current = Date.now()
      if (runTimer.current) clearInterval(runTimer.current)
      runTimer.current = setInterval(() => setRunElapsed(Date.now() - runStartTime.current), 200)
    }
    const offOut  = window.api.process.onStdout((id, data) => { if (id === 'runner-main') addLine(data, 'out') })
    const offErr  = window.api.process.onStderr((id, data) => { if (id === 'runner-main') addLine(data, 'err') })
    const offExit = window.api.process.onExit((id, code) => {
      if (id !== 'runner-main') return
      if (runTimer.current) clearInterval(runTimer.current)
      const ms = Date.now() - runStartTime.current
      setRunElapsed(ms); setRunStatus(code === 0 ? 'done' : 'error')
      addLine(code === 0 ? `✓ Done in ${(ms/1000).toFixed(2)}s` : `✗ Exit code ${code} (${(ms/1000).toFixed(2)}s)`, 'sys')
    })
    window.addEventListener('runner:start', onStart as EventListener)
    return () => { window.removeEventListener('runner:start', onStart as EventListener); offOut(); offErr(); offExit() }
  }, [])

  // Auto-scroll run output
  useEffect(() => { runOutputRef.current?.scrollIntoView({ behavior: 'auto' }) }, [runLines])

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      animated: true,
      style: { stroke: '#89b4fa', strokeWidth: 2 }
    }, eds))
  }, [setEdges])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('application/reactflow')
    if (!nodeType) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: { ...DEFAULT_NODE_DATA[nodeType] }
    }
    setNodes(nds => [...nds, newNode])
  }, [screenToFlowPosition, setNodes])

  const handleClear = () => {
    setNodes(INITIAL_NODES)
    setEdges(INITIAL_EDGES)
    toast.info('Flow cleared')
  }

  const handleSave = () => {
    const state = { nodes, edges }
    localStorage.setItem('momiji:flow:workspace', JSON.stringify(state))
    toast.success('Flow saved!')
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('momiji:flow:workspace')
    if (!raw) { toast.warning('No saved flow found'); return }
    try {
      const { nodes: n, edges: e } = JSON.parse(raw)
      setNodes(n); setEdges(e)
      toast.success('Flow loaded!')
    } catch { toast.error('Failed to load flow') }
  }

  const handleOpenInEditor = () => {
    if (!code.trim() || code.startsWith('//') || code.startsWith('#')) {
      toast.warning('Build a flow first!')
      return
    }
    const ext = lang === 'python' ? 'py' : 'js'
    const name = `flow_output.${ext}`
    openTab(`__flow__/${name}`, name, code)
    toast.success(`Opened as ${name}`)
  }

  const loadFlowTemplate = useCallback((tpl: typeof FLOW_TEMPLATES[number]) => {
    setNodes(tpl.nodes as Node[])
    setEdges(tpl.edges as Edge[])
    setShowFlowTemplates(false)
    toast.success(`"${tpl.name}" loaded!`)
  }, [setNodes, setEdges])

  const handleRun = useCallback(async () => {
    if (!code.trim() || code.startsWith('//') || code.startsWith('#')) {
      toast.warning('Build a flow first! Drag nodes and connect them.')
      return
    }
    const { currentFolder, toggleBottomPanel, showBottomPanel } = useAppStore.getState()
    const ext     = lang === 'python' ? 'py' : 'js'
    const fname   = `flow_output.${ext}`
    const command = lang === 'python' ? (settings.pythonPath || 'python') : 'node'
    const tmpPath = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/${fname}`

    try { await window.api.fs.writeFile(tmpPath, code) }
    catch { toast.error('Could not write temp file — open a folder first'); return }

    if (!showBottomPanel) toggleBottomPanel()
    window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'output' } }))

    setIsRunning(true)
    window.dispatchEvent(new CustomEvent('runner:start', {
      detail: { processId: 'runner-main', command, args: [tmpPath], cwd: currentFolder ?? '', label: fname, fileName: fname }
    }))
    await window.api.process.run('runner-main', command, [tmpPath], currentFolder ?? '')

    const unsub = window.api.process.onExit((id, code) => {
      if (id === 'runner-main') {
        setIsRunning(false)
        window.dispatchEvent(new CustomEvent('runner:exit', { detail: { code } }))
        unsub()
      }
    })
  }, [code, lang, settings.pythonPath])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '40px' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>⚡ Visual Flow</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)' }}>
          {nodes.length} nodes · {edges.length} edges
        </span>
        <div className="flex-1" />

        {/* Templates dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowFlowTemplates(s => !s)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
            style={{
              background: showFlowTemplates ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
              color: showFlowTemplates ? 'white' : 'var(--text-muted)',
              border: '1px solid var(--border)'
            }}>
            📋 Templates
          </button>
          {showFlowTemplates && (
            <div className="absolute top-9 right-0 z-30 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--bg-mantle)', border: '1px solid var(--border)', width: 250 }}>
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
                Flow Templates
              </div>
              {FLOW_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => loadFlowTemplate(t)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <select value={lang} onChange={e => setLang(e.target.value as Lang)}
          className="text-xs px-2 py-1 rounded-lg outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <option value="javascript">→ JavaScript</option>
          <option value="python">→ Python</option>
        </select>

        <button onClick={() => setShowCode(s => !s)}
          className="text-xs px-2 py-1 rounded-lg"
          style={{ background: showCode ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: showCode ? 'var(--bg-base)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {showCode ? '📝 Hide Code' : '📝 Show Code'}
        </button>

        {[
          { icon: '💾', title: 'Save flow', fn: handleSave },
          { icon: '📂', title: 'Load flow', fn: handleLoad },
          { icon: '🗑️', title: 'Clear',     fn: handleClear }
        ].map(b => (
          <button key={b.icon} onClick={b.fn} title={b.title}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {b.icon}
          </button>
        ))}

        {/* ▶ Run directly */}
        {isRunning ? (
          <button onClick={() => { window.api.process.kill('runner-main'); setIsRunning(false) }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--accent-red)', color: 'white' }}>
            ■ Stop
          </button>
        ) : (
          <button onClick={handleRun}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}
            title="Run the generated code">
            ▶ Run
          </button>
        )}

        <button onClick={handleOpenInEditor}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Open in Editor →
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <NodePalette />

        {/* Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={NODE_TYPES}
            fitView
            deleteKeyCode="Delete"
            style={{ background: '#1e1e2e' }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#89b4fa', strokeWidth: 2 } }}
          >
            <Controls style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <MiniMap
              style={{ background: 'var(--bg-mantle)', border: '1px solid var(--border)', borderRadius: 8 }}
              nodeColor={() => '#89b4fa'}
              maskColor="rgba(0,0,0,0.5)"
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#313244" />
          </ReactFlow>

          {/* Empty hint — only shows when NO user nodes have been added yet */}
          {nodes.filter(n => n.type !== 'start').length === 0 && edges.length === 0 && (
            <div style={{
              position: 'absolute', bottom: 24, left: 0, right: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', pointerEvents: 'none', gap: 4
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                ← Drag a node from the left panel to get started
              </p>
              <p style={{ color: 'var(--text-subtle)', fontSize: 11 }}>
                Connect nodes together to build your program visually
              </p>
            </div>
          )}
        </div>

        {/* Right: Code + Output */}
        {showCode && (
          <div className="flex flex-col flex-shrink-0" style={{ width: 320, borderLeft: '1px solid var(--border)' }}>
            {/* Tab bar */}
            <div className="flex items-center flex-shrink-0"
              style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '36px' }}>
              {(['code', 'output'] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className="flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors"
                  style={{
                    color: rightTab === tab ? 'var(--text)' : 'var(--text-muted)',
                    borderBottom: rightTab === tab ? '2px solid var(--accent-mauve)' : '2px solid transparent',
                    background: 'transparent'
                  }}>
                  {tab === 'code' ? '📝 Code' : '▶ Output'}
                  {tab === 'output' && runStatus === 'running' && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-0.5" style={{ background: 'var(--accent-yellow)' }} />
                  )}
                  {tab === 'output' && runStatus === 'error' && (
                    <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: 'var(--accent-red)' }} />
                  )}
                  {tab === 'output' && runStatus === 'done' && (
                    <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: 'var(--accent-green)' }} />
                  )}
                </button>
              ))}
              <div className="flex-1" />
              {rightTab === 'code' && (
                <>
                  <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse mr-2"
                    style={{ background: 'var(--accent-green)', color: 'var(--bg-base)', fontSize: 10 }}>● live</span>
                  <button onClick={() => { window.api.clipboard.writeText(code); toast.success('Copied!') }}
                    className="text-xs px-2 py-0.5 rounded mr-2"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    📋
                  </button>
                </>
              )}
              {rightTab === 'output' && runLines.length > 0 && (
                <button onClick={() => { setRunLines([]); setRunStatus('idle') }}
                  className="text-xs px-2 py-0.5 rounded mr-2"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Clear
                </button>
              )}
            </div>

            {/* Code panel */}
            {rightTab === 'code' && (
              <div className="flex-1 overflow-hidden">
                <MonacoEditor
                  language={lang}
                  value={code}
                  theme={monacoTheme}
                  options={{
                    readOnly: true, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                    minimap: { enabled: false }, lineNumbers: 'on', scrollBeyondLastLine: false,
                    wordWrap: 'on', padding: { top: 8 }, scrollbar: { verticalScrollbarSize: 4 }
                  }}
                />
              </div>
            )}

            {/* Output panel */}
            {rightTab === 'output' && (
              <div className="flex-1 overflow-y-auto p-3"
                style={{ background: 'var(--bg-crust)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                {runStatus === 'idle' && runLines.length === 0 && (
                  <p style={{ color: 'var(--text-subtle)', fontSize: 11 }}>
                    Click ▶ Run to execute the flow code.<br/>
                    Output will appear here.
                  </p>
                )}
                {runStatus === 'running' && runLines.length === 0 && (
                  <p className="animate-pulse" style={{ color: 'var(--accent-yellow)', fontSize: 11 }}>
                    ⟳ Running… {runElapsed != null ? `${(runElapsed/1000).toFixed(1)}s` : ''}
                  </p>
                )}
                {runLines.map(l => (
                  <div key={l.id} style={{
                    color: l.type === 'err' ? 'var(--accent-red)' : l.type === 'sys' ? 'var(--text-muted)' : 'var(--text)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.7,
                    fontStyle: l.type === 'sys' ? 'italic' : 'normal'
                  }}>{l.text}</div>
                ))}
                <div ref={runOutputRef} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function NodePalette() {
  const onDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 140, background: 'var(--bg-mantle)', borderRight: '1px solid var(--border)' }}>
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider sticky top-0"
        style={{ color: 'var(--text-subtle)', background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        Nodes
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        {NODE_PALETTE.map(item => (
          <div key={item.type}
            draggable
            onDragStart={e => onDragStart(e, item.type)}
            title={item.desc}
            className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all select-none"
            style={{ background: 'var(--bg-surface0)', border: `1px solid ${item.color}44` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.borderColor = item.color }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.borderColor = `${item.color}44` }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
            <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="px-2 py-2 text-xs" style={{ color: 'var(--text-subtle)', borderTop: '1px solid var(--border)' }}>
        <p>Drag → canvas</p>
        <p className="mt-1">Del = delete</p>
        <p className="mt-1">Scroll = zoom</p>
      </div>
    </div>
  )
}

// ─── Flow Templates ──────────────────────────────────────────────────────────
const E = (id: string, source: string, sh: string, target: string, th: string, stroke = '#89b4fa') => ({
  id, source, sourceHandle: sh, target, targetHandle: th, animated: true,
  style: { stroke, strokeWidth: 2 }
})
const N = (id: string, type: string, x: number, y: number, data: object) => ({
  id, type, position: { x, y }, data: { type, label: type.charAt(0).toUpperCase() + type.slice(1), ...data }
})

const FLOW_TEMPLATES = [
  {
    id: 'player-move', name: 'Player Movement', icon: '🎮',
    desc: 'Variables → input check → update position',
    nodes: [
      N('s1',  'start',     220,  50,  {}),
      N('v1',  'variable',  220, 165,  { varKind:'let',   varName:'playerX', varValue:'0' }),
      N('v2',  'variable',  220, 285,  { varKind:'let',   varName:'playerY', varValue:'0' }),
      N('v3',  'variable',  220, 405,  { varKind:'const', varName:'speed',   varValue:'5' }),
      N('c1',  'condition', 220, 525,  { condition:"key === 'ArrowRight'" }),
      N('m1',  'math',       50, 680,  { mathExpr:'playerX += speed' }),
      N('o1',  'output',     50, 800,  { outputValue:'"Moved right! X: " + playerX' }),
      N('o2',  'output',    420, 680,  { outputValue:'"No input — player idle"' }),
    ],
    edges: [
      E('e1','s1', 'next',  'v1','in'),
      E('e2','v1','next',   'v2','in'),
      E('e3','v2','next',   'v3','in'),
      E('e4','v3','next',   'c1','in'),
      E('e5','c1','true',   'm1','in', '#a6e3a1'),
      E('e6','m1','next',   'o1','in'),
      E('e7','c1','false',  'o2','in', '#f38ba8'),
    ]
  },
  {
    id: 'fizzbuzz', name: 'FizzBuzz', icon: '⚡',
    desc: 'Classic loop + nested conditions',
    nodes: [
      N('s1',  'start',     290,  50,  {}),
      N('lp',  'loop',      290, 165,  { loopVar:'i', loopFrom:'1', loopTo:'15', loopStep:'1' }),
      N('c1',  'condition', 160, 320,  { condition:'i % 3 === 0' }),
      N('c2',  'condition', 390, 320,  { condition:'i % 5 === 0' }),
      N('oF',  'output',     70, 480,  { outputValue:'"Fizz 🟢"' }),
      N('oB',  'output',    300, 480,  { outputValue:'"Buzz 🔵"' }),
      N('oN',  'output',    510, 480,  { outputValue:'i + ""' }),
    ],
    edges: [
      E('e1','s1', 'next', 'lp', 'in'),
      E('e2','lp', 'body', 'c1', 'in', '#94e2d5'),
      E('e3','c1', 'true', 'oF', 'in', '#a6e3a1'),
      E('e4','c1', 'false','c2', 'in', '#f38ba8'),
      E('e5','c2', 'true', 'oB', 'in', '#a6e3a1'),
      E('e6','c2', 'false','oN', 'in', '#f38ba8'),
    ]
  },
  {
    id: 'grade-calc', name: 'Grade Calculator', icon: '📊',
    desc: 'Multi-branch condition chain',
    nodes: [
      N('s1',  'start',     270,  50,  {}),
      N('v1',  'variable',  270, 165,  { varKind:'let', varName:'score', varValue:'85' }),
      N('c1',  'condition', 270, 295,  { condition:'score >= 90' }),
      N('oA',  'output',     80, 445,  { outputValue:'"A — Excellent! 🌟"' }),
      N('c2',  'condition', 460, 445,  { condition:'score >= 70' }),
      N('oB',  'output',    370, 600,  { outputValue:'"B/C — Good job! 👍"' }),
      N('oF',  'output',    580, 600,  { outputValue:'"F — Study more 📚"' }),
    ],
    edges: [
      E('e1','s1','next',  'v1','in'),
      E('e2','v1','next',  'c1','in'),
      E('e3','c1','true',  'oA','in', '#a6e3a1'),
      E('e4','c1','false', 'c2','in', '#f38ba8'),
      E('e5','c2','true',  'oB','in', '#a6e3a1'),
      E('e6','c2','false', 'oF','in', '#f38ba8'),
    ]
  },
  {
    id: 'fibonacci', name: 'Fibonacci Sequence', icon: '🔢',
    desc: 'Loop accumulates the sequence',
    nodes: [
      N('s1',  'start',    250,  50,  {}),
      N('v1',  'variable', 250, 165,  { varKind:'let', varName:'a', varValue:'0' }),
      N('v2',  'variable', 250, 285,  { varKind:'let', varName:'b', varValue:'1' }),
      N('o0',  'output',   250, 405,  { outputValue:'"Start: " + a + ", " + b' }),
      N('lp',  'loop',     250, 525,  { loopVar:'i', loopFrom:'0', loopTo:'8', loopStep:'1' }),
      N('m1',  'math',      90, 680,  { mathExpr:'temp = a + b' }),
      N('m2',  'math',      90, 800,  { mathExpr:'a = b' }),
      N('m3',  'math',      90, 920,  { mathExpr:'b = temp' }),
      N('o1',  'output',    90, 1040, { outputValue:'b' }),
    ],
    edges: [
      E('e1','s1','next',  'v1','in'),
      E('e2','v1','next',  'v2','in'),
      E('e3','v2','next',  'o0','in'),
      E('e4','o0','next',  'lp','in'),
      E('e5','lp','body',  'm1','in', '#94e2d5'),
      E('e6','m1','next',  'm2','in'),
      E('e7','m2','next',  'm3','in'),
      E('e8','m3','next',  'o1','in'),
    ]
  },
]

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
