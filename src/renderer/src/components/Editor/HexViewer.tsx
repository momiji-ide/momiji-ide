/**
 * HexViewer — Binary file viewer with hex + ASCII columns
 * Shows offset | hex bytes (16/row) | ASCII representation
 * Magic byte detection, byte inspector, search in hex/ASCII
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ── Magic byte signatures ──────────────────────────────────────────────────────
const MAGIC: { sig: number[]; name: string; color: string }[] = [
  { sig: [0xFF,0xD8,0xFF],             name: 'JPEG Image',             color: '#fab387' },
  { sig: [0x89,0x50,0x4E,0x47],        name: 'PNG Image',              color: '#a6e3a1' },
  { sig: [0x47,0x49,0x46],             name: 'GIF Image',              color: '#a6e3a1' },
  { sig: [0x25,0x50,0x44,0x46],        name: 'PDF Document',           color: '#f38ba8' },
  { sig: [0x50,0x4B,0x03,0x04],        name: 'ZIP / DOCX / JAR / APK', color: '#89b4fa' },
  { sig: [0x50,0x4B,0x05,0x06],        name: 'ZIP (empty)',            color: '#89b4fa' },
  { sig: [0x1F,0x8B],                  name: 'GZIP Archive',           color: '#cba6f7' },
  { sig: [0x42,0x5A,0x68],             name: 'BZIP2 Archive',          color: '#cba6f7' },
  { sig: [0xFD,0x37,0x7A,0x58,0x5A],  name: 'XZ Archive',             color: '#cba6f7' },
  { sig: [0x52,0x61,0x72,0x21],        name: 'RAR Archive',            color: '#cba6f7' },
  { sig: [0x7F,0x45,0x4C,0x46],        name: 'ELF Executable (Linux)', color: '#f9e2af' },
  { sig: [0x4D,0x5A],                  name: 'PE Executable (Windows)','color': '#f9e2af' },
  { sig: [0xCA,0xFE,0xBA,0xBE],        name: 'Java Class / Mach-O Fat','color': '#f9e2af' },
  { sig: [0xCF,0xFA,0xED,0xFE],        name: 'Mach-O Executable (macOS)', color: '#f9e2af' },
  { sig: [0x00,0x61,0x73,0x6D],        name: 'WebAssembly (.wasm)',    color: '#89dceb' },
  { sig: [0x53,0x51,0x4C,0x69,0x74,0x65], name: 'SQLite Database',    color: '#94e2d5' },
  { sig: [0x49,0x44,0x33],             name: 'MP3 Audio (ID3)',        color: '#f5c2e7' },
  { sig: [0xFF,0xFB],                  name: 'MP3 Audio',              color: '#f5c2e7' },
  { sig: [0x52,0x49,0x46,0x46],        name: 'RIFF (WAV / AVI)',       color: '#f5c2e7' },
  { sig: [0x66,0x74,0x79,0x70],        name: 'MP4 / MOV Video',        color: '#f5c2e7' },
  { sig: [0x1A,0x45,0xDF,0xA3],        name: 'MKV / WebM Video',       color: '#f5c2e7' },
  { sig: [0xD0,0xCF,0x11,0xE0],        name: 'MS Office (DOC/XLS/PPT)','color': '#89b4fa' },
  { sig: [0x7B,0x5C,0x72,0x74,0x66],  name: 'RTF Document',           color: '#89b4fa' },
  { sig: [0xEF,0xBB,0xBF],            name: 'UTF-8 with BOM',         color: '#a6adc8' },
  { sig: [0xFF,0xFE],                  name: 'UTF-16 LE with BOM',     color: '#a6adc8' },
]

function detectFormat(bytes: Uint8Array) {
  for (const m of MAGIC) {
    if (m.sig.every((b, i) => bytes[i] === b)) return m
  }
  return null
}

function isBinary(bytes: Uint8Array): boolean {
  const check = Math.min(bytes.length, 512)
  let nonPrint = 0
  for (let i = 0; i < check; i++) {
    const b = bytes[i]
    if (b === 0) return true              // null byte → definitely binary
    if (b < 9 || (b > 13 && b < 32)) nonPrint++
  }
  return nonPrint / check > 0.1          // >10% non-printable → binary
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024**2) return `${(n/1024).toFixed(1)} KB`
  if (n < 1024**3) return `${(n/1024**2).toFixed(2)} MB`
  return `${(n/1024**3).toFixed(2)} GB`
}

function h2(n: number) { return n.toString(16).padStart(2,'0').toUpperCase() }
function h8(n: number) { return n.toString(16).padStart(8,'0').toUpperCase() }

const BYTES_PER_ROW = 16
const ROWS_PER_PAGE = 512   // render max this many rows at once (virtual scroll)

// ── Main component ─────────────────────────────────────────────────────────────
export function HexViewer({ filePath }: { filePath: string }) {
  const [bytes,    setBytes]    = useState<Uint8Array | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [search,   setSearch]   = useState('')
  const [searchMode, setSearchMode] = useState<'hex'|'ascii'>('ascii')
  const [matches,  setMatches]  = useState<number[]>([])
  const [matchIdx, setMatchIdx] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const ROW_H = 20

  const name = filePath.split(/[/\\]/).pop() ?? filePath

  // ── Load file ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true); setBytes(null); setError(''); setSelected(null)
    setSearch(''); setMatches([]); setScrollTop(0)

    window.api.fs.readBinary(filePath).then(r => {
      if (!r.ok) { setError('Could not read file'); setLoading(false); return }
      // Decode base64 → Uint8Array
      const bin = atob(r.base64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      setBytes(arr)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [filePath])

  // ── Search ───────────────────────────────────────────────────────────────────
  const doSearch = useCallback(() => {
    if (!bytes || !search.trim()) { setMatches([]); return }
    const needle: number[] = []
    if (searchMode === 'hex') {
      const clean = search.replace(/\s/g,'')
      if (clean.length % 2 !== 0) return
      for (let i = 0; i < clean.length; i += 2) needle.push(parseInt(clean.slice(i,i+2),16))
    } else {
      for (let i = 0; i < search.length; i++) needle.push(search.charCodeAt(i))
    }
    const found: number[] = []
    outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (bytes[i+j] !== needle[j]) continue outer
      found.push(i)
    }
    setMatches(found); setMatchIdx(0)
    if (found.length > 0) {
      setSelected(found[0])
      const row = Math.floor(found[0] / BYTES_PER_ROW)
      setScrollTop(Math.max(0, (row - 5) * ROW_H))
      containerRef.current?.scrollTo({ top: Math.max(0, (row-5)*ROW_H) })
    }
  }, [bytes, search, searchMode])

  const jumpToMatch = (dir: 1|-1) => {
    if (!matches.length) return
    const idx = (matchIdx + dir + matches.length) % matches.length
    setMatchIdx(idx)
    setSelected(matches[idx])
    const row = Math.floor(matches[idx] / BYTES_PER_ROW)
    containerRef.current?.scrollTo({ top: Math.max(0, (row-5)*ROW_H), behavior: 'smooth' })
  }

  // ── Computed values ───────────────────────────────────────────────────────────
  const format     = useMemo(() => bytes ? detectFormat(bytes) : null, [bytes])
  const totalRows  = bytes ? Math.ceil(bytes.length / BYTES_PER_ROW) : 0
  const startRow   = Math.floor(scrollTop / ROW_H)
  const visibleRows = Math.min(ROWS_PER_PAGE, totalRows - startRow)
  const matchSet   = useMemo(() => new Set(matches), [matches])

  const selectedByte = selected !== null && bytes ? bytes[selected] : null

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3" style={{ color: 'var(--text-subtle)' }}>
      <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent-mauve)', borderTopColor: 'transparent' }} />
      <span className="text-xs">Loading binary…</span>
    </div>
  )
  if (error || !bytes) return (
    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
      <span style={{ fontSize: 32 }}>💔</span>
      <p className="text-xs">{error || 'Failed to load'}</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)', fontFamily: "'Cascadia Code','JetBrains Mono','Fira Code',monospace" }}>

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)', flexWrap: 'wrap', gap: '6px 12px' }}>
        {/* File info */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>⬡ HEX</span>
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)', maxWidth: 200 }}>{name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface0)', color: 'var(--text-subtle)' }}>{fmtSize(bytes.length)}</span>
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{bytes.length.toLocaleString()} bytes</span>
        </div>

        {/* Magic bytes format */}
        {format && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: format.color + '22', color: format.color, border: `1px solid ${format.color}55` }}>
            ✦ {format.name}
          </span>
        )}

        {/* Search */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setSearchMode(m => m === 'hex' ? 'ascii' : 'hex')}
            style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-surface0)', border: '1px solid var(--border)', color: 'var(--accent-mauve)', cursor: 'pointer', fontFamily: 'monospace' }}>
            {searchMode.toUpperCase()}
          </button>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            placeholder={searchMode === 'hex' ? 'Search hex: FF D8 FF' : 'Search text…'}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-surface0)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', width: 170, fontFamily: 'monospace' }} />
          <button onClick={doSearch} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-mauve)', border: 'none', color: 'white', cursor: 'pointer' }}>Find</button>
          {matches.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>{matchIdx+1}/{matches.length}</span>
              <button onClick={() => jumpToMatch(-1)} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-surface0)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}>↑</button>
              <button onClick={() => jumpToMatch(1)}  style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-surface0)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}>↓</button>
            </>
          )}
        </div>
      </div>

      {/* ── Byte inspector ── */}
      {selectedByte !== null && selected !== null && (
        <div className="flex-shrink-0 flex items-center gap-4 px-3 py-1" style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
          <span style={{ color: 'var(--text-subtle)' }}>Offset:</span>
          <span style={{ color: 'var(--accent-mauve)', fontFamily: 'monospace' }}>{h8(selected)} ({selected})</span>
          <span style={{ color: 'var(--text-subtle)' }}>Hex:</span>
          <span style={{ color: 'var(--accent-yellow)', fontFamily: 'monospace' }}>{h2(selectedByte)}</span>
          <span style={{ color: 'var(--text-subtle)' }}>Dec:</span>
          <span style={{ color: 'var(--accent-peach)', fontFamily: 'monospace' }}>{selectedByte}</span>
          <span style={{ color: 'var(--text-subtle)' }}>Bin:</span>
          <span style={{ color: 'var(--accent-green)', fontFamily: 'monospace' }}>{selectedByte.toString(2).padStart(8,'0')}</span>
          <span style={{ color: 'var(--text-subtle)' }}>Char:</span>
          <span style={{ color: 'var(--accent-mauve)', fontFamily: 'monospace' }}>
            {selectedByte >= 32 && selectedByte < 127 ? `'${String.fromCharCode(selectedByte)}'` : selectedByte === 0 ? 'NUL' : selectedByte === 10 ? 'LF' : selectedByte === 13 ? 'CR' : selectedByte === 9 ? 'TAB' : '·'}
          </span>
          <span style={{ color: 'var(--text-subtle)' }}>Int16 LE:</span>
          <span style={{ color: 'var(--text-subtle)', fontFamily: 'monospace' }}>{selected+1 < bytes.length ? new DataView(bytes.buffer, selected, 2).getInt16(0, true) : '—'}</span>
          <span style={{ color: 'var(--text-subtle)' }}>Int32 LE:</span>
          <span style={{ color: 'var(--text-subtle)', fontFamily: 'monospace' }}>{selected+3 < bytes.length ? new DataView(bytes.buffer, selected, 4).getInt32(0, true) : '—'}</span>
        </div>
      )}

      {/* ── Hex grid ── */}
      <div ref={containerRef} className="flex-1 overflow-auto"
        onScroll={e => setScrollTop((e.target as HTMLElement).scrollTop)}
        style={{ fontSize: 12 }}>
        {/* Column headers */}
        <div className="flex sticky top-0 z-10 select-none" style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
          <span style={{ width: 80, paddingLeft: 12, color: 'var(--text-subtle)', fontSize: 10 }}>OFFSET</span>
          <div className="flex gap-0.5" style={{ flex: '0 0 auto' }}>
            {Array.from({ length: BYTES_PER_ROW }, (_, i) => (
              <span key={i} style={{ width: 24, textAlign: 'center', color: i === 8 ? 'var(--accent-mauve)' : 'var(--text-subtle)', fontSize: 10 }}>{h2(i)}</span>
            ))}
          </div>
          <span style={{ paddingLeft: 16, color: 'var(--text-subtle)', fontSize: 10 }}>ASCII</span>
        </div>

        {/* Virtual scroll spacer top */}
        <div style={{ height: startRow * ROW_H }} />

        {/* Visible rows */}
        {Array.from({ length: visibleRows }, (_, ri) => {
          const row = startRow + ri
          const offset = row * BYTES_PER_ROW
          const slice = bytes.slice(offset, offset + BYTES_PER_ROW)
          return (
            <div key={row} className="flex hover:bg-white/5" style={{ height: ROW_H, alignItems: 'center' }}>
              {/* Offset */}
              <span style={{ width: 80, paddingLeft: 12, color: 'var(--text-subtle)', fontSize: 11, flexShrink: 0, fontFamily: 'monospace' }}>
                {h8(offset)}
              </span>
              {/* Hex bytes */}
              <div className="flex" style={{ flexShrink: 0 }}>
                {Array.from({ length: BYTES_PER_ROW }, (_, bi) => {
                  const idx = offset + bi
                  const b   = slice[bi]
                  const isSel   = idx === selected
                  const isMatch = matchSet.has(idx)
                  const isCurrentMatch = matches[matchIdx] === idx
                  return (
                    <span key={bi}
                      onClick={() => b !== undefined && setSelected(idx)}
                      style={{
                        width: 24, textAlign: 'center', cursor: b !== undefined ? 'pointer' : 'default',
                        color: b === undefined ? 'transparent'
                          : b === 0 ? 'var(--text-subtle)'
                          : b < 32 || b > 126 ? 'var(--accent-mauve)' : 'var(--text)',
                        background: isSel ? 'var(--accent-mauve)' : isCurrentMatch ? 'var(--accent-green)' : isMatch ? 'var(--accent-green)33' : 'transparent',
                        borderRadius: 2,
                        marginLeft: bi === 8 ? 8 : 0,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        userSelect: 'none',
                      }}>
                      {b !== undefined ? h2(b) : '  '}
                    </span>
                  )
                })}
              </div>
              {/* ASCII */}
              <div style={{ paddingLeft: 16, display: 'flex', color: 'var(--text-muted)', userSelect: 'none' }}>
                {Array.from(slice).map((b, bi) => {
                  const idx = offset + bi
                  const ch = b >= 32 && b < 127 ? String.fromCharCode(b) : '·'
                  return (
                    <span key={bi} onClick={() => setSelected(idx)}
                      style={{
                        width: 9, textAlign: 'center', cursor: 'pointer', fontSize: 12,
                        color: b === 0 ? '#45475a' : b < 32 || b > 126 ? 'var(--accent-mauve)' : 'var(--accent-green)',
                        background: idx === selected ? 'var(--accent-mauve)' : 'transparent',
                        borderRadius: 2,
                      }}>
                      {ch}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Virtual scroll spacer bottom */}
        <div style={{ height: Math.max(0, totalRows - startRow - visibleRows) * ROW_H }} />
      </div>

      {/* ── Status bar ── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-3 py-1" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-crust)', fontSize: 10, color: 'var(--text-subtle)' }}>
        <span>{totalRows.toLocaleString()} rows</span>
        <span>·</span>
        <span>{bytes.length.toLocaleString()} bytes ({fmtSize(bytes.length)})</span>
        {selected !== null && <><span>·</span><span>Selected: 0x{h8(selected)}</span></>}
        {matches.length > 0 && <><span>·</span><span style={{ color: 'var(--accent-green)' }}>{matches.length} matches</span></>}
        <span style={{ marginLeft: 'auto' }}>16 bytes/row</span>
      </div>
    </div>
  )
}

// ── Binary detection utilities ─────────────────────────────────────────────────
const BINARY_EXTS = new Set([
  '.exe','.dll','.so','.dylib','.bin','.dat','.com',
  '.zip','.tar','.gz','.bz2','.xz','.rar','.7z','.zst',
  '.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx',
  '.wasm','.class','.pyc','.pyo',
  '.mp3','.mp4','.avi','.mkv','.mov','.wav','.flac','.ogg','.webm',
  '.ttf','.otf','.woff','.woff2',
  '.ico','.cur','.bmp','.tiff','.tif',
  '.o','.a','.lib','.pdb','.obj',
  '.db','.sqlite','.sqlite3',
])

export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return BINARY_EXTS.has(ext)
}

export { isBinary }
