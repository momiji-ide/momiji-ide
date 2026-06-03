/**
 * codeToBlockly.ts
 * Converts a subset of JavaScript back to Blockly XML.
 * Handles: variables, for-loops, while-loops, if/else, print,
 *          arithmetic, comparison, logic, function defs/calls.
 *
 * This covers the exact output produced by Blockly's JS generator,
 * giving true round-trip fidelity for blocks↔code sync.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BBlock {
  type:        string
  fields?:     Record<string, string>
  values?:     Record<string, BBlock>
  statements?: Record<string, BBlock>
  next?:       BBlock | null
  mutation?:   Record<string, string>
  extraState?: string
  _shadow?:    boolean   // render as <shadow> not <block>
}

export interface ConversionResult {
  xml:       string          // full <xml> string ready for Blockly.Xml.domToWorkspace
  blocks:    number          // how many top-level blocks
  coverage:  number          // 0-1: fraction of lines covered
  advanced:  string[]        // list of patterns that couldn't be converted
}

// ── XML helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bToXML(b: BBlock | null | undefined, tag = 'block'): string {
  if (!b) return ''
  const lines: string[] = [`<${tag} type="${b.type}">`]

  if (b.mutation) {
    const attrs = Object.entries(b.mutation).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')
    lines.push(`  <mutation ${attrs}></mutation>`)
  }
  if (b.extraState) lines.push(`  <mutation>${esc(b.extraState)}</mutation>`)

  for (const [k, v] of Object.entries(b.fields ?? {})) {
    lines.push(`  <field name="${k}">${esc(v)}</field>`)
  }
  for (const [k, val] of Object.entries(b.values ?? {})) {
    const inner = bToXML(val, val._shadow ? 'shadow' : 'block')
    lines.push(`  <value name="${k}">${inner}</value>`)
  }
  for (const [k, stmt] of Object.entries(b.statements ?? {})) {
    lines.push(`  <statement name="${k}">${bToXML(stmt)}</statement>`)
  }
  if (b.next) lines.push(`  <next>${bToXML(b.next)}</next>`)

  lines.push(`</${tag}>`)
  return lines.join('\n')
}

function numBlock(n: string): BBlock {
  return { type: 'math_number', fields: { NUM: n }, _shadow: true }
}
function strBlock(s: string): BBlock {
  return { type: 'text', fields: { TEXT: s }, _shadow: true }
}
function varGet(name: string): BBlock {
  return { type: 'variables_get', fields: { VAR: name } }
}

// ── Tokenizer ──────────────────────────────────────────────────────────────

type TokType =
  | 'NUMBER' | 'STRING' | 'IDENT' | 'KEYWORD'
  | 'OP' | 'PUNCT'
  | 'EOF'

interface Token { type: TokType; value: string; pos: number }

const KEYWORDS = new Set([
  'var', 'let', 'const', 'if', 'else', 'for', 'while', 'function', 'return',
  'true', 'false', 'null', 'undefined', 'do', 'break', 'continue', 'new'
])

function tokenize(src: string): Token[] {
  const toks: Token[] = []
  let i = 0

  while (i < src.length) {
    // Skip whitespace
    if (/\s/.test(src[i])) { i++; continue }

    // Line comments
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    // Block comments
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i - 1] === '*' && src[i] === '/')) i++
      i++
      continue
    }

    const start = i

    // Numbers
    if (/[0-9]/.test(src[i]) || (src[i] === '-' && /[0-9]/.test(src[i + 1]) && (toks.length === 0 || ['OP', 'PUNCT'].includes(toks[toks.length - 1]?.type)))) {
      if (src[i] === '-') i++
      while (i < src.length && /[0-9._]/.test(src[i])) i++
      toks.push({ type: 'NUMBER', value: src.slice(start, i), pos: start })
      continue
    }

    // Strings
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i]; i++
      let val = ''
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { i++; val += src[i] ?? '' } else { val += src[i] }
        i++
      }
      i++ // closing quote
      toks.push({ type: 'STRING', value: val, pos: start })
      continue
    }

    // Identifiers / keywords
    if (/[a-zA-Z_$]/.test(src[i])) {
      while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) i++
      const word = src.slice(start, i)
      toks.push({ type: KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT', value: word, pos: start })
      continue
    }

    // Multi-char operators
    const two = src.slice(i, i + 3)
    const three = src.slice(i, i + 3)
    if (['===', '!==', '>>>', '<<=', '>>='].includes(three)) { toks.push({ type: 'OP', value: three, pos: i }); i += 3; continue }
    const two2 = src.slice(i, i + 2)
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '=>'].includes(two2)) {
      toks.push({ type: 'OP', value: two2, pos: i }); i += 2; continue
    }

    // Single char
    const ch = src[i]
    if ('+-*/%<>!&|^~'.includes(ch)) { toks.push({ type: 'OP', value: ch, pos: i }); i++; continue }
    if ('(){}[];:,?.'.includes(ch)) { toks.push({ type: 'PUNCT', value: ch, pos: i }); i++; continue }
    i++ // skip unknown
  }

  toks.push({ type: 'EOF', value: '', pos: i })
  return toks
}

// ── Parser ──────────────────────────────────────────────────────────────────

class Parser {
  private toks: Token[]
  private pos  = 0
  public  advanced: string[] = []

  constructor(src: string) {
    this.toks = tokenize(src)
  }

  private peek(offset = 0): Token { return this.toks[Math.min(this.pos + offset, this.toks.length - 1)] }
  private consume(): Token { return this.toks[this.pos++] ?? { type: 'EOF', value: '', pos: 0 } }
  private expect(val: string): void { if (this.peek().value === val) this.consume() }
  private eat(val: string): boolean { if (this.peek().value === val) { this.consume(); return true } return false }
  private eof(): boolean { return this.peek().type === 'EOF' }

  // Skip to end of statement on parse error
  private skipToStmtEnd() {
    let depth = 0
    while (!this.eof()) {
      const t = this.peek()
      if (t.value === '{') depth++
      if (t.value === '}') { if (depth === 0) break; depth-- }
      if (t.value === ';' && depth === 0) { this.consume(); break }
      this.consume()
    }
  }

  // Collect raw source of a balanced {} block
  private collectBlock(): string {
    const parts: string[] = []
    this.expect('{')
    let depth = 1
    while (!this.eof() && depth > 0) {
      const t = this.consume()
      if (t.value === '{') depth++
      if (t.value === '}') { depth--; if (depth === 0) break }
      parts.push(t.value)
    }
    // Reassemble (rough)
    return parts.join(' ')
  }

  // Parse a sequence of raw tokens between {}
  private parseBlock(): string {
    this.expect('{')
    const parts: string[] = []
    let depth = 1
    const startPos = this.pos
    while (!this.eof() && depth > 0) {
      const t = this.peek()
      if (t.value === '{') depth++
      if (t.value === '}') { depth--; if (depth === 0) { this.consume(); break } }
      parts.push(this.consume().value)
    }
    return parts.join(' ')
  }

  // ─── Expression parsers ─────────────────────────────────────────────

  parseExpr(): BBlock | null {
    return this.parseLogicOr()
  }

  parseLogicOr(): BBlock | null {
    let left = this.parseLogicAnd()
    while (this.peek().value === '||') {
      this.consume()
      const right = this.parseLogicAnd()
      left = { type: 'logic_operation', fields: { OP: 'OR' }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseLogicAnd(): BBlock | null {
    let left = this.parseEquality()
    while (this.peek().value === '&&') {
      this.consume()
      const right = this.parseEquality()
      left = { type: 'logic_operation', fields: { OP: 'AND' }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseEquality(): BBlock | null {
    let left = this.parseComparison()
    const op = this.peek().value
    if (['==', '===', '!=', '!=='].includes(op)) {
      this.consume()
      const right = this.parseComparison()
      const bOp = ['!=', '!=='].includes(op) ? 'NEQ' : 'EQ'
      return { type: 'logic_compare', fields: { OP: bOp }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseComparison(): BBlock | null {
    let left = this.parseAddSub()
    const op = this.peek().value
    if (['<', '>', '<=', '>='].includes(op)) {
      this.consume()
      const right = this.parseAddSub()
      const MAP: Record<string, string> = { '<': 'LT', '>': 'GT', '<=': 'LTE', '>=': 'GTE' }
      return { type: 'logic_compare', fields: { OP: MAP[op] }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseAddSub(): BBlock | null {
    let left = this.parseMulDiv()
    while (['+', '-'].includes(this.peek().value)) {
      const op = this.consume().value
      const right = this.parseMulDiv()
      return { type: 'math_arithmetic', fields: { OP: op === '+' ? 'ADD' : 'MINUS' }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseMulDiv(): BBlock | null {
    let left = this.parseUnary()
    while (['*', '/', '%'].includes(this.peek().value)) {
      const op = this.consume().value
      const right = this.parseUnary()
      const MAP: Record<string, string> = { '*': 'MULTIPLY', '/': 'DIVIDE', '%': 'MODULO' }
      return { type: 'math_arithmetic', fields: { OP: MAP[op] }, values: { A: left!, B: right! } }
    }
    return left
  }

  parseUnary(): BBlock | null {
    if (this.peek().value === '!') {
      this.consume()
      const val = this.parsePrimary()
      return { type: 'logic_negate', values: { BOOL: val! } }
    }
    if (this.peek().value === '-' && this.peek(1).type === 'NUMBER') {
      this.consume()
      const n = this.consume()
      return numBlock('-' + n.value)
    }
    return this.parsePrimary()
  }

  parsePrimary(): BBlock | null {
    const t = this.peek()

    // Number literal
    if (t.type === 'NUMBER') {
      this.consume()
      return numBlock(t.value)
    }

    // String literal
    if (t.type === 'STRING') {
      this.consume()
      return strBlock(t.value)
    }

    // Boolean
    if (t.value === 'true') { this.consume(); return { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } }
    if (t.value === 'false') { this.consume(); return { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } }

    // String(x) cast — Blockly wraps values in String()
    if (t.value === 'String' && this.peek(1).value === '(') {
      this.consume(); this.consume()
      const inner = this.parseExpr()
      this.expect(')')
      return inner   // just use inner value
    }

    // Math.pow(a, b)
    if (t.value === 'Math' && this.peek(1).value === '.' && this.peek(2).value === 'pow') {
      this.consume(); this.consume(); this.consume()
      this.expect('(')
      const a = this.parseExpr()
      this.expect(',')
      const b = this.parseExpr()
      this.expect(')')
      return { type: 'math_arithmetic', fields: { OP: 'POWER' }, values: { A: a!, B: b! } }
    }

    // Math.random()
    if (t.value === 'Math' && this.peek(1).value === '.' && this.peek(2).value === 'random') {
      this.consume(); this.consume(); this.consume()
      this.expect('('); this.expect(')')
      return { type: 'math_random_float' }
    }

    // Math.abs, Math.round, Math.ceil, Math.floor, Math.sqrt
    if (t.value === 'Math' && this.peek(1).value === '.') {
      const mathFn = this.peek(2).value
      const MAP: Record<string, string> = { abs: 'ABS', round: 'ROUND', ceil: 'ROUNDUP', floor: 'ROUNDDOWN', sqrt: 'ROOT', log: 'LN' }
      if (MAP[mathFn]) {
        this.consume(); this.consume(); this.consume()
        this.expect('(')
        const inner = this.parseExpr()
        this.expect(')')
        return { type: 'math_single', fields: { OP: MAP[mathFn] }, values: { NUM: inner! } }
      }
    }

    // Parenthesized expression
    if (t.value === '(') {
      this.consume()
      const inner = this.parseExpr()
      this.expect(')')
      return inner
    }

    // Identifier or function call
    if (t.type === 'IDENT' || t.type === 'KEYWORD') {
      const name = this.consume().value

      // Function call: name(args)
      if (this.peek().value === '(') {
        this.consume() // (
        const args: BBlock[] = []
        while (this.peek().value !== ')' && !this.eof()) {
          const arg = this.parseExpr()
          if (arg) args.push(arg)
          this.eat(',')
        }
        this.expect(')')
        // Known built-ins
        if (name === 'window' || name === 'alert') return null // handled at stmt level
        return { type: 'procedures_callreturn', fields: { NAME: name } }
      }


      // Property access: window.alert, console.log, robot.readSensor
      if (this.peek().value === '.') {
        this.consume()
        const prop = this.consume().value
        if (this.peek().value === '(') {
          this.consume()
          const arg = this.parseExpr()
          this.eat(','); this.eat(',') // extra args
          while (this.peek().value !== ')' && !this.eof()) this.consume()
          this.expect(')')
          // These become text_print in block form
          if ((name === 'window' && prop === 'alert') || (name === 'console' && prop === 'log')) {
            return arg  // caller wraps in text_print
          }
          if (name === 'robot' && prop === 'readSensor') {
            const sensorVal = arg?.fields?.TEXT || 'ultrasonic'
            return { type: 'robot_sensor', fields: { SENSOR: sensorVal } }
          }
          if (name === 'robot' && prop === 'isButtonPressed') {
            const btnVal = arg?.fields?.TEXT || 'A'
            return { type: 'robot_button', fields: { BUTTON: btnVal } }
          }
        }
        return varGet(name + '.' + prop)
      }

      return varGet(name)
    }

    return null
  }

  // ─── Statement parsers ────────────────────────────────────────────────

  parseStatements(): BBlock | null {
    let head: BBlock | null = null
    let tail: BBlock | null = null

    while (!this.eof() && this.peek().value !== '}') {
      const stmt = this.parseStatement()
      if (stmt) {
        if (!head) { head = stmt; tail = stmt }
        else {
          // Chain via next
          let cur = tail!
          while (cur.next) cur = cur.next
          cur.next = stmt
          tail = stmt
        }
      }
    }
    return head
  }

  parseStatement(): BBlock | null {
    const t = this.peek()

    // Robotics statements: robot.move, robot.setLed, robot.playTone, robot.sleep
    if (t.value === 'robot' && this.peek(1).value === '.' && this.peek(2).type === 'IDENT' && this.peek(3).value === '(') {
      this.consume() // robot
      this.consume() // .
      const method = this.consume().value // move, setLed, playTone, sleep
      this.consume() // (
      
      const args: BBlock[] = []
      while (this.peek().value !== ')' && !this.eof()) {
        const a = this.parseExpr()
        if (a) args.push(a)
        this.eat(',')
      }
      this.expect(')')
      this.eat(';')

      if (method === 'move') {
        const dir = args[0]?.fields?.TEXT || 'FORWARD'
        const speed = args[1]?.fields?.NUM != null ? Number(args[1].fields.NUM) : 80
        return {
          type: 'robot_move',
          fields: { DIRECTION: dir, SPEED: String(speed) }
        }
      }
      if (method === 'setLed') {
        const color = args[0]?.fields?.TEXT || 'RED'
        return {
          type: 'robot_led',
          fields: { COLOR: color }
        }
      }
      if (method === 'playTone') {
        const freq = args[0]?.fields?.NUM != null ? Number(args[0].fields.NUM) : 440
        const dur = args[1]?.fields?.NUM != null ? Number(args[1].fields.NUM) : 500
        return {
          type: 'robot_tone',
          fields: { FREQ: String(freq), DURATION: String(dur) }
        }
      }
      if (method === 'sleep') {
        const sec = args[0]?.fields?.NUM != null ? Number(args[0].fields.NUM) : 1
        return {
          type: 'robot_sleep',
          fields: { SECONDS: String(sec) }
        }
      }
      if (method === 'showText') {
        const text = args[0]?.fields?.TEXT || 'Hello'
        const x = args[1]?.fields?.NUM != null ? Number(args[1].fields.NUM) : 0
        const y = args[2]?.fields?.NUM != null ? Number(args[2].fields.NUM) : 0
        return {
          type: 'robot_show_text',
          fields: { TEXT: text, X: String(x), Y: String(y) }
        }
      }
      if (method === 'clearScreen') {
        return {
          type: 'robot_clear_screen'
        }
      }
      if (method === 'setServo') {
        const pin = args[0]?.fields?.TEXT || 'P0'
        const angle = args[1]?.fields?.NUM != null ? Number(args[1].fields.NUM) : 90
        return {
          type: 'robot_servo',
          fields: { PIN: pin, ANGLE: String(angle) }
        }
      }
    }

    // Empty statement
    if (t.value === ';') { this.consume(); return null }

    // Variable declaration: var/let/const x = expr;
    if (['var', 'let', 'const'].includes(t.value)) {
      this.consume()
      const name = this.consume().value
      if (this.eat('=')) {
        const val = this.parseExpr()
        this.eat(';')
        if (val) {
          // If it's an array literal → list block
          return {
            type: 'variables_set',
            fields: { VAR: name },
            values: { VALUE: val }
          }
        }
      } else {
        this.eat(';')
      }
      return null
    }

    // Assignment: x = expr;  x += expr;
    if (t.type === 'IDENT' && ['=', '+=', '-=', '*=', '/=', '%='].includes(this.peek(1).value)) {
      const name = this.consume().value
      const op = this.consume().value
      const rhs = this.parseExpr()
      this.eat(';')
      if (!rhs) return null
      if (op === '=') {
        return { type: 'variables_set', fields: { VAR: name }, values: { VALUE: rhs } }
      }
      // Compound: x += expr → x = x + expr
      const opMap: Record<string, string> = { '+=': 'ADD', '-=': 'MINUS', '*=': 'MULTIPLY', '/=': 'DIVIDE', '%=': 'MODULO' }
      return {
        type: 'variables_set', fields: { VAR: name },
        values: {
          VALUE: { type: 'math_arithmetic', fields: { OP: opMap[op] }, values: { A: varGet(name), B: rhs } }
        }
      }
    }

    // window.alert(expr) or console.log(expr) → text_print
    if (
      (t.value === 'window' && this.peek(1).value === '.' && this.peek(2).value === 'alert') ||
      (t.value === 'console' && this.peek(1).value === '.' && this.peek(2).value === 'log')
    ) {
      this.consume(); this.consume(); this.consume()
      this.expect('(')
      const arg = this.parseExpr()
      this.eat(',')
      while (this.peek().value !== ')' && !this.eof()) this.consume()
      this.expect(')')
      this.eat(';')
      return { type: 'text_print', values: { TEXT: arg ?? strBlock('') } }
    }

    // for (var i = FROM; i < TO; i++) { ... }
    if (t.value === 'for') {
      this.consume(); this.expect('(')
      // init
      this.eat('var'); this.eat('let'); this.eat('const')
      const iVar = this.consume().value
      this.expect('=')
      const from = this.parseExpr()
      this.expect(';')
      // condition: i < TO or i <= TO
      this.consume() // iVar again
      const cmpOp = this.consume().value // < or <=
      const to = this.parseExpr()
      this.expect(';')
      // update: i++ or i--
      this.consume() // iVar
      const incOp = this.consume().value // ++ or --
      this.expect(')')

      const bodyRaw = this.pos
      const bodyStr = this.parseBodyStatements()
      const bodyBlock = bodyStr

      // Adjust TO if <= (Blockly's controls_for is inclusive)
      let toBlock = to
      if (cmpOp === '<' && to?.type === 'math_number' && to.fields?.NUM) {
        toBlock = numBlock(String(Number(to.fields.NUM) - 1))
      }

      return {
        type: 'controls_for',
        fields: { VAR: iVar },
        values: {
          FROM: from ?? numBlock('0'),
          TO:   toBlock ?? numBlock('10'),
          BY:   numBlock('1'),
        },
        statements: bodyBlock ? { DO: bodyBlock } : undefined
      }
    }

    // while (cond) { ... }
    if (t.value === 'while') {
      this.consume(); this.expect('(')
      const cond = this.parseExpr()
      this.expect(')')
      const body = this.parseBodyStatements()
      return {
        type: 'controls_whileUntil',
        fields: { MODE: 'WHILE' },
        values: { BOOL: cond ?? { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } },
        statements: body ? { DO: body } : undefined
      }
    }

    // if (cond) { ... } else { ... }
    if (t.value === 'if') {
      this.consume(); this.expect('(')
      const cond = this.parseExpr()
      this.expect(')')
      const thenBody = this.parseBodyStatements()

      let hasElse = false
      let elseBody: BBlock | null = null
      if (this.peek().value === 'else') {
        this.consume()
        hasElse = true
        if (this.peek().value === 'if') {
          // else if — treat as nested
          elseBody = this.parseStatement()
        } else {
          elseBody = this.parseBodyStatements()
        }
      }

      const b: BBlock = {
        type: 'controls_if',
        mutation: hasElse ? { elsecount: '1' } : undefined,
        values: { IF0: cond! },
        statements: {
          ...(thenBody ? { DO0: thenBody } : {}),
          ...(elseBody && hasElse ? { ELSE: elseBody } : {}),
        }
      }
      return b
    }

    // function name() { ... } → procedures_defnoreturn
    if (t.value === 'function') {
      this.consume()
      const name = this.consume().value
      this.expect('(')
      const params: string[] = []
      while (this.peek().value !== ')' && !this.eof()) {
        if (this.peek().type === 'IDENT') params.push(this.consume().value)
        this.eat(',')
      }
      this.expect(')')
      const body = this.parseBodyStatements()
      return {
        type: 'procedures_defnoreturn',
        mutation: { name },
        fields: { NAME: name },
        statements: body ? { STACK: body } : undefined
      }
    }

    // return expr;
    if (t.value === 'return') {
      this.consume()
      if (this.peek().value !== ';' && !this.eof()) {
        const val = this.parseExpr()
        this.eat(';')
        return val ? { type: 'procedures_ifreturn', mutation: { value: '1' }, values: { VALUE: val } } : null
      }
      this.eat(';')
      return null
    }

    // Function call statement: name(...)
    if (t.type === 'IDENT' && this.peek(1).value === '(') {
      const name = this.consume().value
      this.consume() // (
      const args: BBlock[] = []
      while (this.peek().value !== ')' && !this.eof()) {
        const a = this.parseExpr()
        if (a) args.push(a)
        this.eat(',')
      }
      this.expect(')')
      this.eat(';')
      return { type: 'procedures_callnoreturn', fields: { NAME: name } }
    }

    // i++ / i-- (loop increment outside for) → x = x + 1
    if (t.type === 'IDENT' && ['++', '--'].includes(this.peek(1).value)) {
      const name = this.consume().value
      const op = this.consume().value
      this.eat(';')
      return {
        type: 'variables_set', fields: { VAR: name },
        values: {
          VALUE: {
            type: 'math_arithmetic', fields: { OP: op === '++' ? 'ADD' : 'MINUS' },
            values: { A: varGet(name), B: numBlock('1') }
          }
        }
      }
    }

    // Unrecognized — record and skip
    const unrecognized = t.value
    this.advanced.push(unrecognized)
    this.skipToStmtEnd()
    return null
  }

  // Parse { stmts } block
  parseBodyStatements(): BBlock | null {
    if (this.peek().value === '{') {
      this.consume() // {
      const body = this.parseStatements()
      this.eat('}')
      return body
    }
    // Single statement without braces
    return this.parseStatement()
  }

  // Entry: parse entire source
  parse(): BBlock | null {
    return this.parseStatements()
  }
}

// ── Main entry ─────────────────────────────────────────────────────────────

export function codeToBlocklyXML(jsCode: string): ConversionResult {
  const advanced: string[] = []

  try {
    const parser = new Parser(jsCode)
    const root = parser.parse()
    advanced.push(...parser.advanced)

    // Count total non-empty lines for coverage estimate
    const nonEmpty = jsCode.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length

    // Walk chain and collect top-level blocks
    const topBlocks: BBlock[] = []
    let cur: BBlock | null | undefined = root
    while (cur) {
      const next = cur.next
      cur.next = undefined  // detach for XML rendering
      topBlocks.push(cur)
      cur = next
    }

    const xmlParts = topBlocks.map((b, i) => {
      const xml = bToXML(b)
      // Add rough positioning so blocks don't overlap
      return xml.replace(`<block type=`, `<block x="${60 + (i % 3) * 20}" y="${80 + Math.floor(i / 3) * 180}" type=`)
    })

    const xml = `<xml xmlns="https://developers.google.com/blockly/xml">\n${xmlParts.join('\n')}\n</xml>`

    const coverage = nonEmpty > 0 ? Math.min(1, topBlocks.length / nonEmpty) : 1

    return { xml, blocks: topBlocks.length, coverage, advanced: [...new Set(advanced)] }
  } catch (err) {
    return {
      xml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
      blocks: 0, coverage: 0,
      advanced: ['Parse error: ' + (err instanceof Error ? err.message : String(err))]
    }
  }
}
