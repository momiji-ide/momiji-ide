import {
  Folder, FolderOpen, FileCode, FileText, FileJson,
  FileImage, File, Database, FileType, Settings,
  Terminal, GitBranch, Package, Globe
} from 'lucide-react'

interface Props { name: string; isDir?: boolean; isOpen?: boolean; size?: number }

const EXT_CONFIG: Record<string, { color: string; Icon: React.FC<any> }> = {
  // JavaScript / TypeScript
  js:    { color: '#f9e2af', Icon: FileCode },
  jsx:   { color: '#f9e2af', Icon: FileCode },
  ts:    { color: '#89b4fa', Icon: FileCode },
  tsx:   { color: '#89b4fa', Icon: FileCode },
  // Python
  py:    { color: '#a6e3a1', Icon: FileCode },
  pyw:   { color: '#a6e3a1', Icon: FileCode },
  // Systems
  c:     { color: '#74c7ec', Icon: FileCode },
  cpp:   { color: '#74c7ec', Icon: FileCode },
  cc:    { color: '#74c7ec', Icon: FileCode },
  cxx:   { color: '#74c7ec', Icon: FileCode },
  h:     { color: '#89dceb', Icon: FileCode },
  hpp:   { color: '#89dceb', Icon: FileCode },
  // C# / Java / Kotlin
  cs:    { color: '#cba6f7', Icon: FileCode },
  java:  { color: '#fab387', Icon: FileCode },
  kt:    { color: '#cba6f7', Icon: FileCode },
  kts:   { color: '#cba6f7', Icon: FileCode },
  // Go / Rust
  go:    { color: '#94e2d5', Icon: FileCode },
  rs:    { color: '#fab387', Icon: FileCode },
  // Web
  html:  { color: '#fab387', Icon: Globe },
  htm:   { color: '#fab387', Icon: Globe },
  css:   { color: '#89b4fa', Icon: FileCode },
  scss:  { color: '#f5c2e7', Icon: FileCode },
  sass:  { color: '#f5c2e7', Icon: FileCode },
  less:  { color: '#89b4fa', Icon: FileCode },
  vue:   { color: '#a6e3a1', Icon: FileCode },
  svelte:{ color: '#fab387', Icon: FileCode },
  // Data
  json:  { color: '#f9e2af', Icon: FileJson },
  jsonc: { color: '#f9e2af', Icon: FileJson },
  yaml:  { color: '#a6e3a1', Icon: FileText },
  yml:   { color: '#a6e3a1', Icon: FileText },
  toml:  { color: '#fab387', Icon: Settings },
  xml:   { color: '#f9e2af', Icon: FileCode },
  csv:   { color: '#a6e3a1', Icon: FileText },
  // Database
  sql:   { color: '#89b4fa', Icon: Database },
  db:    { color: '#74c7ec', Icon: Database },
  sqlite:{ color: '#74c7ec', Icon: Database },
  // Docs
  md:    { color: '#cdd6f4', Icon: FileText },
  mdx:   { color: '#cdd6f4', Icon: FileText },
  txt:   { color: '#a6adc8', Icon: FileText },
  pdf:   { color: '#f38ba8', Icon: FileText },
  // Shell
  sh:    { color: '#a6e3a1', Icon: Terminal },
  bash:  { color: '#a6e3a1', Icon: Terminal },
  zsh:   { color: '#a6e3a1', Icon: Terminal },
  fish:  { color: '#a6e3a1', Icon: Terminal },
  ps1:   { color: '#89b4fa', Icon: Terminal },
  // Config
  env:   { color: '#f9e2af', Icon: Settings },
  gitignore: { color: '#f38ba8', Icon: GitBranch },
  dockerfile: { color: '#89b4fa', Icon: Package },
  lock:  { color: '#585b70', Icon: File },
  // Images
  png:   { color: '#cba6f7', Icon: FileImage },
  jpg:   { color: '#cba6f7', Icon: FileImage },
  jpeg:  { color: '#cba6f7', Icon: FileImage },
  gif:   { color: '#cba6f7', Icon: FileImage },
  svg:   { color: '#f5c2e7', Icon: FileImage },
  webp:  { color: '#cba6f7', Icon: FileImage },
  // Other languages
  rb:    { color: '#f38ba8', Icon: FileCode },
  php:   { color: '#cba6f7', Icon: FileCode },
  swift: { color: '#fab387', Icon: FileCode },
  dart:  { color: '#89b4fa', Icon: FileCode },
  r:     { color: '#89b4fa', Icon: FileCode },
  lua:   { color: '#cba6f7', Icon: FileCode },
  // Package files
  'package.json': { color: '#f9e2af', Icon: Package },
  'cargo.toml':   { color: '#fab387', Icon: Package },
  'go.mod':       { color: '#94e2d5', Icon: Package },
}

const DIR_COLORS: Record<string, string> = {
  src: '#89b4fa', components: '#cba6f7', pages: '#f9e2af',
  api: '#a6e3a1', styles: '#f5c2e7', utils: '#94e2d5',
  tests: '#f38ba8', test: '#f38ba8', '__tests__': '#f38ba8',
  public: '#a6e3a1', assets: '#cba6f7', images: '#cba6f7',
  node_modules: '#45475a', '.git': '#45475a', dist: '#45475a',
  build: '#45475a', out: '#45475a',
}

export function FileIcon({ name, isDir, isOpen, size = 14 }: Props) {
  if (isDir) {
    const color = DIR_COLORS[name.toLowerCase()] ?? '#89b4fa'
    const Icon = isOpen ? FolderOpen : Folder
    return <Icon size={size} style={{ color, flexShrink: 0 }} />
  }

  const lower = name.toLowerCase()

  // Check full filename first (e.g. package.json)
  if (EXT_CONFIG[lower]) {
    const { color, Icon } = EXT_CONFIG[lower]
    return <Icon size={size} style={{ color, flexShrink: 0 }} />
  }

  // Check extension
  const ext = lower.split('.').pop() ?? ''
  if (EXT_CONFIG[ext]) {
    const { color, Icon } = EXT_CONFIG[ext]
    return <Icon size={size} style={{ color, flexShrink: 0 }} />
  }

  return <File size={size} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
}
