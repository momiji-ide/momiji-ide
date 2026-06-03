import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { MomijiLogo } from '../Logo/MomijiLogo'
import { toast } from '../../utils/toast'

const CHECKOUT_URL = 'https://momiji-ide.lemonsqueezy.com/checkout/buy/495febcd-8f43-44cc-9fab-7cd2896874a5'

interface Props {
  onCommandPalette: () => void
}

export function TitleBar({ onCommandPalette }: Props) {
  const currentFolder          = useAppStore((s) => s.currentFolder)
  const tabs                   = useAppStore((s) => s.tabs)
  const activeTabId            = useAppStore((s) => s.activeTabId)
  const licenseTier            = useAppStore((s) => s.licenseTier)
  const showSidebar            = useAppStore((s) => s.showSidebar)
  const toggleSidebar          = useAppStore((s) => s.toggleSidebar)
  const showSecondarySidebar   = useAppStore((s) => s.showSecondarySidebar)
  const toggleSecondarySidebar = useAppStore((s) => s.toggleSecondarySidebar)
  const showBottomPanel        = useAppStore((s) => s.showBottomPanel)
  const toggleBottomPanel      = useAppStore((s) => s.toggleBottomPanel)
  const splitTabId             = useAppStore((s) => s.splitTabId)
  const setSplitTabId          = useAppStore((s) => s.setSplitTabId)
  const [isMaximized, setIsMaximized] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const folderName = currentFolder ? currentFolder.split(/[\\/]/).pop() : null

  useEffect(() => {
    if (window.api?.window) {
      window.api.window.isMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = () => window.api?.window.minimize()
  const handleMaximize = async () => {
    await window.api?.window.maximize()
    const max = await window.api?.window.isMaximized()
    setIsMaximized(max)
  }
  const handleClose = () => window.api?.window.close()

  return (
    <div
      className="drag-region flex items-center h-9 flex-shrink-0"
      style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Left: Logo + tier badge — draggable */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0">
        <MomijiLogo size={18} />
        <span className="brand-text">MOMIJI</span>
        {licenseTier === 'free' ? (
          <button
            onClick={() => window.open(CHECKOUT_URL, '_blank')}
            className="no-drag text-xs px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', border: '1px solid var(--border)', fontSize: 9, cursor: 'pointer' }}
            title="Upgrade to Pro">
            Free
          </button>
        ) : (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
            style={{
              background: licenseTier === 'studio' ? 'var(--accent-yellow)22' : 'var(--accent-mauve)22',
              color:      licenseTier === 'studio' ? 'var(--accent-yellow)' : 'var(--accent-mauve)',
              border:     `1px solid ${licenseTier === 'studio' ? 'var(--accent-yellow)44' : 'var(--accent-mauve)44'}`,
              fontSize: 9,
            }}>
            {licenseTier === 'studio' ? '🏆 Studio' : '🦊 Pro'}
          </span>
        )}
      </div>

      {/* Center: drag-region wrapper, button itself is no-drag */}
      <div className="flex-1 flex justify-center px-4 drag-region">
        <button
          onClick={onCommandPalette}
          className="no-drag flex items-center gap-2 px-4 py-1 rounded-lg text-xs transition-all max-w-sm w-full"
          style={{
            background: 'var(--bg-surface0)',
            color: 'var(--text-subtle)',
            border: '1px solid var(--border)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface1)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface0)'
            e.currentTarget.style.color = 'var(--text-subtle)'
          }}
        >
          <span>🔍</span>
          <span className="flex-1 text-left">
            {folderName
              ? activeTab
                ? `${folderName} / ${activeTab.fileName}`
                : folderName
              : 'Open file or folder...'}
          </span>
          <kbd className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
            Ctrl+P
          </kbd>
        </button>
      </div>

      {/* Center-Right: VSCode-style Layout Toggles */}
      <div className="no-drag flex items-center gap-0.5 px-3 flex-shrink-0" style={{ borderRight: '1px solid var(--border)', marginRight: '6px' }}>
        {/* Toggle Left Sidebar */}
        <button
          onClick={toggleSidebar}
          title="Toggle Primary Side Bar (Ctrl+B)"
          className="flex items-center justify-center w-8 h-7 rounded transition-all cursor-pointer"
          style={{
            background: 'transparent',
            color: showSidebar ? 'var(--accent-mauve)' : 'var(--text-subtle)',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface0)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = showSidebar ? 'var(--accent-mauve)' : 'var(--text-subtle)'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
            <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
            {showSidebar && <rect x="1.5" y="1.5" width="4" height="13" rx="1" fill="var(--accent-mauve)" opacity="0.3" stroke="none" />}
          </svg>
        </button>

        {/* Toggle Bottom Panel */}
        <button
          onClick={toggleBottomPanel}
          title="Toggle Panel (Ctrl+`)"
          className="flex items-center justify-center w-8 h-7 rounded transition-all cursor-pointer"
          style={{
            background: 'transparent',
            color: showBottomPanel ? 'var(--accent-mauve)' : 'var(--text-subtle)',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface0)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = showBottomPanel ? 'var(--accent-mauve)' : 'var(--text-subtle)'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
            <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" />
            {showBottomPanel && <rect x="1.5" y="10.5" width="13" height="4" rx="1" fill="var(--accent-mauve)" opacity="0.3" stroke="none" />}
          </svg>
        </button>

        {/* Toggle Right Sidebar */}
        <button
          onClick={toggleSecondarySidebar}
          title="Toggle Secondary Side Bar (Right)"
          className="flex items-center justify-center w-8 h-7 rounded transition-all cursor-pointer"
          style={{
            background: 'transparent',
            color: showSecondarySidebar ? 'var(--accent-mauve)' : 'var(--text-subtle)',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface0)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = showSecondarySidebar ? 'var(--accent-mauve)' : 'var(--text-subtle)'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
            <line x1="10.5" y1="1.5" x2="10.5" y2="14.5" />
            {showSecondarySidebar && <rect x="10.5" y="1.5" width="4" height="13" rx="1" fill="var(--accent-mauve)" opacity="0.3" stroke="none" />}
          </svg>
        </button>

        {/* Split/Grid Layout */}
        <button
          onClick={() => setSplitTabId(splitTabId ? null : (activeTabId ?? null))}
          title={splitTabId ? 'Close Split View' : 'Split Editor (Multi-editor Split View)'}
          className="flex items-center justify-center w-8 h-7 rounded transition-all cursor-pointer"
          style={{
            background: 'transparent',
            color: splitTabId ? 'var(--accent-mauve)' : 'var(--text-subtle)',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface0)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = splitTabId ? 'var(--accent-mauve)' : 'var(--text-subtle)'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
            <line x1="8" y1="1.5" x2="8" y2="14.5" />
            {splitTabId && <rect x="8" y="1.5" width="6.5" height="13" rx="1" fill="var(--accent-mauve)" opacity="0.3" stroke="none" />}
          </svg>
        </button>
      </div>

      {/* Right: Window controls */}
      <div className="no-drag flex items-center flex-shrink-0">
        <WinBtn onClick={handleMinimize} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" /></svg>
        </WinBtn>
        <WinBtn onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" />
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-crust)" />
              <rect x="0" y="2" width="8" height="8" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect width="10" height="10" />
            </svg>
          )}
        </WinBtn>
        <WinBtn onClick={handleClose} title="Close" danger>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </WinBtn>
      </div>
    </div>
  )
}

function WinBtn({ onClick, title, children, danger }: {
  onClick: () => void; title: string; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-11 h-9 transition-colors"
      style={{ color: 'var(--text-muted)', background: 'transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#c42b1c' : 'var(--bg-surface0)'
        e.currentTarget.style.color = danger ? 'white' : 'var(--text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      {children}
    </button>
  )
}
