/**
 * codeToFlowchart.ts
 * Converts source code into a flowchart structure (nodes + edges) for
 * visualization with React Flow. The REVERSE of the Flow Editor.
 *
 * Two parser front-ends:
 *   • brace  — any C-family language (JS, TS, Java, C, C++, C#, Go, Rust,
 *              PHP, Swift, Kotlin, Dart, ...). Structure is driven by { }.
 *   • indent — Python. Structure driven by indentation.
 *
 * Pure structural parse, zero dependencies. A visualization aid, not a
 * compiler — aims for "looks right and teaches control flow".
 */

export type FlowchartNodeType = 'start' | 'end' | 'process' | 'decision' | 'io' | 'loop' | 'function'

export interface FCNode { id: string; type: FlowchartNodeType; label: string; x: number; y: number }
export interface FCEdge { id: string; source: string; target: string; label?: string; kind?: 'normal' | 'true' | 'false' | 'loopback' }
export interface FlowchartResult { nodes: FCNode[]; edges: FCEdge[]; unsupported: string[] }

// ── Supported languages ───────────────────────────────────────────────────────
const BRACE_LANGS = new Set([
  'javascript', 'typescript', 'jsx', 'tsx', 'java', 'c', 'cpp', 'c++', 'csharp',
  'c#', 'go', 'golang', 'rust', 'php', 'swift', 'kotlin', 'dart', 'scala', 'groovy'
])
const INDENT_LANGS = new Set(['python', 'py'])

export function isFlowchartSupported(lang: string): boolean {
  const l = lang.toLowerCase()
  return BRACE_LANGS.has(l) || INDENT_LANGS.has(l)
}

function family(lang: string): 'brace' | 'indent' {
  return INDENT_LANGS.has(lang.toLowerCase()) ? 'indent' : 'brace'
}

// ── Layout constants ──────────────────────────────────────────────────────────
const V_GAP   = 70
const H_GAP   = 200
const START_X = 0

// ── Intermediate AST ──────────────────────────────────────────────────────────
type Stmt =
  | { kind: 'simple'; text: string; io: boolean }
  | { kind: 'if'; cond: string; then: Stmt[]; else: Stmt[] }
  | { kind: 'loop'; cond: string; body: Stmt[]; loopType: 'while' | 'for' }
  | { kind: 'func'; name: string; params: string; body: Stmt[] }
  | { kind: 'block'; label: string; body: Stmt[] }
  | { kind: 'return'; text: string }
  | { kind: 'flow'; text: string }

// ── Brace parser (C-family) ───────────────────────────────────────────────────
function parseBraces(code: string): Stmt[] {
  const src = code
  const N = src.length
  let i = 0

  function skipWs() {
    while (i < N) {
      if (/\s/.test(src[i])) { i++; continue }
      if (src[i] === '/' && src[i + 1] === '/') { while (i < N && src[i] !== '\n') i++; continue }
      if (src[i] === '/' && src[i + 1] === '*') { i += 2; while (i < N && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
      break
    }
  }

  // Read up to a brace / semicolon / closing brace. String, paren, and
  // newline aware so it works for both semicolon languages (C, Java, JS)
  // and semicolon-optional languages (Go, Swift, Kotlin, Rust).
  function readHeader(): { text: string; term: '{' | ';' | '}' | '' } {
    let depth = 0, out = '', str: string | null = null
    const isCtrlHeader = () => /^(for|foreach|while|if|switch|do)\b/.test(out.trim()) || /\belse\s*$/.test(out.trim())
    while (i < N) {
      const c = src[i]
      if (str) { out += c; if (c === str && src[i - 1] !== '\\') str = null; i++; continue }
      if (c === '"' || c === "'" || c === '`') { str = c; out += c; i++; continue }
      if (c === '/' && src[i + 1] === '/') { while (i < N && src[i] !== '\n') i++; continue }
      if (c === '(' || c === '[') depth++
      if (c === ')' || c === ']') depth--

      if (depth === 0) {
        if (c === '{') return { text: out.trim(), term: '{' }
        if (c === '}') return { text: out.trim(), term: '}' }
        if (c === ';') {
          // Go/no-paren for-loop has internal ';' — keep reading until '{'
          if (/^for(each)?\b/.test(out.trim())) { out += c; i++; continue }
          i++; return { text: out.trim(), term: ';' }
        }
        if (c === '\n') {
          const t = out.trim()
          if (!t || isCtrlHeader()) { out += c; i++; continue }      // wait for '{'
          if (/[+\-*/%=<>&|,.([{:?]$/.test(t)) { out += c; i++; continue } // line continuation
          // peek next meaningful char — chaining / else / operators continue the stmt
          let j = i + 1
          while (j < N && /[ \t\r]/.test(src[j])) j++
          const nx = src[j]
          if (nx === '.' || nx === '{' || nx === ')' || nx === ']' || nx === '?' || nx === ':' ||
              /^(else|catch|finally|&&|\|\||\?\?)/.test(src.slice(j))) { out += c; i++; continue }
          // otherwise: newline ends this statement (Go/Swift/Kotlin style)
          i++; return { text: t, term: ';' }
        }
      }
      out += c; i++
    }
    return { text: out.trim(), term: '' }
  }

  // mode 'top'   → read all statements until EOF (used once at the root)
  // mode 'block' → braced: read until matching '}'; unbraced: read ONE statement
  //                (handles `if (x) doThing();` without braces)
  function parseBlock(mode: 'top' | 'block'): Stmt[] {
    const stmts: Stmt[] = []
    skipWs()
    let braced = false
    if (src[i] === '{') { i++; braced = true }
    let guard = 0
    while (i < N && guard++ < 10000) {
      skipWs()
      if (i >= N) break
      if (src[i] === '}') { if (braced) i++; break }
      const before = i
      const s = parseOne()
      if (s) stmts.push(s)
      if (mode === 'block' && !braced) break   // single-statement unbraced body
      if (i === before) i++                    // safety: avoid infinite loop
    }
    return stmts
  }

  function parseOne(): Stmt | null {
    skipWs()
    if (i >= N || src[i] === '}') return null
    const { text, term } = readHeader()
    if (term === '{') return parseBlockHeader(text)
    if (!text) return null
    const kw = text.match(/^(return|break|continue)\b/)
    if (kw) {
      if (kw[1] === 'return') return { kind: 'return', text: text.replace(/^return\b/, '').trim() }
      return { kind: 'flow', text: kw[1] }
    }
    return { kind: 'simple', text, io: isIO(text) }
  }

  function parseBlockHeader(header: string): Stmt | null {
    const h = header.trim()
    if (/^if\b/.test(h)) {
      const cond = stripParens(h.replace(/^if\b/, '').trim())
      const then = parseBlock('block')
      let elseBranch: Stmt[] = []
      skipWs()
      if (/^else\b/.test(src.slice(i))) {
        i += 4; skipWs()
        if (/^if\b/.test(src.slice(i))) {
          const inner = parseOne()        // else-if → nested if
          if (inner) elseBranch = [inner]
        } else {
          elseBranch = parseBlock('block')
        }
      }
      return { kind: 'if', cond, then, else: elseBranch }
    }
    if (/^while\b/.test(h)) {
      return { kind: 'loop', cond: stripParens(h.replace(/^while\b/, '').trim()), body: parseBlock('block'), loopType: 'while' }
    }
    if (/^for(each)?\b/.test(h)) {
      const raw = stripParens(h.replace(/^for(each)?\b/, '').trim())
      return { kind: 'loop', cond: simplifyForHead(raw), body: parseBlock('block'), loopType: 'for' }
    }
    if (/^switch\b/.test(h)) {
      return { kind: 'if', cond: 'switch ' + stripParens(h.replace(/^switch\b/, '').trim()), then: parseBlock('block'), else: [] }
    }
    if (/^do\b/.test(h)) {
      const body = parseBlock('block'); skipWs()
      let cond = 'loop'
      if (/^while\b/.test(src.slice(i))) { i += 5; cond = stripParens(readHeader().text) }
      return { kind: 'loop', cond, body, loopType: 'while' }
    }
    // function-like: optional return-type/keyword + name(params)
    const fm = h.match(/(?:^|\s)(?:function|func|fn|def|sub)?\s*([A-Za-z_]\w*)\s*\(([^)]*)\)\s*[^)]*$/)
    if (fm && h.includes('(')) {
      return { kind: 'func', name: fm[1], params: fm[2], body: parseBlock('block') }
    }
    // generic block (try/else/namespace/etc.) — keep its header as a label
    return { kind: 'block', label: h || 'block', body: parseBlock('block') }
  }

  return parseBlock('top')
}

// ── Python/indent parser ──────────────────────────────────────────────────────
interface Line { indent: number; text: string }
function preprocess(code: string): Line[] {
  const out: Line[] = []
  for (let l of code.split('\n')) {
    l = l.replace(/#.*$/, '')
    if (!l.trim()) continue
    out.push({ indent: l.length - l.trimStart().length, text: l.trim() })
  }
  return out
}

function parseIndent(lines: Line[], start: number, baseIndent: number): { stmts: Stmt[]; end: number } {
  const stmts: Stmt[] = []
  let i = start
  while (i < lines.length) {
    const ln = lines[i]
    if (ln.indent < baseIndent) break
    if (ln.indent > baseIndent) { i++; continue }
    const t = ln.text
    const ifM = t.match(/^if\s+(.+):/)
    const whileM = t.match(/^while\s+(.+):/)
    const forM = t.match(/^for\s+(.+):/)
    const defM = t.match(/^def\s+(\w+)\s*\((.*)\)\s*:/)
    const retM = t.match(/^return\b\s*(.*)/)

    if (ifM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const thenR = parseIndent(lines, i + 1, ci); i = thenR.end
      let elseBranch: Stmt[] = []
      // chain elif/else
      const collectElse = (): Stmt[] => {
        if (i >= lines.length || lines[i].indent !== baseIndent) return []
        const em = lines[i].text.match(/^elif\s+(.+):/)
        const elM = lines[i].text.match(/^else\s*:/)
        if (em) {
          const cci = lines[i + 1]?.indent ?? baseIndent + 4
          const br = parseIndent(lines, i + 1, cci); i = br.end
          return [{ kind: 'if', cond: em[1], then: br.stmts, else: collectElse() }]
        }
        if (elM) {
          const cci = lines[i + 1]?.indent ?? baseIndent + 4
          const br = parseIndent(lines, i + 1, cci); i = br.end
          return br.stmts
        }
        return []
      }
      elseBranch = collectElse()
      stmts.push({ kind: 'if', cond: ifM[1], then: thenR.stmts, else: elseBranch })
      continue
    }
    if (whileM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'loop', cond: whileM[1], body: body.stmts, loopType: 'while' }); i = body.end; continue
    }
    if (forM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'loop', cond: forM[1], body: body.stmts, loopType: 'for' }); i = body.end; continue
    }
    if (defM) {
      const ci = lines[i + 1]?.indent ?? baseIndent + 4
      const body = parseIndent(lines, i + 1, ci)
      stmts.push({ kind: 'func', name: defM[1], params: defM[2], body: body.stmts }); i = body.end; continue
    }
    if (retM) { stmts.push({ kind: 'return', text: retM[1] }); i++; continue }
    if (/^(elif|else)\b/.test(t)) break
    if (t === 'break' || t === 'continue' || t === 'pass') { stmts.push({ kind: 'flow', text: t }); i++; continue }
    stmts.push({ kind: 'simple', text: t, io: isIO(t) }); i++
  }
  return { stmts, end: i }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isIO(text: string): boolean {
  return /\b(print|println|printf|cout|console\.(log|info|warn|error)|System\.out|echo|alert|input|prompt|readline|scanf|Console\.Write|fmt\.Print)\b/.test(text)
}
function stripParens(s: string): string {
  s = s.trim()
  if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1).trim()
  return s
}
function simplifyForHead(head: string): string {
  // C / Go style: i = 0; i < 10; i++  →  i: 0 < 10  (also handles := )
  const m = head.match(/(\w+)\s*:?=\s*([^;]+);\s*\w+\s*([<>]=?)\s*([^;{]+)/)
  if (m) return `${m[1]}: ${m[2].trim()} ${m[3]} ${m[4].trim()}`
  return head
}
function clip(s: string, n = 28): string {
  s = s.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Layout engine ─────────────────────────────────────────────────────────────
class Builder {
  nodes: FCNode[] = []
  edges: FCEdge[] = []
  unsupported: string[] = []
  private id = 0
  private node(type: FlowchartNodeType, label: string, x: number, y: number): FCNode {
    const n: FCNode = { id: `fc-${this.id++}`, type, label, x, y }; this.nodes.push(n); return n
  }
  private edge(source: string, target: string, label?: string, kind?: FCEdge['kind']) {
    this.edges.push({ id: `e-${this.id++}`, source, target, label, kind })
  }
  private tagEdge(from: string, kind: 'true' | 'false') {
    for (let k = this.edges.length - 1; k >= 0; k--) {
      if (this.edges[k].source === from && !this.edges[k].kind) {
        this.edges[k].kind = kind; this.edges[k].label = kind === 'true' ? 'yes' : 'no'; break
      }
    }
  }

  layout(stmts: Stmt[], x: number, y: number, prevExits: string[], prevLabel?: string): { exits: string[]; y: number } {
    let curY = y, exits = prevExits, lbl = prevLabel
    for (const s of stmts) {
      if (s.kind === 'simple') {
        const n = this.node(s.io ? 'io' : 'process', clip(s.text), x, curY)
        exits.forEach(e => this.edge(e, n.id, lbl)); lbl = undefined; exits = [n.id]; curY += V_GAP
      } else if (s.kind === 'return') {
        const n = this.node('end', clip('return ' + s.text, 24), x, curY)
        exits.forEach(e => this.edge(e, n.id, lbl)); lbl = undefined; exits = []; curY += V_GAP
      } else if (s.kind === 'flow') {
        const n = this.node('process', s.text, x, curY)
        exits.forEach(e => this.edge(e, n.id, lbl)); lbl = undefined; exits = [n.id]; curY += V_GAP
      } else if (s.kind === 'block') {
        const n = this.node('process', clip(s.label, 22), x, curY)
        exits.forEach(e => this.edge(e, n.id, lbl)); lbl = undefined; curY += V_GAP
        const r = this.layout(s.body, x + 30, curY, [n.id]); curY = r.y; exits = r.exits
      } else if (s.kind === 'if') {
        const d = this.node('decision', clip(s.cond, 24) + ' ?', x, curY)
        exits.forEach(e => this.edge(e, d.id, lbl)); lbl = undefined; curY += V_GAP
        const thenX = s.else.length ? x - H_GAP / 2 : x
        const elseX = x + H_GAP / 2
        const thenR = this.layout(s.then, thenX, curY, [d.id], 'yes'); this.tagEdge(d.id, 'true')
        let elseExits: string[] = [], elseY = curY
        if (s.else.length) {
          const elseR = this.layout(s.else, elseX, curY, [d.id], 'no'); this.tagEdge(d.id, 'false')
          elseExits = elseR.exits; elseY = elseR.y
        } else { elseExits = [d.id] }
        curY = Math.max(thenR.y, elseY); exits = [...thenR.exits, ...elseExits]
        if (!s.else.length) lbl = 'no'
      } else if (s.kind === 'loop') {
        const d = this.node('decision', clip(s.cond, 22) + ' ?', x, curY)
        exits.forEach(e => this.edge(e, d.id, lbl)); lbl = undefined; curY += V_GAP
        const bodyR = this.layout(s.body, x - H_GAP / 2, curY, [d.id], 'loop'); this.tagEdge(d.id, 'true')
        bodyR.exits.forEach(e => this.edge(e, d.id, undefined, 'loopback'))
        curY = bodyR.y; exits = [d.id]; lbl = 'done'
      } else if (s.kind === 'func') {
        const f = this.node('function', `${s.name}(${clip(s.params, 12)})`, x, curY)
        exits.forEach(e => this.edge(e, f.id, lbl)); lbl = undefined; curY += V_GAP
        const bodyR = this.layout(s.body, x + 30, curY, [f.id]); curY = bodyR.y; exits = bodyR.exits
      }
    }
    return { exits, y: curY }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function codeToFlowchart(code: string, lang: string): FlowchartResult {
  let stmts: Stmt[]
  try {
    stmts = family(lang) === 'indent'
      ? parseIndent(preprocess(code), 0, 0).stmts
      : parseBraces(code)
  } catch {
    return { nodes: [], edges: [], unsupported: ['Could not parse code'] }
  }

  const b = new Builder()
  b.nodes.push({ id: 'fc-start', type: 'start', label: 'Start', x: START_X, y: 0 })
  const r = b.layout(stmts, START_X, V_GAP, ['fc-start'])
  if (r.exits.length > 0) {
    b.nodes.push({ id: 'fc-end', type: 'end', label: 'End', x: START_X, y: r.y + 10 })
    r.exits.forEach(e => b.edges.push({ id: `e-end-${e}`, source: e, target: 'fc-end', kind: 'normal' }))
  }
  return { nodes: b.nodes, edges: b.edges, unsupported: b.unsupported }
}
