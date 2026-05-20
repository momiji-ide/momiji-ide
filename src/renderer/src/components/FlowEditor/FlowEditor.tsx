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

        <button onClick={handleOpenInEditor}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
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

        {/* Right: Code output */}
        {showCode && (
          <div className="flex flex-col flex-shrink-0" style={{ width: 320, borderLeft: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-3 flex-shrink-0"
              style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '36px' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Generated Code</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>● live</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(code).then(() => toast.success('Copied!'))}
                className="text-xs px-2 py-0.5 rounded"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                📋
              </button>
            </div>
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

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
