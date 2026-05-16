import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeData } from '../../utils/flowCodeGen'

const handleStyle = {
  width: 10, height: 10, background: '#89b4fa', border: '2px solid #1e1e2e'
}

const COLORS: Record<string, string> = {
  start:     '#a6e3a1',
  variable:  '#cba6f7',
  output:    '#89b4fa',
  condition: '#f9e2af',
  loop:      '#94e2d5',
  function:  '#b4befe',
  return:    '#f38ba8',
  math:      '#fab387',
  comment:   '#6c7086',
}

function NodeShell({ color, title, icon, children, selected }: {
  color: string; title: string; icon: string; children?: React.ReactNode; selected?: boolean
}) {
  return (
    <div style={{
      background: 'var(--bg-surface0)',
      border: `2px solid ${selected ? '#89b4fa' : color}`,
      borderRadius: 10,
      minWidth: 180,
      maxWidth: 240,
      boxShadow: selected ? `0 0 0 3px ${color}44` : '0 4px 12px rgba(0,0,0,0.4)',
      transition: 'box-shadow 0.15s, border-color 0.15s'
    }}>
      <div style={{
        background: color, borderRadius: '8px 8px 0 0',
        padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1e1e2e' }}>{title}</span>
      </div>
      {children && (
        <div style={{ padding: '8px 10px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="nodrag"
        style={{
          width: '100%', padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'var(--bg-base)', color: 'var(--text)', fontSize: 11, outline: 'none',
          fontFamily: "'JetBrains Mono', monospace"
        }}
      />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} className="nodrag"
        style={{ width: '100%', padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text)', fontSize: 11, outline: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ─── Start Node ───────────────────────────────────────────────────
export const StartNode = memo(({ selected }: NodeProps) => (
  <NodeShell color={COLORS.start} icon="▶" title="START" selected={selected}>
    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Entry point</span>
    <Handle type="source" position={Position.Bottom} id="next" style={handleStyle} />
  </NodeShell>
))
StartNode.displayName = 'StartNode'

// ─── Variable Node ────────────────────────────────────────────────
export const VariableNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.variable} icon="📦" title="VARIABLE" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldSelect label="Kind" value={d.varKind ?? 'let'} onChange={v => updateData(id, { varKind: v })} options={['let', 'const', 'var']} />
      <FieldInput  label="Name"  value={d.varName ?? ''}  onChange={v => updateData(id, { varName: v })}  placeholder="x" />
      <FieldInput  label="Value" value={d.varValue ?? ''} onChange={v => updateData(id, { varValue: v })} placeholder="0" />
      <Handle type="source" position={Position.Bottom} id="next" style={handleStyle} />
    </NodeShell>
  )
})
VariableNode.displayName = 'VariableNode'

// ─── Output Node ──────────────────────────────────────────────────
export const OutputNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.output} icon="📤" title="OUTPUT" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Value" value={d.outputValue ?? ''} onChange={v => updateData(id, { outputValue: v })} placeholder='"Hello World"' />
      <Handle type="source" position={Position.Bottom} id="next" style={handleStyle} />
    </NodeShell>
  )
})
OutputNode.displayName = 'OutputNode'

// ─── Condition Node ───────────────────────────────────────────────
export const ConditionNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.condition} icon="🔀" title="CONDITION (IF)" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Condition" value={d.condition ?? ''} onChange={v => updateData(id, { condition: v })} placeholder="x > 0" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-subtle)', marginTop: 4 }}>
        <span>✓ TRUE →</span>
        <span>← FALSE ✗</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true"  style={{ ...handleStyle, left: '30%', background: '#a6e3a1' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ ...handleStyle, left: '70%', background: '#f38ba8' }} />
      <Handle type="source" position={Position.Right}  id="after" style={{ ...handleStyle, background: '#6c7086' }} />
    </NodeShell>
  )
})
ConditionNode.displayName = 'ConditionNode'

// ─── Loop Node ────────────────────────────────────────────────────
export const LoopNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.loop} icon="🔁" title="FOR LOOP" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Variable" value={d.loopVar  ?? 'i'}  onChange={v => updateData(id, { loopVar: v })}  placeholder="i" />
      <FieldInput label="From"     value={d.loopFrom ?? '0'}  onChange={v => updateData(id, { loopFrom: v })} placeholder="0" />
      <FieldInput label="To"       value={d.loopTo   ?? '10'} onChange={v => updateData(id, { loopTo: v })}   placeholder="10" />
      <FieldInput label="Step"     value={d.loopStep ?? '1'}  onChange={v => updateData(id, { loopStep: v })} placeholder="1" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-subtle)', marginTop: 4 }}>
        <span>↓ BODY</span>
        <span>NEXT ↓</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="body" style={{ ...handleStyle, left: '30%', background: '#94e2d5' }} />
      <Handle type="source" position={Position.Bottom} id="next" style={{ ...handleStyle, left: '70%', background: '#89b4fa' }} />
    </NodeShell>
  )
})
LoopNode.displayName = 'LoopNode'

// ─── Function Node ────────────────────────────────────────────────
export const FunctionNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.function} icon="⚙️" title="FUNCTION" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Name"   value={d.funcName   ?? ''}  onChange={v => updateData(id, { funcName: v })}   placeholder="myFunction" />
      <FieldInput label="Params" value={d.funcParams ?? ''}  onChange={v => updateData(id, { funcParams: v })} placeholder="a, b" />
      <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 4 }}>↓ BODY &nbsp;&nbsp;&nbsp;&nbsp; NEXT ↓</div>
      <Handle type="source" position={Position.Bottom} id="body" style={{ ...handleStyle, left: '30%', background: '#b4befe' }} />
      <Handle type="source" position={Position.Bottom} id="next" style={{ ...handleStyle, left: '70%', background: '#89b4fa' }} />
    </NodeShell>
  )
})
FunctionNode.displayName = 'FunctionNode'

// ─── Return Node ──────────────────────────────────────────────────
export const ReturnNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.return} icon="↩️" title="RETURN" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Value" value={d.returnValue ?? ''} onChange={v => updateData(id, { returnValue: v })} placeholder="result" />
    </NodeShell>
  )
})
ReturnNode.displayName = 'ReturnNode'

// ─── Math Node ────────────────────────────────────────────────────
export const MathNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.math} icon="🔢" title="EXPRESSION" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Expression" value={d.mathExpr ?? ''} onChange={v => updateData(id, { mathExpr: v })} placeholder="result = a + b" />
      <Handle type="source" position={Position.Bottom} id="next" style={handleStyle} />
    </NodeShell>
  )
})
MathNode.displayName = 'MathNode'

// ─── Comment Node ─────────────────────────────────────────────────
export const CommentNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as FlowNodeData
  return (
    <NodeShell color={COLORS.comment} icon="💬" title="COMMENT" selected={selected}>
      <Handle type="target" position={Position.Top} id="in" style={handleStyle} />
      <FieldInput label="Text" value={d.commentText ?? ''} onChange={v => updateData(id, { commentText: v })} placeholder="Add a comment..." />
      <Handle type="source" position={Position.Bottom} id="next" style={handleStyle} />
    </NodeShell>
  )
})
CommentNode.displayName = 'CommentNode'

// ─── Helper: update node data via custom event ────────────────────
function updateData(id: string, patch: Partial<FlowNodeData>) {
  window.dispatchEvent(new CustomEvent('flow:updateNode', { detail: { id, patch } }))
}

// ─── Node type map ────────────────────────────────────────────────
export const NODE_TYPES = {
  start:     StartNode,
  variable:  VariableNode,
  output:    OutputNode,
  condition: ConditionNode,
  loop:      LoopNode,
  function:  FunctionNode,
  return:    ReturnNode,
  math:      MathNode,
  comment:   CommentNode,
}

export const NODE_PALETTE = [
  { type: 'start',     icon: '▶',  label: 'Start',      color: COLORS.start,     desc: 'Program entry point' },
  { type: 'variable',  icon: '📦', label: 'Variable',   color: COLORS.variable,  desc: 'Declare a variable' },
  { type: 'output',    icon: '📤', label: 'Output',     color: COLORS.output,    desc: 'Print to console' },
  { type: 'condition', icon: '🔀', label: 'If/Else',    color: COLORS.condition, desc: 'Branch on condition' },
  { type: 'loop',      icon: '🔁', label: 'For Loop',   color: COLORS.loop,      desc: 'Repeat a fixed number of times' },
  { type: 'function',  icon: '⚙️', label: 'Function',   color: COLORS.function,  desc: 'Define a function' },
  { type: 'return',    icon: '↩️', label: 'Return',     color: COLORS.return,    desc: 'Return a value' },
  { type: 'math',      icon: '🔢', label: 'Expression', color: COLORS.math,      desc: 'Any code expression' },
  { type: 'comment',   icon: '💬', label: 'Comment',    color: COLORS.comment,   desc: 'Add a comment' },
]

export const DEFAULT_NODE_DATA: Record<string, Partial<FlowNodeData>> = {
  start:     { type: 'start',     label: 'Start' },
  variable:  { type: 'variable',  label: 'Variable',   varKind: 'let', varName: 'x',    varValue: '0' },
  output:    { type: 'output',    label: 'Output',     outputValue: '"Hello"' },
  condition: { type: 'condition', label: 'Condition',  condition: 'x > 0' },
  loop:      { type: 'loop',      label: 'Loop',       loopVar: 'i', loopFrom: '0', loopTo: '10', loopStep: '1' },
  function:  { type: 'function',  label: 'Function',   funcName: 'myFunc', funcParams: '' },
  return:    { type: 'return',    label: 'Return',     returnValue: '' },
  math:      { type: 'math',      label: 'Expression', mathExpr: '' },
  comment:   { type: 'comment',   label: 'Comment',    commentText: '' },
}
