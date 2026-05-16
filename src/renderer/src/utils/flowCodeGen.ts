import type { Node, Edge } from '@xyflow/react'

export interface FlowNodeData {
  type: string
  label: string
  // variable
  varName?: string
  varValue?: string
  varKind?: 'let' | 'const' | 'var'
  // condition
  condition?: string
  // loop
  loopVar?: string
  loopFrom?: string
  loopTo?: string
  loopStep?: string
  // output
  outputValue?: string
  // function
  funcName?: string
  funcParams?: string
  // return
  returnValue?: string
  // math
  mathExpr?: string
  // comment
  commentText?: string
}

function indent(depth: number) { return '  '.repeat(depth) }

function getNextNode(nodeId: string, handleId: string = 'next', edges: Edge[], nodes: Node[]): Node | null {
  const edge = edges.find(e => e.source === nodeId && (e.sourceHandle === handleId || (!e.sourceHandle && handleId === 'next')))
  if (!edge) return null
  return nodes.find(n => n.id === edge.target) ?? null
}

function traverse(node: Node | null, edges: Edge[], nodes: Node[], visited: Set<string>, depth: number, lang: 'javascript' | 'python'): string {
  if (!node || visited.has(node.id)) return ''
  visited.add(node.id)

  const d = node.data as FlowNodeData
  const pad = indent(depth)
  const nl = '\n'
  let code = ''

  switch (d.type) {
    case 'start':
      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break

    case 'variable': {
      const kind = lang === 'python' ? '' : `${d.varKind ?? 'let'} `
      const assign = lang === 'python' ? `${d.varName} = ${d.varValue ?? '0'}` : `${kind}${d.varName} = ${d.varValue ?? '0'}`
      code += `${pad}${assign}${nl}`
      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }

    case 'output': {
      const val = d.outputValue ?? '""'
      const stmt = lang === 'python' ? `print(${val})` : `console.log(${val})`
      code += `${pad}${stmt}${nl}`
      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }

    case 'condition': {
      const cond = d.condition ?? 'true'
      const kw = lang === 'python' ? 'if' : 'if'
      const thenBody = traverse(getNextNode(node.id, 'true', edges, nodes), edges, nodes, new Set(visited), depth + 1, lang)
      const elseBody = traverse(getNextNode(node.id, 'false', edges, nodes), edges, nodes, new Set(visited), depth + 1, lang)

      if (lang === 'python') {
        code += `${pad}if ${cond}:${nl}`
        code += thenBody || `${indent(depth + 1)}pass${nl}`
        if (elseBody) { code += `${pad}else:${nl}${elseBody}` }
      } else {
        code += `${pad}${kw} (${cond}) {${nl}`
        code += thenBody || `${indent(depth + 1)}// empty${nl}`
        code += `${pad}}${nl}`
        if (elseBody) { code += `${pad}else {${nl}${elseBody}${pad}}${nl}` }
      }

      const afterNode = getNextNode(node.id, 'after', edges, nodes)
      code += traverse(afterNode, edges, nodes, visited, depth, lang)
      break
    }

    case 'loop': {
      const v = d.loopVar ?? 'i'
      const from = d.loopFrom ?? '0'
      const to = d.loopTo ?? '10'
      const step = d.loopStep ?? '1'
      const body = traverse(getNextNode(node.id, 'body', edges, nodes), edges, nodes, new Set(visited), depth + 1, lang)

      if (lang === 'python') {
        code += `${pad}for ${v} in range(${from}, ${to}, ${step}):${nl}`
        code += body || `${indent(depth + 1)}pass${nl}`
      } else {
        code += `${pad}for (let ${v} = ${from}; ${v} < ${to}; ${v} += ${step}) {${nl}`
        code += body || `${indent(depth + 1)}// loop body${nl}`
        code += `${pad}}${nl}`
      }

      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }

    case 'function': {
      const name = d.funcName ?? 'myFunction'
      const params = d.funcParams ?? ''
      const body = traverse(getNextNode(node.id, 'body', edges, nodes), edges, nodes, new Set(visited), depth + 1, lang)

      if (lang === 'python') {
        code += `${pad}def ${name}(${params}):${nl}`
        code += body || `${indent(depth + 1)}pass${nl}`
        code += nl
      } else {
        code += `${pad}function ${name}(${params}) {${nl}`
        code += body || `${indent(depth + 1)}// function body${nl}`
        code += `${pad}}${nl}${nl}`
      }

      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }

    case 'return': {
      const val = d.returnValue ?? ''
      code += `${pad}return${val ? ` ${val}` : ''}${nl}`
      break
    }

    case 'math': {
      code += `${pad}${d.mathExpr ?? ''}${nl}`
      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }

    case 'comment': {
      const sym = lang === 'python' ? '#' : '//'
      code += `${pad}${sym} ${d.commentText ?? ''}${nl}`
      code += traverse(getNextNode(node.id, 'next', edges, nodes), edges, nodes, visited, depth, lang)
      break
    }
  }

  return code
}

export function generateCodeFromFlow(nodes: Node[], edges: Edge[], lang: 'javascript' | 'python'): string {
  const startNode = nodes.find(n => (n.data as FlowNodeData).type === 'start')
  if (!startNode) return lang === 'python' ? '# Connect a Start node to begin\n' : '// Connect a Start node to begin\n'

  const functionNodes = nodes.filter(n => (n.data as FlowNodeData).type === 'function')
  let code = ''

  // Generate function definitions first
  for (const fn of functionNodes) {
    code += traverse(fn, edges, nodes, new Set(), 0, lang)
  }

  // Generate main flow
  const visited = new Set(functionNodes.map(n => n.id))
  const mainCode = traverse(startNode, edges, nodes, visited, 0, lang)
  code += mainCode

  if (!code.trim()) {
    return lang === 'python'
      ? '# Drag blocks and connect them to generate code\n'
      : '// Drag blocks and connect them to generate code\n'
  }

  return code
}
