export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  ext?: string
}

export interface Tab {
  id: string
  filePath: string
  fileName: string
  content: string
  language: string
  isDirty: boolean
  isNew?: boolean
}

export interface EditorSettings {
  theme: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  tabSize: number
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded'
  minimap: boolean
  lineNumbers: 'on' | 'off' | 'relative'
  formatOnSave: boolean
  autoSave: boolean
  autoSaveDelay: number
  pythonPath: string
  terminalShell: string
  uiZoom: number  // 0.75 – 1.5, default 1.15
}

export interface AIProvider {
  id: string
  name: string
  apiKey: string
  model: string
  enabled: boolean
  baseUrl?: string   // for Ollama / custom endpoints
}

export interface AgentConfig {
  id: string
  name: string
  emoji: string
  color: string          // accent color (CSS var or hex)
  description: string
  systemPrompt: string
  tools: string[]        // allowed tool names, [] = all
  providerId?: string    // preferred provider id
  isBuiltIn?: boolean    // built-in agents can't be deleted
}

export type KitsunePersona = 'beginner' | 'developer' | 'creative'

export interface KitsuneMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  id: number
  streaming?: boolean
  image?: string
  tokensIn?: number
  tokensOut?: number
  elapsed?: number   // ms
  attachedFileNames?: string[]
  attachedFolderNames?: string[]
  // tool-call activity (role: 'tool')
  tool?: string
  toolArgs?: Record<string, any>
  toolStatus?: 'running' | 'done' | 'error'
  toolResult?: string
}

export interface KitsuneSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: KitsuneMessage[]
  persona: KitsunePersona
  providerId: string
  contextUsed: number
  agentId?: string
}

export interface UsageEntry {
  date: string
  model: string
  providerId: string
  tokensIn: number
  tokensOut: number
}

export type ActivityBarItem =
  | 'explorer'
  | 'search'
  | 'kitsune'
  | 'settings'
  | 'blocks'
  | 'flow'
  | 'debug'
  | 'git'
  | 'snippets'
  | 'templates'
  | 'http'
  | 'packages'
  | 'scaffold'
  | 'database'
  | 'extensions'
  | 'todo'
  | 'outline'

export interface AppState {
  currentFolder: string | null
  fileTree: FileNode[]
  tabs: Tab[]
  activeTabId: string | null
  activePanel: ActivityBarItem
  settings: EditorSettings
  aiProviders: AIProvider[]
  sidebarWidth: number
  showSidebar: boolean
  showSecondarySidebar: boolean
  showBottomPanel: boolean
  bottomPanelHeight: number
  splitTabId: string | null
}
