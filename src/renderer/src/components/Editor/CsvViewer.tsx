import { useState, useMemo } from 'react'

const COL_COLORS = [
  'rgba(249,115,22,0.10)',
  'rgba(96,165,250,0.10)',
  'rgba(52,211,153,0.10)',
  'rgba(251,191,36,0.10)',
  'rgba(167,139,250,0.10)',
  'rgba(244,114,182,0.10)',
  'rgba(45,212,191,0.10)',
  'rgba(248,113,113,0.10)',
  'rgba(163,230,53,0.10)',
  'rgba(129,140,248,0.10)',
]

const COL_HEADER_COLORS = [
  'rgba(249,115,22,0.25)',
  'rgba(96,165,250,0.25)',
  'rgba(52,211,153,0.25)',
  'rgba(251,191,36,0.25)',
  'rgba(167,139,250,0.25)',
  'rgba(244,114,182,0.25)',
  'rgba(45,212,191,0.25)',
  'rgba(248,113,113,0.25)',
  'rgba(163,230,53,0.25)',
  'rgba(129,140,248,0.25)',
]

function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQuote = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inQuote) {
      if (ch === '"' && raw[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cell += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',' || ch === '\t' || ch === ';') { cur.push(cell); cell = '' }
      else if (ch === '\n' || (ch === '\r' && raw[i + 1] === '\n')) {
        cur.push(cell); cell = ''; rows.push(cur); cur = []
        if (ch === '\r') i++
      } else cell += ch
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  return rows.filter(r => r.some(c => c.trim()))
}

export function isCsvFile(path: string): boolean {
  return /\.(csv|tsv)$/i.test(path)
}

interface Props {
  content: string
  fileName: string
}

export function CsvViewer({ content, fileName }: Props) {
  const rows = useMemo(() => parseCsv(content), [content])
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [search, setSearch] = useState('')

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-subtle)' }}>
        <p className="text-sm">Empty file</p>
      </div>
    )
  }

  const header = rows[0]
  const maxCols = Math.max(...rows.map(r => r.length))
  let dataRows = rows.slice(1)

  if (search) {
    const q = search.toLowerCase()
    dataRows = dataRows.filter(r => r.some(c => c.toLowerCase().includes(q)))
  }

  if (sortCol !== null) {
    dataRows = [...dataRows].sort((a, b) => {
      const va = a[sortCol] ?? '', vb = b[sortCol] ?? ''
      const na = Number(va), nb = Number(vb)
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }

  const handleSort = (col: number) => {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>CSV</span>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{fileName} — {dataRows.length} rows × {maxCols} cols</span>
        <div className="flex-1" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter rows…"
          className="px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', width: 160 }}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px', position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-mantle)', borderBottom: '2px solid var(--border)', color: 'var(--text-subtle)', fontSize: 9, fontWeight: 400, textAlign: 'center', width: 36 }}>
                #
              </th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i} onClick={() => handleSort(i)}
                  style={{
                    padding: '6px 10px', position: 'sticky', top: 0, zIndex: 2, cursor: 'pointer', textAlign: 'left',
                    background: COL_HEADER_COLORS[i % COL_HEADER_COLORS.length],
                    borderBottom: '2px solid var(--border)',
                    color: 'var(--text)', fontWeight: 700, fontSize: 11,
                  }}>
                  {header[i] ?? `Col ${i + 1}`}
                  {sortCol === i && <span style={{ marginLeft: 4, fontSize: 9 }}>{sortAsc ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { for (const td of e.currentTarget.children as any) td.style.filter = 'brightness(1.15)' }}
                onMouseLeave={e => { for (const td of e.currentTarget.children as any) td.style.filter = '' }}>
                <td style={{ padding: '4px 8px', color: 'var(--text-subtle)', fontSize: 9, textAlign: 'center', background: 'var(--bg-mantle)' }}>
                  {ri + 1}
                </td>
                {Array.from({ length: maxCols }, (_, ci) => (
                  <td key={ci} style={{
                    padding: '4px 10px',
                    background: COL_COLORS[ci % COL_COLORS.length],
                    color: 'var(--text)',
                    whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
