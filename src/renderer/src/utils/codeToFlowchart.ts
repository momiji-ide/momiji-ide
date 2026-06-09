/**
 * codeToFlowchart.ts
 * Converts JavaScript or Python source code into a flowchart structure
 * (nodes + edges) for visualization with React Flow.
 *
 * The REVERSE of the Flow Editor: instead of building a diagram to generate
 * code, this reads code and draws the diagram. Pure structural parse — no
 * external dependencies. Handles: sequential statements, if/else, while/for
 * loops, function defs, return, break/continue.
 *
 * This is a visualization aid, not a compiler. It aims for "looks right and
 * teaches the control flow", not 100% semantic fidelity.
 */

export type FlowchartNodeType = 'start' | 'end' | 'process' | 'decision' | 'io' | 'loop' | 'function'

export interface FCNode {
  id: string
  type: FlowchartNodeType
  label: string
  x: number
  y: number
}

export interface FCEdge {
  id: string
  source: string
  target: string
  label?: string        // "yes"/"no"/"loop"/"done"
  kind?: 'normal' | 'true' | 'false' | 'loopback'
}

export interface FlowchartResult {
  nodes: FCNode[]
  edges: FCEdge[]
  unsupported: string[]
}

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W   = 180
const V_GAP    = 70    // vertical gap between stacked nodes
const H_GAP    = 200   // horizontal gap for branches
const START_X  = 0

// ── Intermediate AST ──────────────────────────────────────────────────────────
type Stmt =
  | { kind: 'simple'; text: string; io: boolean }
  | { kind: 'if'; cond: string; then: Stmt[]; else: Stmt[] }
  | { kind: 'loop'; cond: string; body: Stmt[]; loopType: 'while' | 'for' }
  | { kind: 'func'; name: string; params: string; body: Stmt[] }
  | { kind: 'return'; text: string }
  | { kind: 'flow'; text: string }   // break / continue

// ── Tokenizer: split into logical lines, tracking block depth ─────────────────
interface Line { indent: number; text: string }

function preprocess(code: string, isPython: boolean): Line[] {
  const raw = code.split('\n')
  const lines: Line[] = []
  for (let l of raw) {
    // strip line comments
    l = l.replace(/\/\/.*$/, '').replace(/#.*$/, isPython ? '' : (m) => m) // keep # only stripped for python
    if (isPython) l = l.replace(/#.*$/, '')
    if (!l.trim()) continue
    const indent = l.length - l.trimStart().length
    lines.push({ indent, text: l.trim() })
  }
  return lines
}

// ── JS/brace parser ───────────────────────────────────────────────────────────
function parseBraces(code: string): Stmt[] {
  // Tokenize into statements & blocks using brace matching
  let i = 0
  const src = code

  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++ }

  function readBlock(): Stmt[] {
    const stmts: Stmt[] = []
    skipWs()
    let expectBrace = false
    if (src[i] === '{') { i++; expectBrace = true }
    while (i < src.length) {
      skipWs()
      if (src[i] === '}') { if (expectBrace) i++; break }
      if (i >= src.length) break
      const stmt = readStatement()
      if (stmt) stmts.push(stmt)
      else break
    }
    return stmts
  }

  function readUntil(chars: string): string {
    let depth = 0, out = ''
    while (i < src.length) {
      const c = src[i]
      if (c === '(') depth++
      if (c === ')') depth--
      if (depth === 0 && chars.includes(c)) break
      out += c; i++
    }
    return out.trim()
  }

  function readParen(): string {
    skipWs()
    if (src[i] !== '(') return ''
    let depth = 0, out = ''
    while (i < src.length) {
      const c = src[i]
      if (c === '(') { depth++; if (depth === 1) { i++; continue } }
      if (c === ')') { depth--; if (depth === 0) { i++; break } }
      out += c; i++
    }
    return out.trim()
  }

  function readStatement(): Stmt | null {
    skipWs()
    if (i >= src.length || src[i] === '}') return null

    // keyword?
    const rest = src.slice(i)
    const kwMatch = rest.match(/^(if|while|for|function|return|break|continue|else)\b/)
    if (kwMatch) {
      const kw = kwMatch[1]
      i += kw.length
      if (kw === 'if') {
        const cond = readParen()
        const then = readBlock()
        skipWs()
        let elseBranch: Stmt[] = []
        if (src.slice(i).match(/^\s*else\b/)) {
          skipWs(); i += 4 // 'else'
          skipWs()
          if (src.slice(i).match(/^\s*if\b/)) {
            // else if → nest
            const inner = readStatement()
            if (inner) elseBranch = [inner]
          } else {
            elseBranch = readBlock()
          }
        }
        return { kind: 'if', cond, then, else: elseBranch }
      }
      if (kw === 'while') {
        const cond = readParen()
        const body = readBlock()
        return { kind: 'loop', cond, body, loopType: 'while' }
      }
      if (kw === 'for') {
        const head = readParen()
        const body = readBlock()
        return { kind: 'loop', cond: simplifyForHead(head), body, loopType: 'for' }
      }
      if (kw === 'function') {
        skipWs()
        const name = readUntil('(').trim()
        const params = readParen()
        const body = readBlock()
        return { kind: 'func', name, params, body }
      }
      if (kw === 'return') {
        const text = readUntil(';\n}')
        if (src[i] === ';') i++
        return { kind: 'return', text }
      }
      if (kw === 'break' || kw === 'continue') {
        readUntil(';\n}'); if (src[i] === ';') i++
        return { kind: 'flow', text: kw }
      }
    }

    // simple statement until ; or newline
    const text = readUntil(';\n}')
    if (src[i] === ';') i++
    if (!text) { i++; return null }
    return { kind: 'simple', text, io: isIO(text) }
  }

  return readBlock()
}

// ── Python/indent parser ──────────────────────────────────────────────────────
function parseIndent(lines: Line[], start = 0, baseIndent = 0): { stmts: Stmt[]; end: number } {
  const stmts: Stmt[] = []
  let i = start
  while (i < lines.length) {
    const ln = lines[i]
    if (ln.indent < baseIndent) break
    if (ln.indent > baseIndent) { i++; continue } // safety

    const t = ln.text
    const ifM = t.match(/^if\s+(.+):/)
    const elifM = t.match(/^elif\s+(.+):/)
    const elseM = t.match(/^else\s*:/)
    const whileM = t.match(/^while\s+(.+):/)
    const forM = t.match(/^for\s+(.+):/)
    const defM = t.match(/^def\s+(\w+)\s*\((.*)\)\s*:/)
    const retM = t.match(/^return\b\s*(.*)/)

    if (ifM) {
      const childIndent = lines[i + 1]?.indent ?? baseIndent + 4
      const thenR = parseIndent(lines, i + 1, childIndent)
      i = thenR.end
      let elseBranch: Stmt[] = []
      // handle elif / else chains
      while (i < lines.length && lines[i].indent === baseIndent && (lines[i].text.match(/^elif\s+(.+):/) || lines[i].text.match(/^else\s*:/))) {
        const cur = lines[i]
        const em = cur.text.match(/^elif\s+(.+):/)
        const ci = lines[i + 1]?.indent ?? baseIndent + 4
        const branch = parseIndent(lines, i + 1, ci)
        if (em) {
          elseBranch = [{ kind: 'if', cond: em[1], then: branch.stmts, else: [] }]
          i = branch.end
          // continue collecting into this nested if's else — simplification: stop after first elif chain link
          // To keep it simple, attach further elif/else to the nested if
          const nestedIf = elseBranch[0] as Extract<Stmt, { kind: 'if' }>
          let j = branch.end
          while (j < lines.length && lines[j].indent === baseIndent && (lines[j].text.match(/^elif\s+(.+):/) || lines[j].text.match(/^else\s*:/))) {
            const em2 = lines[j].text.match(/^elif\s+(.+):/)
            const ci2 = lines[j + 1]?.indent ?? baseIndent + 4
            const br2 = parseIndent(lines, j + 1, ci2)
            if (em2) { nestedIf.else = [{ kind: 'if', cond: em2[1], then: br2.stmts, else: [] }] }
            else     { nestedIf.else = br2.stmts }
            j = br2.end
          }
          i = j
          break
        } else {
          elseBranch = branch.stmts
          i = branch.end
          break
        }
      }
      stmts.push({ kind: 'if', cond: ifM[1], then: thenR.stmts, else: elseBranch })
      continue
    }
    if (whileM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'loop', cond: whileM[1], body: body.stmts, loopType: 'while' })
      i = body.end; continue
    }
    if (forM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'loop', cond: forM[1], body: body.stmts, loopType: 'for' })
      i = body.end; continue
    }
    if (defM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'func', name: defM[1], params: defM[2], body: body.stmts })
      i = body.end; continue
    }
    if (retM) { stmts.push({ kind: 'return', text: retM[1] }); i++; continue }
    if (elifM || elseM) break // handled by parent if
    if (t === 'break' || t === 'continue') { stmts.push({ kind: 'flow', text: t }); i++; continue }

    stmts.push({ kind: 'simple', text: t, io: isIO(t) })
    i++
  }
  return { stmts, end: i }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isIO(text: string): boolean {
  return /\b(print|console\.(log|info|warn|error)|alert|input|prompt|readline)\b/.test(text)
}

function simplifyForHead(head: string): string {
  // for (let i = 0; i < 10; i++)  →  i: 0 → 10
  const m = head.match(/(\w+)\s*=\s*([^;]+);\s*\w+\s*([<>]=?)\s*([^;]+);/)
  if (m) return `${m[1]}: ${m[2].trim()} ${m[3]} ${m[4].trim()}`
  return head
}

function clip(s: string, n = 28): string {
  s = s.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Layout engine: walk Stmt[] → nodes + edges ────────────────────────────────
class Builder {
  nodes: FCNode[] = []
  edges: FCEdge[] = []
  unsupported: string[] = []
  private id = 0

  private node(type: FlowchartNodeType, label: string, x: number, y: number): FCNode {
    const n: FCNode = { id: `fc-${this.id++}`, type, label, x, y }
    this.nodes.push(n)
    return n
  }
  private edge(source: string, target: string, label?: string, kind?: FCEdge['kind']) {
    this.edges.push({ id: `e-${this.id++}`, source, target, label, kind })
  }

  /**
   * Lay out a sequence of statements vertically starting at (x, y).
   * Returns the list of "open" exit node ids (usually one) and the next y.
   * `prevExits` are node ids that should connect into the first node here.
   */
  layout(stmts: Stmt[], x: number, y: number, prevExits: string[], prevLabel?: string): { exits: string[]; y: number } {
    let curY = y
    let exits = prevExits
    let firstLabel = prevLabel

    for (const s of stmts) {
      if (s.kind === 'simple') {
        const n = this.node(s.io ? 'io' : 'process', clip(s.text), x, curY)
        exits.forEach(e => this.edge(e, n.id, firstLabel)); firstLabel = undefined
        exits = [n.id]; curY += V_GAP
      }
      else if (s.kind === 'return') {
        const n = this.node('end', clip('return ' + s.text, 24), x, curY)
        exits.forEach(e => this.edge(e, n.id, firstLabel)); firstLabel = undefined
        exits = []; curY += V_GAP   // return ends this path
      }
      else if (s.kind === 'flow') {
        const n = this.node('process', s.text, x, curY)
        exits.forEach(e => this.edge(e, n.id, firstLabel)); firstLabel = undefined
        exits = [n.id]; curY += V_GAP
      }
      else if (s.kind === 'if') {
        const d = this.node('decision', clip(s.cond, 24) + ' ?', x, curY)
        exits.forEach(e => this.edge(e, d.id, firstLabel)); firstLabel = undefined
        curY += V_GAP

        // THEN branch goes down-left, ELSE down-right
        const thenX = s.else.length ? x - H_GAP / 2 : x
        const elseX = x + H_GAP / 2

        const thenR = this.layout(s.then, thenX, curY, [d.id], 'yes')
        // mark the yes edge
        this.relabelLastEdgeTo(d.id, thenR, 'true')

        let elseExits: string[] = []
        let elseY = curY
        if (s.else.length) {
          const elseR = this.layout(s.else, elseX, curY, [d.id], 'no')
          this.relabelLastEdgeTo(d.id, elseR, 'false')
          elseExits = elseR.exits
          elseY = elseR.y
        } else {
          // no else → the "no" path falls straight through
          elseExits = [d.id]   // decision's false exit continues down
        }

        // merge point
        const mergeY = Math.max(thenR.y, elseY)
        const allExits = [...thenR.exits, ...elseExits]
        curY = mergeY
        exits = allExits
        if (!s.else.length) firstLabel = 'no'   // the merged edge from decision is the "no" path
      }
      else if (s.kind === 'loop') {
        const d = this.node('decision', clip(s.cond, 22) + ' ?', x, curY)
        exits.forEach(e => this.edge(e, d.id, firstLabel)); firstLabel = undefined
        curY += V_GAP

        const bodyR = this.layout(s.body, x - H_GAP / 2, curY, [d.id], 'loop')
        this.relabelLastEdgeTo(d.id, bodyR, 'true')
        // loop back to decision
        bodyR.exits.forEach(e => this.edge(e, d.id, undefined, 'loopback'))
        curY = bodyR.y
        exits = [d.id]      // decision's "false" exits the loop
        firstLabel = 'done'
      }
      else if (s.kind === 'func') {
        const f = this.node('function', `${s.name}(${clip(s.params, 12)})`, x, curY)
        exits.forEach(e => this.edge(e, f.id, firstLabel)); firstLabel = undefined
        curY += V_GAP
        const bodyR = this.layout(s.body, x + 30, curY, [f.id])
        curY = bodyR.y
        exits = bodyR.exits
      }
    }
    return { exits, y: curY }
  }

  // helper: label the first edge that goes out of `from` to the first node of result
  private relabelLastEdgeTo(from: string, _r: { exits: string[] }, kind: 'true' | 'false') {
    // find the most recent edge from `from` without a kind and tag it
    for (let k = this.edges.length - 1; k >= 0; k--) {
      if (this.edges[k].source === from && !this.edges[k].kind) {
        this.edges[k].kind = kind
        this.edges[k].label = kind === 'true' ? 'yes' : 'no'
        break
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function codeToFlowchart(code: string, lang: 'javascript' | 'python'): FlowchartResult {
  const isPython = lang === 'python'
  let stmts: Stmt[]
  try {
    stmts = isPython
      ? parseIndent(preprocess(code, true), 0, 0).stmts
      : parseBraces(code)
  } catch {
    return { nodes: [], edges: [], unsupported: ['Could not parse code'] }
  }

  const b = new Builder()

  // Build: Start → body → End
  const startNode: FCNode = { id: 'fc-start', type: 'start', label: 'Start', x: START_X, y: 0 }
  b.nodes.push(startNode)

  const r = b.layout(stmts, START_X, V_GAP, ['fc-start'])

  // End node if any open exits remain
  if (r.exits.length > 0) {
    const endNode: FCNode = { id: 'fc-end', type: 'end', label: 'End', x: START_X, y: r.y + 10 }
    b.nodes.push(endNode)
    r.exits.forEach(e => b.edges.push({ id: `e-end-${e}`, source: e, target: 'fc-end', kind: 'normal' }))
  }

  return { nodes: b.nodes, edges: b.edges, unsupported: b.unsupported }
}
