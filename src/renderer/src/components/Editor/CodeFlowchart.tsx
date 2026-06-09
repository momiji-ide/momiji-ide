import { useMemo } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls,
  type Node, type Edge, MarkerType, Handle, Position, type NodeProps,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { codeToFlowchart, type FlowchartNodeType } from '../../utils/codeToFlowchart'

// ─── Shape colors per node type ───────────────────────────────────────────────
const SHAPE: Record<FlowchartNodeType, { bg: string; border: string; text: string }> = {
  start:    { bg: 'var(--accent-green)',  border: 'var(--accent-green)',  text: 'var(--bg-base)' },
  end:      { bg: 'var(--accent-red)',    border: 'var(--accent-red)',    text: 'white' },
  process:  { bg: 'var(--bg-surface0)',   border: 'var(--accent-mauve)',  text: 'var(--text)' },
  decision: { bg: 'var(--accent-yellow)', border: 'var(--accent-yellow)', text: 'var(--bg-base)' },
  io:       { bg: 'var(--bg-surface0)',   border: 'var(--accent-teal)',   text: 'var(--text)' },
  loop:     { bg: 'var(--bg-surface0)',   border: 'var(--accent-teal)',   text: 'var(--text)' },
  function: { bg: 'var(--bg-surface0)',   border: '#b4befe',              text: 'var(--text)' },
}

const hStyle = { width: 7, height: 7, background: 'var(--accent-mauve)', border: 'none' }

// ─── Custom node renderers ────────────────────────────────────────────────────
function TerminatorNode({ data }: NodeProps) {
  const c = SHAPE[(data as any).ntype as FlowchartNodeType]
  return (
    <div style={{
      background: c.bg, color: c.text, border: `2px solid ${c.border}`,
      borderRadius: 999, padding: '8px 22px', fontSize: 12, fontWeight: 700,
      textAlign: 'center', minWidth: 80
    }}>
      <Handle type="target" position={Position.Top} style={hStyle} />
      {(data as any).label}
      <Handle type="source" position={Position.Bottom} style={hStyle} />
    </div>
  )
}

function ProcessNode({ data }: NodeProps) {
  const c = SHAPE[(data as any).ntype as FlowchartNodeType]
  return (
    <div style={{
      background: c.bg, color: c.text, border: `2px solid ${c.border}`,
      borderRadius: 8, padding: '10px 16px', fontSize: 11.5, fontWeight: 500,
      textAlign: 'center', minWidth: 140, maxWidth: 200, fontFamily: "'JetBrains Mono', monospace"
    }}>
      <Handle type="target" position={Position.Top} style={hStyle} />
      {(data as any).label}
      <Handle type="source" position={Position.Bottom} style={hStyle} />
    </div>
  )
}

function IONode({ data }: NodeProps) {
  const c = SHAPE.io
  return (
    <div style={{ position: 'relative', minWidth: 150 }}>
      <Handle type="target" position={Position.Top} style={hStyle} />
      <div style={{
        background: c.bg, color: c.text, border: `2px solid ${c.border}`,
        padding: '10px 24px', fontSize: 11.5, fontWeight: 500, textAlign: 'center',
        transform: 'skewX(-14deg)', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace"
      }}>
        <div style={{ transform: 'skewX(14deg)' }}>📤 {(data as any).label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={hStyle} />
    </div>
  )
}

function DecisionNode({ data }: NodeProps) {
  const c = SHAPE.decision
  const label = (data as any).label
  return (
    <div style={{ position: 'relative', width: 150, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Top} style={hStyle} />
      {/* Diamond */}
      <div style={{
        position: 'absolute', width: 70, height: 70, top: 10, left: 40,
        background: c.bg, border: `2px solid ${c.border}`, transform: 'rotate(45deg)', borderRadius: 6
      }} />
      <div style={{
        position: 'relative', zIndex: 1, color: c.text, fontSize: 10.5, fontWeight: 700,
        textAlign: 'center', maxWidth: 130, padding: '0 4px', fontFamily: "'JetBrains Mono', monospace"
      }}>
        {label}
      </div>
      {/* yes (down-left via bottom), no (right) */}
      <Handle type="source" position={Position.Bottom} id="yes" style={{ ...hStyle, background: 'var(--accent-green)' }} />
      <Handle type="source" position={Position.Right}  id="no"  style={{ ...hStyle, background: 'var(--accent-red)' }} />
    </div>
  )
}

const NODE_TYPES = {
  terminator: TerminatorNode,
  process:    ProcessNode,
  io:         IONode,
  decision:   DecisionNode,
}

// ─── Map FC nodes → React Flow nodes ──────────────────────────────────────────
function toRFNode(t: FlowchartNodeType): keyof typeof NODE_TYPES {
  if (t === 'start' || t === 'end') return 'terminator'
  if (t === 'decision' || t === 'loop') return 'decision'
  if (t === 'io') return 'io'
  return 'process'
}

interface Props { code: string; lang: string }

function FlowchartInner({ code, lang }: Props) {
  const { nodes, edges, empty } = useMemo(() => {
    const r = codeToFlowchart(code, lang)
    if (r.nodes.length <= 1) return { nodes: [], edges: [], empty: true }

    const rfNodes: Node[] = r.nodes.map(n => ({
      id: n.id,
      type: toRFNode(n.type),
      position: { x: n.x, y: n.y * 1.4 },
      data: { label: n.label, ntype: n.type },
      draggable: true,
    }))

    const rfEdges: Edge[] = r.edges.map(e => {
      const isLoop = e.kind === 'loopback'
      const isTrue = e.kind === 'true'
      const isFalse = e.kind === 'false'
      const color = isLoop ? 'var(--accent-teal)'
                  : isTrue ? 'var(--accent-green)'
                  : isFalse ? 'var(--accent-red)'
                  : 'var(--accent-mauve)'
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: isFalse ? 'no' : isTrue ? 'yes' : undefined,
        label: e.label,
        type: isLoop ? 'smoothstep' : 'smoothstep',
        animated: isLoop,
        labelStyle: { fontSize: 10, fontWeight: 700, fill: color },
        labelBgStyle: { fill: 'var(--bg-base)' },
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      }
    })

    return { nodes: rfNodes, edges: rfEdges, empty: false }
  }, [code, lang])

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center"
        style={{ background: 'var(--bg-base)' }}>
        <span style={{ fontSize: 32 }}>📊</span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No flowchart yet</p>
        <p className="text-xs" style={{ color: 'var(--text-subtle)', maxWidth: 280 }}>
          Write some code with statements, <code style={{ color: 'var(--accent-mauve)' }}>if</code>/<code style={{ color: 'var(--accent-mauve)' }}>else</code>,
          or loops — the flowchart updates live as you type.
        </p>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg-base)' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
      <Controls showInteractive={false} style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', borderRadius: 8 }} />
    </ReactFlow>
  )
}

export function CodeFlowchart({ code, lang }: Props) {
  return (
    <ReactFlowProvider>
      <FlowchartInner code={code} lang={lang} />
    </ReactFlowProvider>
  )
}
