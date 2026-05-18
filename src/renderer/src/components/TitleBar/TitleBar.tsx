import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { MomijiLogo } from '../Logo/MomijiLogo'

interface Props {
  onCommandPalette: () => void
}

export function TitleBar({ onCommandPalette }: Props) {
  const currentFolder = useAppStore((s) => s.currentFolder)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
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
      {/* Left: Logo */}
      <div className="no-drag flex items-center gap-2 px-3 flex-shrink-0">
        <MomijiLogo size={18} />
        <span className="brand-text">MOMIJI</span>
      </div>

      {/* Center: Command palette button (acts as search) */}
      <div className="flex-1 flex justify-center px-4 no-drag">
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-2 px-4 py-1 rounded-lg text-xs transition-all max-w-sm w-full"
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
