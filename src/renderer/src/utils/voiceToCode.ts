interface VoiceResult {
  code: string
  description: string
}

export function processVoiceCommand(transcript: string, language: string): VoiceResult {
  const cmd = transcript.toLowerCase().trim()
  const lang = language

  // ── Function ─────────────────────────────────────────
  const funcMatch = cmd.match(/(?:create|make|add|define) (?:a |an )?function (?:called |named )?(\w+)/)
  if (funcMatch) {
    const name = funcMatch[1]
    if (lang === 'python') return { code: `def ${name}():\n    pass`, description: `Created function: ${name}` }
    return { code: `function ${name}() {\n  \n}`, description: `Created function: ${name}` }
  }

  // ── Variable ─────────────────────────────────────────
  const varMatch = cmd.match(/(?:create|declare|make) (?:a |an )?(?:variable|var) (?:called |named )?(\w+)/)
  if (varMatch) {
    const name = varMatch[1]
    if (lang === 'python') return { code: `${name} = `, description: `Declared variable: ${name}` }
    return { code: `let ${name} = `, description: `Declared variable: ${name}` }
  }

  // ── Console log / print ───────────────────────────────
  if (cmd.includes('console log') || cmd.includes('print ') || cmd.match(/^log\b/)) {
    const val = cmd.replace(/(?:console\s*log|print|^log)\s*/i, '').trim()
    if (lang === 'python') return { code: `print(${val ? `"${val}"` : ''})`, description: 'Added print statement' }
    return { code: `console.log(${val ? `"${val}"` : ''})`, description: 'Added console.log' }
  }

  // ── If/else ───────────────────────────────────────────
  if (cmd.includes('if else') || cmd.includes('if statement') || cmd.includes('if condition')) {
    if (lang === 'python') return { code: `if condition:\n    pass\nelse:\n    pass`, description: 'Added if/else' }
    return { code: `if (condition) {\n  \n} else {\n  \n}`, description: 'Added if/else' }
  }
  if (cmd.startsWith('if ') && !cmd.startsWith('if statement')) {
    const cond = cmd.replace(/^if\s+/, '')
    if (lang === 'python') return { code: `if ${cond || 'condition'}:\n    pass`, description: 'Added if statement' }
    return { code: `if (${cond || 'condition'}) {\n  \n}`, description: 'Added if statement' }
  }

  // ── For loop ─────────────────────────────────────────
  if (cmd.includes('for loop') || cmd.includes('repeat') || cmd.includes('for each')) {
    const timesMatch = cmd.match(/(\d+)\s*times?/)
    const times = timesMatch ? timesMatch[1] : '10'
    if (lang === 'python') return { code: `for i in range(${times}):\n    pass`, description: `For loop ${times} times` }
    return { code: `for (let i = 0; i < ${times}; i++) {\n  \n}`, description: `For loop ${times} times` }
  }

  // ── While loop ────────────────────────────────────────
  if (cmd.includes('while loop') || cmd.startsWith('while ')) {
    if (lang === 'python') return { code: `while condition:\n    pass`, description: 'Added while loop' }
    return { code: `while (condition) {\n  \n}`, description: 'Added while loop' }
  }

  // ── Arrow function ───────────────────────────────────
  if (cmd.includes('arrow function')) {
    const arrowMatch = cmd.match(/arrow function (?:called |named )?(\w+)?/)
    const name = arrowMatch?.[1] ?? 'myFunc'
    return { code: `const ${name} = () => {\n  \n}`, description: `Created arrow function: ${name}` }
  }

  // ── Class ─────────────────────────────────────────────
  const classMatch = cmd.match(/(?:create|make) (?:a |an )?class (?:called |named )?(\w+)?/)
  if (classMatch) {
    const name = classMatch[1] ?? 'MyClass'
    if (lang === 'python') return { code: `class ${name}:\n    def __init__(self):\n        pass`, description: `Created class: ${name}` }
    return { code: `class ${name} {\n  constructor() {\n    \n  }\n}`, description: `Created class: ${name}` }
  }

  // ── Import ────────────────────────────────────────────
  if (cmd.startsWith('import')) {
    const importMatch = cmd.match(/import (\w+)(?: from (\w+))?/)
    const mod = importMatch?.[2] ?? importMatch?.[1] ?? 'module'
    const name = importMatch?.[1] ?? mod
    if (lang === 'python') return { code: `import ${mod}`, description: `Import ${mod}` }
    return { code: `import { ${name} } from '${mod}'`, description: `Import from ${mod}` }
  }

  // ── Try/catch ─────────────────────────────────────────
  if (cmd.includes('try catch') || cmd.includes('try except')) {
    if (lang === 'python') return { code: `try:\n    pass\nexcept Exception as e:\n    print(e)`, description: 'Added try/except' }
    return { code: `try {\n  \n} catch (error) {\n  console.error(error)\n}`, description: 'Added try/catch' }
  }

  // ── Return ────────────────────────────────────────────
  if (cmd.startsWith('return')) {
    const val = cmd.replace(/^return\s*/, '')
    return { code: `return ${val}`, description: 'Return statement' }
  }

  // ── Switch ────────────────────────────────────────────
  if (cmd.includes('switch') || cmd.includes('switch statement')) {
    return { code: `switch (value) {\n  case 'a':\n    break\n  default:\n    break\n}`, description: 'Added switch statement' }
  }

  // ── Array/list ────────────────────────────────────────
  if (cmd.includes('empty array') || cmd.includes('new array')) {
    const nameMatch = cmd.match(/(?:called|named) (\w+)/)
    const name = nameMatch?.[1] ?? 'items'
    if (lang === 'python') return { code: `${name} = []`, description: `Created list: ${name}` }
    return { code: `const ${name} = []`, description: `Created array: ${name}` }
  }

  // ── Object ────────────────────────────────────────────
  if (cmd.includes('empty object') || cmd.includes('new object')) {
    const nameMatch = cmd.match(/(?:called|named) (\w+)/)
    const name = nameMatch?.[1] ?? 'obj'
    if (lang === 'python') return { code: `${name} = {}`, description: `Created dict: ${name}` }
    return { code: `const ${name} = {}`, description: `Created object: ${name}` }
  }

  // ── Default: comment ────────────────────────────────
  const sym = lang === 'python' ? '#' : '//'
  return { code: `${sym} ${transcript}`, description: 'Added as comment (command not recognized)' }
}

export function startVoiceRecognition(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (error: string) => void
): (() => void) | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) {
    onError('not-supported')
    onEnd()
    return null
  }

  const recognition = new SR()
  recognition.continuous = false
  recognition.lang = 'en-US'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onresult = (e: any) => {
    const transcript: string = e.results[0][0].transcript
    onResult(transcript)
  }

  recognition.onend = () => {
    onEnd()
  }

  recognition.onerror = (e: any) => {
    onError(e.error ?? 'unknown')
    // onend fires after onerror automatically
  }

  try {
    recognition.start()
  } catch (e) {
    onError('start-failed')
    onEnd()
    return null
  }

  return () => {
    try { recognition.abort() } catch {}
  }
}
