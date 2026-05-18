import { useState, useEffect } from 'react'

const IMAGE_EXTS = new Set(['.png','.jpg','.jpeg','.gif','.svg','.webp','.ico','.bmp','.avif'])

export function isImageFile(filePath: string) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return IMAGE_EXTS.has(ext)
}

export function ImageViewer({ filePath }: { filePath: string }) {
  const [src, setSrc]     = useState('')
  const [zoom, setZoom]   = useState(1)
  const [info, setInfo]   = useState({ w: 0, h: 0, size: '' })
  const [error, setError] = useState(false)

  useEffect(() => {
    setSrc(''); setError(false); setZoom(1)
    // Use file:// protocol directly — works in Electron renderer
    const url = `file://${filePath.replace(/\\/g, '/')}`
    setSrc(url)
  }, [filePath])

  const ext  = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  const name = filePath.split(/[/\\]/).pop() ?? filePath

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-subtle)' }}>
      <span style={{ fontSize: 40 }}>🖼️</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Cannot preview this image</p>
      <p className="text-xs">{name}</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-muted)' }}>🖼️ {name}</span>
        {info.w > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
            {info.w} × {info.h}px
          </span>
        )}
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
          {ext.slice(1).toUpperCase()}
        </span>
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.1, +(z - 0.25).toFixed(2)))}
            style={{ background: 'var(--bg-surface0)', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>−</button>
          <span className="text-xs w-12 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))}
            style={{ background: 'var(--bg-surface0)', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>+</button>
          <button onClick={() => setZoom(1)}
            style={{ background: 'var(--bg-surface0)', border: 'none', borderRadius: 4, padding: '0 6px', height: 22, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10 }}>1:1</button>
          <button onClick={() => setZoom(0)}
            style={{ background: 'var(--bg-surface0)', border: 'none', borderRadius: 4, padding: '0 6px', height: 22, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10 }}>Fit</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center"
        style={{ background: 'repeating-conic-gradient(#313244 0% 25%, #1e1e2e 0% 50%) 0 0 / 24px 24px' }}
        onWheel={e => {
          e.preventDefault()
          setZoom(z => Math.max(0.1, Math.min(8, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))
        }}>
        {src && (
          <img src={src} alt={name}
            onLoad={e => {
              const img = e.currentTarget
              setInfo({ w: img.naturalWidth, h: img.naturalHeight, size: '' })
              if (zoom === 0) setZoom(1) // reset fit
            }}
            onError={() => setError(true)}
            draggable={false}
            style={{
              maxWidth:  zoom === 0 ? '100%'  : 'none',
              maxHeight: zoom === 0 ? '100%'  : 'none',
              width:     zoom !== 0 ? `${info.w * zoom}px` : undefined,
              height:    zoom !== 0 ? `${info.h * zoom}px` : undefined,
              imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,.5)',
              transition: 'width .15s, height .15s',
            }}
          />
        )}
      </div>
    </div>
  )
}
