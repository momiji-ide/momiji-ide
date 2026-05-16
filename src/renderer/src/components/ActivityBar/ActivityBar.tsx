import { useAppStore } from '../../store/appStore'
import type { ActivityBarItem } from '../../types'
import {
  IcoExplorer, IcoSearch, IcoScaffold, IcoTemplates, IcoPackages,
  IcoHttp, IcoBlocks, IcoFlow, IcoDebug, IcoGit, IcoSnippets,
  IcoAI, IcoDatabase, IcoExtensions, IcoSettings, IcoTodo, IcoOutline
} from './Icons'

interface NavItem {
  id: ActivityBarItem
  icon: React.ReactNode
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'explorer',   icon: <IcoExplorer />,   label: 'Explorer' },
  { id: 'search',     icon: <IcoSearch />,     label: 'Search in Files' },
  { id: 'git',        icon: <IcoGit />,        label: 'Source Control' },
  { id: 'debug',      icon: <IcoDebug />,      label: 'Time-Travel Debugger' },
  { id: 'extensions', icon: <IcoExtensions />, label: 'Extensions' },
]

const MID_ITEMS: NavItem[] = [
  { id: 'ai',        icon: <IcoAI />,        label: 'Kitsune AI' },
  { id: 'outline',   icon: <IcoOutline />,   label: 'Symbol Outline' },
  { id: 'todo',      icon: <IcoTodo />,      label: 'TODO / Tasks' },
  { id: 'http',      icon: <IcoHttp />,      label: 'HTTP Client' },
  { id: 'blocks',    icon: <IcoBlocks />,    label: 'Block Editor' },
  { id: 'flow',      icon: <IcoFlow />,      label: 'Visual Flow' },
  { id: 'database',  icon: <IcoDatabase />,  label: 'SQLite Browser' },
  { id: 'packages',  icon: <IcoPackages />,  label: 'Package Manager' },
  { id: 'scaffold',  icon: <IcoScaffold />,  label: 'New Project' },
  { id: 'templates', icon: <IcoTemplates />, label: 'Template Gallery' },
  { id: 'snippets',  icon: <IcoSnippets />,  label: 'Snippets' },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', icon: <IcoSettings />, label: 'Settings' }
]

export function ActivityBar() {
  const activePanel = useAppStore(s => s.activePanel)
  const showSidebar = useAppStore(s => s.showSidebar)
  const setActivePanel = useAppStore(s => s.setActivePanel)

  return (
    <div
      className="flex flex-col items-center justify-between py-2 w-12 flex-shrink-0"
      style={{ background: 'var(--bg-crust)', borderRight: '1px solid var(--border)' }}
    >
      {/* Top — VS Code primary items */}
      <div className="flex flex-col items-center gap-0.5">
        {TOP_ITEMS.map(item => (
          <Btn key={item.id} item={item}
            isActive={activePanel === item.id && showSidebar}
            onClick={() => setActivePanel(item.id)} />
        ))}

        {/* Divider */}
        <div className="w-6 my-1" style={{ height: 1, background: 'var(--border)' }} />

        {/* Mid — tools */}
        {MID_ITEMS.map(item => (
          <Btn key={item.id} item={item}
            isActive={activePanel === item.id && showSidebar}
            onClick={() => setActivePanel(item.id)} />
        ))}
      </div>

      {/* Bottom — settings */}
      <div className="flex flex-col items-center gap-0.5">
        {BOTTOM_ITEMS.map(item => (
          <Btn key={item.id} item={item}
            isActive={activePanel === item.id && showSidebar}
            onClick={() => setActivePanel(item.id)} />
        ))}
      </div>
    </div>
  )
}

function Btn({ item, isActive, onClick }: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-all"
      style={{
        background: isActive ? 'var(--bg-surface0)' : 'transparent',
        color: isActive ? 'var(--accent-blue)' : 'var(--text-subtle)',
        borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--bg-surface0)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-subtle)'
        }
      }}
    >
      {item.icon}
    </button>
  )
}
