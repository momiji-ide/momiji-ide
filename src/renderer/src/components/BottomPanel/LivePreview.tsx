import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'

interface ConsoleMsg { type: 'log' | 'warn' | 'error' | 'info'; text: string; ts: number }

export function LivePreview() {
  const { tabs, activeTabId, currentFolder } = useAppStore()
  const [autoRefresh, setAutoRefresh]   = useState(true)
  const [deviceMode, setDeviceMode]     = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [consoleMsgs, setConsoleMsgs]   = useState<ConsoleMsg[]>([])
  const [showConsole, setShowConsole]   = useState(false)
  const [isLoading, setIsLoading]       = useState(false)
  const [blobUrl, setBlobUrl]           = useState('')
  const iframeRef  = useRef<HTMLIFrameElement>(null)
  const refreshRef = useRef<ReturnType<typeof setTimeout>>()

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isPreviewable = activeTab && ['html', 'css', 'javascript', 'typescript'].includes(activeTab.language ?? '')

  // ── Build preview HTML — inlines linked CSS/JS from project ──────────
  const buildPreview = useCallback(async () => {
    if (!activeTab) return ''
    const lang = activeTab.language

    if (lang === 'html') {
      let html = activeTab.content
      if (!currentFolder) return html

      // Inline <link rel="stylesheet" href="...">
      const cssRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi
      const matches = [...html.matchAll(cssRegex)]
      for (const m of matches) {
        const href = m[1]
        if (href.startsWith('http')) continue
        try {
          const filePath = href.startsWith('/') ? currentFolder + href : `${currentFolder}/${href}`
          const result = await window.api.fs.readFile(filePath)
          if (result.content !== null) {
            html = html.replace(m[0], `<style>/* ${href} */\n${result.content}</style>`)
          }
        } catch {}
      }

      // Inline <script src="...">
      const jsRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi
      const jsMatches = [...html.matchAll(jsRegex)]
      for (const m of jsMatches) {
        const src = m[1]
        if (src.startsWith('http')) continue
        try {
          const filePath = src.startsWith('/') ? currentFolder + src : `${currentFolder}/${src}`
          const result = await window.api.fs.readFile(filePath)
          if (result.content !== null) {
            html = html.replace(m[0], `<script>/* ${src} */\n${result.content}<\/script>`)
          }
        } catch {}
      }

      return injectConsoleCapture(html)
    }

    if (lang === 'css') {
      return injectConsoleCapture(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { background: #1e1e2e; color: #cdd6f4; font-family: system-ui; padding: 24px; }
  h1,h2,h3 { margin: 12px 0 6px; }
  p { margin: 6px 0; }
  button { margin: 4px; }
  a { color: #89b4fa; }
</style>
<style>${activeTab.content}</style>
</head>
<body>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
  <p>Paragraph with <a href="#">link</a>, <strong>bold</strong>, <em>italic</em>.</p>
  <button>Button</button>
  <button disabled>Disabled</button>
  <input type="text" placeholder="Input field" style="margin:4px;padding:4px" />
  <hr style="margin:16px 0;border-color:#313244">
  <div class="container"><div class="card"><p>Div.card inside .container</p></div></div>
</body></html>`)
    }

    if (lang === 'javascript' || lang === 'typescript') {
      return injectConsoleCapture(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { background: #1e1e2e; color: #cdd6f4; font-family: 'Cascadia Code', monospace; padding: 16px; font-size: 13px; }
  #output { white-space: pre-wrap; }
  .log   { color: #cdd6f4; }
  .warn  { color: #f9e2af; }
  .error { color: #f38ba8; }
  .info  { color: #89b4fa; }
</style>
</head>
<body>
  <div id="output"></div>
  <script>
    // Override document.write to show in output div
    const out = document.getElementById('output')
    document.write = (s) => { out.innerHTML += s }
  <\/script>
  <script>
    try {
      ${activeTab.content}
    } catch(e) {
      console.error(e.message)
    }
  <\/script>
</body></html>`)
    }

    return ''
  }, [activeTab, currentFolder])

  // Inject console capture script into HTML
  function injectConsoleCapture(html: string): string {
    const script = `<script>
(function() {
  const send = (type, args) => {
    window.parent.postMessage({ __momiji_console__: true, type, text: args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a) } catch { return String(a) }
    }).join(' ') }, '*')
  }
  ;['log','warn','error','info'].forEach(t => {
    const orig = console[t]
    console[t] = (...args) => { orig.apply(console, args); send(t, args) }
  })
  window.onerror = (msg, src, line) => send('error', [\`\${msg} (line \${line})\`])
})()
<\/script>`
    // Inject after <head> or at start
    if (html.includes('<head>')) return html.replace('<head>', `<head>${script}`)
    if (html.includes('<html>')) return html.replace('<html>', `<html><head>${script}</head>`)
    return script + html
  }

  // ── Refresh preview ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!isPreviewable) return
    setIsLoading(true)
    const html = await buildPreview()
    if (!html) { setIsLoading(false); return }

    // Revoke previous blob
    if (blobUrl) URL.revokeObjectURL(blobUrl)

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    setBlobUrl(url)
    setIsLoading(false)
  }, [isPreviewable, buildPreview, blobUrl])

  // Auto-refresh on content change
  useEffect(() => {
    if (!autoRefresh || !isPreviewable) return
    clearTimeout(refreshRef.current)
    refreshRef.current = setTimeout(refresh, 600)
    return () => clearTimeout(refreshRef.current)
  }, [activeTab?.content, activeTab?.id, autoRefresh, isPreviewable]) // eslint-disable-line

  // Initial load when switching to preview tab
  useEffect(() => {
    if (isPreviewable) refresh()
  }, [activeTab?.id]) // eslint-disable-line

  // ── Capture console messages from iframe ─────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.__momiji_console__) return
      setConsoleMsgs(prev => [...prev.slice(-99), {
        type: e.data.type, text: e.data.text, ts: Date.now()
      }])
      if (e.data.type === 'error') setShowConsole(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const deviceSizes = {
    desktop: { w: '100%',  icon: '🖥️' },
    tablet:  { w: '768px', icon: '📟' },
    mobile:  { w: '375px', icon: '📱' },
  }

  if (!activeTab || !isPreviewable) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3"
        style={{ color: 'var(--text-subtle)' }}>
        <span style={{ fontSize: 32 }}>🌐</span>
        <p className="text-xs">Open an HTML, CSS or JS file to see Live Preview</p>
      </div>
    )
  }

  const errCount = consoleMsgs.filter(m => m.type === 'error').length
  const warnCount = consoleMsgs.filter(m => m.type === 'warn').length

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0 px-3"
        style={{ height: 33, borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-subtle)' }}>PREVIEW</span>
          <span className="text-xs" style={{ color: '#a6e3a1' }}>● {activeTab.fileName}</span>
          {isLoading && <span className="text-xs animate-pulse" style={{ color: 'var(--accent-blue)' }}>⟳</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Device toggle */}
          {(['desktop', 'tablet', 'mobile'] as const).map(d => (
            <button key={d} onClick={() => setDeviceMode(d)}
              title={d} className="text-xs px-2 py-0.5 rounded transition-all"
              style={{
                background: deviceMode === d ? 'var(--accent-blue)' : 'var(--bg-surface0)',
                color: deviceMode === d ? 'white' : 'var(--text-subtle)',
                border: 'none', cursor: 'pointer',
              }}>
              {deviceSizes[d].icon}
            </button>
          ))}

          {/* Auto refresh toggle */}
          <button onClick={() => setAutoRefresh(v => !v)}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: autoRefresh ? 'rgba(166,227,161,.15)' : 'var(--bg-surface0)',
              color: autoRefresh ? '#a6e3a1' : 'var(--text-subtle)',
              border: `1px solid ${autoRefresh ? 'rgba(166,227,161,.3)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            {autoRefresh ? '⟳ Auto' : '⟳ Manual'}
          </button>

          {/* Refresh */}
          <button onClick={refresh}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--text-subtle)', border: '1px solid var(--border)',
              background: 'var(--bg-surface0)', cursor: 'pointer' }}>
            ↺
          </button>

          {/* Console toggle */}
          <button onClick={() => { setShowConsole(v => !v); setConsoleMsgs([]) }}
            className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
            style={{
              background: showConsole ? 'rgba(137,180,250,.12)' : 'var(--bg-surface0)',
              color: errCount > 0 ? '#f38ba8' : warnCount > 0 ? '#f9e2af' : 'var(--text-subtle)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
            ⌨ Console
            {(errCount > 0 || warnCount > 0) && (
              <span style={{
                background: errCount > 0 ? '#f38ba8' : '#f9e2af',
                color: '#1e1e2e', borderRadius: 4, padding: '0 4px', fontSize: 10, fontWeight: 700
              }}>
                {errCount > 0 ? `${errCount} err` : `${warnCount} warn`}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Preview + console */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* iframe */}
        <div className="flex-1 overflow-auto flex justify-center"
          style={{ background: deviceMode === 'desktop' ? '#ffffff' : '#888' }}>
          {blobUrl && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              style={{
                width: deviceSizes[deviceMode].w, height: '100%',
                border: deviceMode !== 'desktop' ? '1px solid #444' : 'none',
                borderRadius: deviceMode !== 'desktop' ? 8 : 0,
                background: 'white',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              title="Live Preview"
            />
          )}
        </div>

        {/* Console panel */}
        {showConsole && (
          <div style={{
            height: 140, flexShrink: 0, borderTop: '1px solid var(--border)',
            background: '#11111b', overflowY: 'auto',
            fontFamily: "'Cascadia Code', monospace", fontSize: 11,
          }}>
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-subtle)', fontSize: 10, fontWeight: 700 }}>CONSOLE</span>
              <button onClick={() => setConsoleMsgs([])}
                style={{ color: 'var(--text-subtle)', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 11 }}>Clear</button>
            </div>
            <div style={{ padding: '4px 0', maxHeight: 100, overflowY: 'auto' }}>
              {consoleMsgs.length === 0 ? (
                <p style={{ padding: '4px 8px', color: 'var(--overlay0)' }}>No output yet.</p>
              ) : consoleMsgs.map((m, i) => (
                <div key={i} style={{
                  padding: '1px 8px', color:
                    m.type === 'error' ? '#f38ba8' :
                    m.type === 'warn'  ? '#f9e2af' :
                    m.type === 'info'  ? '#89b4fa' : '#cdd6f4',
                  borderLeft: m.type === 'error' ? '2px solid #f38ba8' :
                              m.type === 'warn'  ? '2px solid #f9e2af' : '2px solid transparent',
                }}>
                  <span style={{ opacity: 0.4, marginRight: 6 }}>
                    {m.type === 'error' ? '✕' : m.type === 'warn' ? '⚠' : m.type === 'info' ? 'ℹ' : '›'}
                  </span>
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
