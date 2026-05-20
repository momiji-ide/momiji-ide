import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, Tab, FileNode, EditorSettings, AIProvider, ActivityBarItem, AgentConfig } from '../types'
import { detectLanguage } from '../utils/languageDetect'

const defaultSettings: EditorSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  formatOnSave: false,
  autoSave: true,
  autoSaveDelay: 1000,
  pythonPath: 'python',
  terminalShell: navigator.userAgent.includes('Win') ? 'powershell' : 'bash',
  uiZoom: 1.15,
}

interface AppStore extends AppState {
  // Folder actions
  setCurrentFolder: (folder: string | null) => void
  setFileTree: (tree: FileNode[]) => void

  // Tab actions
  openTab: (filePath: string, fileName: string, content: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  markTabClean: (tabId: string) => void
  closeAllTabs: () => void

  // UI actions
  setActivePanel: (panel: ActivityBarItem) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleBottomPanel: () => void
  setBottomPanelHeight: (height: number) => void
  setSplitTabId: (id: string | null) => void

  // Settings actions
  updateSettings: (settings: Partial<EditorSettings>) => void
  loadWorkspaceSettings: (folder: string) => Promise<void>
  saveWorkspaceSettings: () => Promise<void>

  // AI actions
  setAIProviders: (providers: AIProvider[]) => void
  updateAIProvider: (provider: AIProvider) => void

  // Agent management
  customAgents: AgentConfig[]
  addAgent: (agent: AgentConfig) => void
  updateAgent: (agent: AgentConfig) => void
  deleteAgent: (id: string) => void

  // Kitsune quick-ask (right-click from editor)
  pendingAIPrompt: string | null
  setPendingAIPrompt: (prompt: string | null) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentFolder: null,
      fileTree: [],
      tabs: [],
      activeTabId: null,
      activePanel: 'explorer',
      settings: defaultSettings,
      aiProviders: [
        { id: 'claude',     name: 'Claude (Anthropic)', apiKey: '', model: 'claude-sonnet-4-5',        enabled: false },
        { id: 'gemini',     name: 'Gemini (Google)',    apiKey: '', model: 'gemini-3.1-flash-lite',           enabled: false },
        { id: 'openai',     name: 'GPT (OpenAI)',       apiKey: '', model: 'gpt-4o-mini',               enabled: false },
        { id: 'groq',       name: 'Groq (Free)',        apiKey: '', model: 'llama-3.3-70b-versatile',   enabled: false },
        { id: 'openrouter', name: 'OpenRouter',         apiKey: '', model: 'meta-llama/llama-3.3-70b-instruct:free', enabled: false },
        { id: 'deepseek',   name: 'DeepSeek',           apiKey: '', model: 'deepseek-chat',             enabled: false },
        { id: 'mistral',    name: 'Mistral AI',         apiKey: '', model: 'mistral-small-latest',      enabled: false },
        { id: 'ollama',     name: 'Ollama (Local)',     apiKey: '', model: 'qwen2.5-coder:7b',          enabled: false, baseUrl: 'http://localhost:11434' },
        { id: 'custom',     name: 'Custom (OpenAI Compatible)', apiKey: '', model: 'gpt-4o',            enabled: false, baseUrl: 'https://api.openai.com' },
      ],
      sidebarWidth: 260,
      showSidebar: true,
      showBottomPanel: false,
      bottomPanelHeight: 220,
      splitTabId: null,
      pendingAIPrompt: null,

      setCurrentFolder: (folder) => {
        set({ currentFolder: folder })
        if (folder) get().loadWorkspaceSettings(folder)
      },
      setFileTree: (tree) => set({ fileTree: tree }),

      openTab: (filePath, fileName, content) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.filePath === filePath)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          filePath,
          fileName,
          content,
          language: detectLanguage(fileName),
          isDirty: false
        }
        set({ tabs: [...tabs, newTab], activeTabId: newTab.id })
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const idx = tabs.findIndex((t) => t.id === tabId)
        const newTabs = tabs.filter((t) => t.id !== tabId)
        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          if (newTabs.length === 0) newActiveId = null
          else if (idx > 0) newActiveId = newTabs[idx - 1].id
          else newActiveId = newTabs[0].id
        }
        set({ tabs: newTabs, activeTabId: newActiveId })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTabContent: (tabId, content) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, content, isDirty: true } : t
          )
        }))
      },

      markTabClean: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: false } : t
          )
        }))
      },

      closeAllTabs: () => set({ tabs: [], activeTabId: null }),

      setActivePanel: (panel) => {
        const { activePanel, showSidebar } = get()
        if (activePanel === panel && showSidebar) {
          set({ showSidebar: false })
        } else {
          set({ activePanel: panel, showSidebar: true })
        }
      },

      toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleBottomPanel: () => set((s) => ({ showBottomPanel: !s.showBottomPanel })),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
      setSplitTabId: (id) => set({ splitTabId: id }),

      updateSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),

      loadWorkspaceSettings: async (folder) => {
        try {
          const result = await window.api.fs.readFile(`${folder}/.momiji/settings.json`)
          if (result.content) {
            const ws = JSON.parse(result.content) as Partial<EditorSettings>
            set((s) => ({ settings: { ...s.settings, ...ws } }))
          }
        } catch { /* no workspace settings */ }
      },

      saveWorkspaceSettings: async () => {
        const { currentFolder, settings } = get()
        if (!currentFolder) return
        const dir = `${currentFolder}/.momiji`
        await window.api.fs.createFolder(dir)
        await window.api.fs.writeFile(`${dir}/settings.json`, JSON.stringify({
          fontSize: settings.fontSize,
          tabSize: settings.tabSize,
          wordWrap: settings.wordWrap,
          pythonPath: settings.pythonPath,
          terminalShell: settings.terminalShell
        }, null, 2))
      },

      setAIProviders: (providers) => set({ aiProviders: providers }),
      updateAIProvider: (provider) =>
        set((s) => ({
          aiProviders: s.aiProviders.map((p) => (p.id === provider.id ? provider : p))
        })),

      customAgents: [],
      addAgent: (agent) => set((s) => ({ customAgents: [...s.customAgents, agent] })),
      updateAgent: (agent) => set((s) => ({
        customAgents: s.customAgents.map((a) => a.id === agent.id ? agent : a)
      })),
      deleteAgent: (id) => set((s) => ({
        customAgents: s.customAgents.filter((a) => a.id !== id)
      })),

      setPendingAIPrompt: (prompt) => set({ pendingAIPrompt: prompt }),
    }),
    {
      name: 'momiji-store',
      // Merge persisted state with current defaults so new fields always get values
      merge: (persisted: any, current) => {
        // Migrate deprecated Gemini models that don't work on free tier
        const DEPRECATED_MODELS: Record<string, string> = {
          'gemini-pro': 'gemini-1.5-flash',
        }
        const migratedProviders = current.aiProviders.map((curr: any) => {
          const saved = (persisted?.aiProviders ?? []).find((p: any) => p.id === curr.id)
          if (!saved) return curr
          const model = DEPRECATED_MODELS[saved.model] ?? saved.model
          return { ...curr, ...saved, model }
        })
        return {
          ...current,
          ...persisted,
          settings: { ...current.settings, ...(persisted?.settings ?? {}) },
          aiProviders: migratedProviders
        }
      },
      partialize: (state) => ({
        settings: state.settings,
        aiProviders: state.aiProviders,
        customAgents: state.customAgents,
        sidebarWidth: state.sidebarWidth,
        showSidebar: state.showSidebar,
        bottomPanelHeight: state.bottomPanelHeight
      })
    }
  )
)
