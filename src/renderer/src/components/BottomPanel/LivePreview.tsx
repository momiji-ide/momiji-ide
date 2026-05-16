import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'

export function LivePreview() {
  const { tabs, activeTabId } = useAppStore()
  const [previewKey, setPreviewKey] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isHtml = activeTab?.language === 'html'

  // Auto-refresh when content changes
  useEffect(() => {
    if (autoRefresh && isHtml) {
      const timer = setTimeout(() => setPreviewKey((k) => k + 1), 500)
      return () => clearTimeout(timer)
    }
  }, [activeTab?.content, autoRefresh, isHtml])

  const getPreviewContent = () => {
    if (!activeTab) return ''
    if (activeTab.language === 'html') return activeTab.content
    if (activeTab.language === 'css') {
      return `<!DOCTYPE html><html><head><style>${activeTab.content}</style></head>
<body style="background:#1e1e2e;color:#cdd6f4;font-family:sans-serif;padding:20px">
  <p>CSS Preview — add HTML to see styled elements</p>
  <h1>Heading 1</h1><h2>Heading 2</h2>
  <p>Paragraph text with <a href="#">a link</a> and <strong>bold</strong> and <em>italic</em>.</p>
  <button>Button</button>
  <input type="text" placeholder="Input field" />
</body></html>`
    }
    return ''
  }

  const deviceSizes = {
    desktop: { width: '100%', label: '🖥️ Desktop' },
    tablet: { width: '768px', label: '📱 Tablet' },
    mobile: { width: '375px', label: '📱 Mobile' }
  }

  const blobUrl = (() => {
    const content = getPreviewContent()
    if (!content) return ''
    const blob = new Blob([content], { type: 'text/html' })
    return URL.createObjectURL(blob)
  })()

  if (!activeTab || (activeTab.language !== 'html' && activeTab.language !== 'css')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-3xl">🌐</span>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Open an HTML or CSS file to see live preview
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Preview toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>PREVIEW</span>
          <span className="text-xs" style={{ color: 'var(--accent-green)' }}>● {activeTab.fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Device toggle */}
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDeviceMode(d)}
              className="text-xs px-2 py-0.5 rounded transition-colors"
              style={{
                background: deviceMode === d ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                color: deviceMode === d ? 'var(--bg-base)' : 'var(--text-muted)'
              }}
              title={deviceSizes[d].label}
            >
              {deviceSizes[d].label.split(' ')[0]}
            </button>
          ))}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{
              background: autoRefresh ? 'var(--accent-green)' : 'var(--bg-surface0)',
              color: autoRefresh ? 'var(--bg-base)' : 'var(--text-muted)'
            }}
          >
            {autoRefresh ? '⟳ Auto' : '⟳ Manual'}
          </button>
          <button
            onClick={() => setPreviewKey((k) => k + 1)}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div
        className="flex-1 overflow-auto flex justify-center"
        style={{ background: '#888', padding: deviceMode === 'desktop' ? '0' : '8px' }}
      >
        <iframe
          key={previewKey}
          ref={iframeRef}
          src={blobUrl}
          className="h-full"
          style={{
            width: deviceSizes[deviceMode].width,
            border: deviceMode === 'desktop' ? 'none' : '1px solid #444',
            borderRadius: deviceMode === 'desktop' ? '0' : '8px',
            background: 'white'
          }}
          sandbox="allow-scripts allow-same-origin"
          title="Live Preview"
        />
      </div>
    </div>
  )
}
