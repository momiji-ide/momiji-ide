import { useState, useEffect, useRef } from 'react'

export function isPdfFile(filePath: string) {
  return filePath.toLowerCase().endsWith('.pdf')
}

export function PdfViewer({ filePath }: { filePath: string }) {
  const [src, setSrc]       = useState('')
  const [error, setError]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const embedRef = useRef<HTMLEmbedElement>(null)

  useEffect(() => {
    setSrc(''); setError(false); setLoading(true)
    const name = filePath.split(/[\\/]/).pop() ?? filePath
    setFileName(name)

    window.api.fs.readBinary(filePath).then(r => {
      if (r.ok && r.base64) {
        setSrc(`data:application/pdf;base64,${r.base64}`)
      } else {
        setError(true)
      }
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }, [filePath])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3"
           style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40 }}>📄</div>
        <div className="text-xs">Loading PDF…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3"
           style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40 }}>❌</div>
        <div className="text-xs">Failed to load PDF</div>
        <div className="text-xs opacity-60">{filePath}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden"
         style={{ background: 'var(--bg-mantle)' }}>
      {/* toolbar */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          height: 36,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface0)',
        }}
      >
        <span style={{ fontSize: 14 }}>📄</span>
        <span className="text-xs font-medium truncate flex-1"
              style={{ color: 'var(--text)' }}>
          {fileName}
        </span>

        {/* open externally */}
        <button
          onClick={() => window.api.shell?.openExternal(`file://${filePath}`)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
          style={{
            background: 'var(--bg-surface1)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          title="Open in system PDF viewer"
        >
          ↗ Open externally
        </button>
      </div>

      {/* PDF embed — Chromium renders PDFs natively */}
      <embed
        ref={embedRef}
        src={src}
        type="application/pdf"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
      />
    </div>
  )
}
