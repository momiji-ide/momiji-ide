export interface RunConfig {
  command: string
  args: string[]
  label: string
}

const WIN = navigator.userAgent.includes('Win') || navigator.platform.startsWith('Win')

export function getRunConfig(filePath: string, language: string, pythonPath?: string): RunConfig | null {
  // Validate it's actually a file path, not a folder
  const isLikelyFile = filePath.includes('.') && !filePath.startsWith('__')
  if (!isLikelyFile) return null

  const fileName = filePath.split(/[\\/]/).pop() ?? ''

  switch (language) {
    case 'javascript':
      return { command: 'node', args: [filePath], label: 'Node.js' }

    case 'typescript':
      return {
        command: WIN ? 'npx.cmd' : 'npx',
        args: ['ts-node', filePath],
        label: 'ts-node'
      }

    case 'python':
      return {
        command: pythonPath ?? (WIN ? 'python' : 'python3'),
        args: [fileName],
        label: pythonPath ? `Python (${pythonPath.split(/[\\/]/).pop()})` : 'Python'
      }

    case 'go':
      return { command: 'go', args: ['run', fileName], label: 'Go' }

    case 'rust':
      return { command: 'cargo', args: ['run'], label: 'Cargo' }

    case 'php':
      return { command: 'php', args: [fileName], label: 'PHP' }

    case 'ruby':
      return { command: 'ruby', args: [fileName], label: 'Ruby' }

    case 'shell':
      return { command: 'bash', args: [fileName], label: 'Bash' }

    case 'java': {
      const className = fileName.replace('.java', '')
      return {
        command: WIN ? 'cmd' : 'sh',
        args: WIN
          ? ['/c', `javac "${fileName}" && java "${className}"`]
          : ['-c', `javac "${fileName}" && java "${className}"`],
        label: 'Java'
      }
    }

    case 'c': {
      const out = WIN ? 'program.exe' : './program.out'
      return {
        command: WIN ? 'cmd' : 'sh',
        args: WIN
          ? ['/c', `gcc "${fileName}" -o ${out} && ${out}`]
          : ['-c', `gcc "${fileName}" -o ${out} && ${out}`],
        label: 'GCC'
      }
    }

    case 'cpp': {
      const out = WIN ? 'program.exe' : './program.out'
      return {
        command: WIN ? 'cmd' : 'sh',
        args: WIN
          ? ['/c', `g++ "${fileName}" -o ${out} && ${out}`]
          : ['-c', `g++ "${fileName}" -o ${out} && ${out}`],
        label: 'G++'
      }
    }

    case 'csharp': {
      // Try dotnet-script for single files, fallback to dotnet run
      return {
        command: WIN ? 'cmd' : 'sh',
        args: WIN
          ? ['/c', `dotnet-script "${fileName}" || (csc "${fileName}" && "${fileName.replace('.cs','')}.exe")`]
          : ['-c', `dotnet-script "${fileName}" || (mcs "${fileName}" && mono "${fileName.replace('.cs','')}.exe")`],
        label: 'dotnet-script'
      }
    }

    case 'swift':
      return { command: 'swift', args: [fileName], label: 'Swift' }

    case 'kotlin': {
      const jarName = fileName.replace('.kt', '.jar')
      return {
        command: WIN ? 'cmd' : 'sh',
        args: WIN
          ? ['/c', `kotlinc "${fileName}" -include-runtime -d "${jarName}" && java -jar "${jarName}"`]
          : ['-c', `kotlinc "${fileName}" -include-runtime -d "${jarName}" && java -jar "${jarName}"`],
        label: 'Kotlin'
      }
    }

    case 'r':
      return { command: 'Rscript', args: [fileName], label: 'R' }

    case 'lua':
      return { command: 'lua', args: [fileName], label: 'Lua' }

    case 'dart':
      return { command: 'dart', args: ['run', fileName], label: 'Dart' }

    case 'powershell':
      return { command: 'powershell', args: ['-ExecutionPolicy', 'Bypass', '-File', fileName], label: 'PowerShell' }

    case 'html':
    case 'css':
      return null // handled by Live Preview

    default:
      return null
  }
}

export function ansiToHtml(text: string): string {
  const colorMap: Record<string, string> = {
    '30': '#585b70', '31': '#f38ba8', '32': '#a6e3a1', '33': '#f9e2af',
    '34': '#89b4fa', '35': '#cba6f7', '36': '#94e2d5', '37': '#cdd6f4',
    '90': '#6c7086', '91': '#f38ba8', '92': '#a6e3a1', '93': '#f9e2af',
    '94': '#89b4fa', '95': '#cba6f7', '96': '#94e2d5', '97': '#cdd6f4'
  }

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  let result = ''
  let openSpan = false
  const parts = escaped.split(/\x1B\[([0-9;]*)m/)

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i]
    } else {
      if (openSpan) { result += '</span>'; openSpan = false }
      const codes = parts[i].split(';')
      const styles: string[] = []
      for (const code of codes) {
        if (code === '0' || code === '') continue
        if (colorMap[code]) styles.push(`color:${colorMap[code]}`)
        if (code === '1') styles.push('font-weight:bold')
        if (code === '3') styles.push('font-style:italic')
        if (code === '4') styles.push('text-decoration:underline')
      }
      if (styles.length) { result += `<span style="${styles.join(';')}">`;  openSpan = true }
    }
  }
  if (openSpan) result += '</span>'
  return result
}
