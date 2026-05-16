export interface DebugSnapshot {
  step: number
  line: number
  col: number
  vars: Record<string, unknown>
  output: string[]
  callStack: string[]
  timestamp: number
}

/**
 * Instruments JS code to capture state snapshots at each statement.
 * Strategy: split on semicolons/newlines, inject __snap() calls.
 */
export function instrumentJS(code: string): string {
  const lines = code.split('\n')
  const instrumented: string[] = []

  instrumented.push(`
const __snapshots = [];
const __output = [];
let __stepIdx = 0;
const __originalLog = console.log.bind(console);
console.log = (...args) => {
  const str = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  __output.push(str);
  __originalLog(...args);
};
function __snap(line, col, scopeSnapshot) {
  __snapshots.push({
    step: __stepIdx++,
    line,
    col,
    vars: Object.assign({}, scopeSnapshot),
    output: [...__output],
    callStack: [],
    timestamp: Date.now()
  });
}
function __getVars() {
  try { return {}; } catch(e) { return {}; }
}
`)

  // Simple line-by-line instrumentation
  // Insert __snap() before each non-empty, non-comment statement line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines, comments, braces-only
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed === '{' || trimmed === '}' || trimmed === '};' || trimmed === ');') {
      instrumented.push(line)
      continue
    }

    // Insert snap before the statement
    const lineNum = i + 1
    instrumented.push(`__snap(${lineNum}, 0, typeof __captureScope === 'function' ? __captureScope() : {});`)
    instrumented.push(line)
  }

  instrumented.push(`
// Restore console.log
console.log = __originalLog;
__snapshots; // Return value
`)

  return instrumented.join('\n')
}

/**
 * Build the HTML for the sandboxed iframe that runs instrumented code.
 */
export function buildSandboxHTML(instrumentedCode: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
  window.onerror = function(msg, src, line, col, err) {
    window.parent.postMessage({
      type: 'error',
      message: msg,
      line: line,
      col: col
    }, '*');
    return true;
  };

  (function() {
    const snapshots = [];
    const output = [];
    let stepIdx = 0;

    const __originalLog = console.log.bind(console);
    console.log = function(...args) {
      const str = args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a); }
        catch(e) { return String(a); }
      }).join(' ');
      output.push(str);
    };

    function __snap(line, col, vars) {
      snapshots.push({
        step: stepIdx++,
        line: line,
        col: col,
        vars: vars,
        output: [...output],
        timestamp: Date.now()
      });
    }

    try {
${instrumentedCode}
    } catch(err) {
      window.parent.postMessage({
        type: 'error',
        message: err.message || String(err),
        line: err.lineNumber || 0,
        col: 0
      }, '*');
    }

    window.parent.postMessage({
      type: 'snapshots',
      data: snapshots,
      finalOutput: [...output]
    }, '*');
  })();
</script>
</body>
</html>`
}

/**
 * Simpler approach: directly eval the code with manual variable capture.
 * We parse assignments and track variables mentioned in each line.
 */
export function extractMentionedVars(line: string): string[] {
  const identPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g
  const keywords = new Set(['let', 'const', 'var', 'if', 'else', 'for', 'while', 'function', 'return', 'true', 'false', 'null', 'undefined', 'new', 'this', 'typeof', 'instanceof', 'in', 'of', 'break', 'continue', 'switch', 'case', 'default', 'try', 'catch', 'finally', 'throw', 'class', 'extends', 'import', 'export', 'async', 'await', 'yield', 'console', 'log', 'Math', 'parseInt', 'parseFloat', 'String', 'Number', 'Boolean', 'Array', 'Object'])
  const vars: string[] = []
  let m: RegExpExecArray | null
  while ((m = identPattern.exec(line)) !== null) {
    if (!keywords.has(m[1])) vars.push(m[1])
  }
  return [...new Set(vars)]
}

/**
 * Advanced instrumentation: capture variable scope by injecting
 * variable capture expressions into the code.
 */
export function buildInstrumentedCode(userCode: string): string {
  const lines = userCode.split('\n')
  const result: string[] = []

  // Track declared variables per scope
  const declaredVars = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    const lineNum = i + 1

    // Extract newly declared variables
    const letMatch = trimmed.match(/^(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$,\s]*?)(?:\s*=|\s*;|$)/)
    if (letMatch) {
      const names = letMatch[1].split(',').map(n => n.trim().split('=')[0].trim())
      names.forEach(n => { if (n) declaredVars.add(n) })
    }

    // Check for assignment to known var
    const assignMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\+|-|\*|\/|%)?=/)
    if (assignMatch) declaredVars.add(assignMatch[1])

    result.push(raw)

    // Insert snap after meaningful statements
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && trimmed !== '{' && trimmed !== '}' && trimmed !== '};') {
      const snapVars = [...declaredVars]
        .map(v => `"${v}": (function(){ try { return ${v}; } catch(e) { return undefined; } })()`)
        .join(', ')

      result.push(`try { __snap(${lineNum}, 0, { ${snapVars} }); } catch(e) {}`)
    }
  }

  return result.join('\n')
}
