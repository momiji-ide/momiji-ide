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

export type ActivityBarItem =
  | 'explorer'
  | 'search'
  | 'ai'
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
  showBottomPanel: boolean
  bottomPanelHeight: number
  splitTabId: string | null
}
