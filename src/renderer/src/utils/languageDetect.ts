const extMap: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.jsonc': 'json',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.r': 'r',
  '.dart': 'dart',
  '.lua': 'lua',
  '.vim': 'plaintext',
  '.dockerfile': 'dockerfile',
  '.tf': 'plaintext',
  '.vue': 'html',
  '.svelte': 'html',
  '.env': 'plaintext',
  '.gitignore': 'plaintext',
  '.txt': 'plaintext'
}

export function detectLanguage(fileName: string): string {
  const lowerName = fileName.toLowerCase()
  if (lowerName === 'dockerfile') return 'dockerfile'
  if (lowerName === 'makefile') return 'plaintext'
  const ext = '.' + lowerName.split('.').pop()
  return extMap[ext] ?? 'plaintext'
}

export function getFileIcon(fileName: string, isDirectory?: boolean): string {
  if (isDirectory) return '📁'
  const ext = '.' + fileName.toLowerCase().split('.').pop()
  const icons: Record<string, string> = {
    '.js': '🟨', '.jsx': '🟨', '.ts': '🔷', '.tsx': '🔷',
    '.py': '🐍', '.rs': '🦀', '.go': '🐹', '.java': '☕',
    '.c': '🔵', '.cpp': '🔵', '.cc': '🔵', '.h': '🔵', '.hpp': '🔵',
    '.cs': '🟣', '.swift': '🟠', '.kt': '🟣', '.kts': '🟣',
    '.html': '🌐', '.css': '🎨', '.scss': '🎨', '.vue': '💚',
    '.json': '📋', '.md': '📝', '.sql': '🗄️', '.db': '🗄️',
    '.sh': '⚡', '.yaml': '⚙️', '.yml': '⚙️', '.ps1': '🔷',
    '.env': '🔐', '.gitignore': '🚫', '.toml': '⚙️',
    '.lua': '🌙', '.r': '📊', '.dart': '🎯', '.rb': '💎',
    '.php': '🐘', '.dockerfile': '🐳',
    '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.svg': '🖼️', '.gif': '🖼️',
    '.zip': '📦', '.tar': '📦', '.gz': '📦'
  }
  return icons[ext] ?? '📄'
}
