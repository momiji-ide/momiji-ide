import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'

interface Row { [key: string]: string | number | null }

export function SQLitePanel() {
  const { currentFolder, tabs, activeTabId } = useAppStore()
  const [dbPath, setDbPath] = useState('')
  const [tables, setTables] = useState<string[]>([])
  const [activeTable, setActiveTable] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [sql, setSql] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rowCount, setRowCount] = useState(0)

  // Auto-detect .db file from current tab
  const activeTab = tabs.find(t => t.id === activeTabId)
  const suggestedDb = activeTab?.filePath.endsWith('.db') ? activeTab.filePath : null

  const execSql = useCallback(async (path: string, query: string): Promise<Row[] | null> => {
    const res = await (window.api as any).db.exec(path, query)
    if (!res.ok) { setError(res.error); return null }
    setError('')
    if (!res.data?.trim()) return []
    try { return JSON.parse(res.data) } catch { return [] }
  }, [])

  const handleConnect = useCallback(async (path?: string) => {
    const target = path ?? dbPath.trim()
    if (!target) return
    setLoading(true)
    setError('')
    const result = await execSql(target, '.tables')
    if (result === null) { setLoading(false); return }

    // .tables returns space-separated names, not JSON
    const tablesRes = await (window.api as any).db.exec(target, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    if (!tablesRes.ok) { setError(tablesRes.error); setLoading(false); return }
    let tableList: string[] = []
    try {
      tableList = JSON.parse(tablesRes.data ?? '[]').map((r: any) => r.name)
    } catch { tableList = [] }
    setTables(tableList)
    setDbPath(target)
    if (tableList.length > 0) handleSelectTable(target, tableList[0])
    setLoading(false)
  }, [dbPath, execSql])

  const handleSelectTable = useCallback(async (path: string, table: string) => {
    setActiveTable(table)
    setSql(`SELECT * FROM "${table}" LIMIT 200`)
    setLoading(true)

    const countRes = await execSql(path, `SELECT COUNT(*) as cnt FROM "${table}"`)
    if (countRes?.[0]) setRowCount(Number(countRes[0].cnt))

    const dataRes = await execSql(path, `SELECT * FROM "${table}" LIMIT 200`)
    if (dataRes && dataRes.length > 0) {
      setColumns(Object.keys(dataRes[0]))
      setRows(dataRes)
    } else {
      setColumns([])
      setRows([])
    }
    setLoading(false)
  }, [execSql])

  const handleRunSql = useCallback(async () => {
    if (!dbPath || !sql.trim()) return
    setLoading(true)
    const result = await execSql(dbPath, sql)
    if (result && result.length > 0) {
      setColumns(Object.keys(result[0]))
      setRows(result)
    } else if (result) {
      setColumns([])
      setRows([])
    }
    setLoading(false)
  }, [dbPath, sql, execSql])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>🗄️ SQLite Browser</span>
        {dbPath && <span className="text-xs truncate max-w-24" style={{ color: 'var(--accent-green)', fontSize: '9px' }} title={dbPath}>● connected</span>}
      </div>

      {/* Connect bar */}
      <div className="px-2 py-1.5 flex gap-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <input
          value={dbPath}
          onChange={e => setDbPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder={suggestedDb ?? (currentFolder ? `${currentFolder}/database.db` : 'Path to .db file...')}
          className="flex-1 px-2 py-1 rounded text-xs outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: '10px' }}
        />
        {suggestedDb && dbPath !== suggestedDb && (
          <button onClick={() => { setDbPath(suggestedDb); handleConnect(suggestedDb) }}
            className="px-1.5 py-1 rounded text-xs"
            style={{ background: 'var(--accent-mauve)', color: 'white' }} title="Open current file">
            ↑
          </button>
        )}
        <button onClick={() => handleConnect()}
          disabled={loading}
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--accent-mauve)', color: 'white', opacity: loading ? 0.6 : 1 }}>
          {loading ? '…' : 'Open'}
        </button>
      </div>

      {error && (
        <div className="px-2 py-1 text-xs" style={{ color: 'var(--accent-red)', background: 'var(--bg-crust)', fontSize: '10px' }}>
          ⚠ {error}
        </div>
      )}

      {!dbPath ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4 text-center">
          <span className="text-4xl">🗄️</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>SQLite Browser</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open a .db file to browse tables and run queries</p>
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>Requires sqlite3 CLI installed</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Table list */}
          <div className="w-28 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
            <p className="px-2 py-1 text-xs font-semibold" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>TABLES</p>
            {tables.map(t => (
              <button key={t} onClick={() => handleSelectTable(dbPath, t)}
                className="text-left px-2 py-1.5 text-xs truncate transition-colors"
                style={{
                  color: activeTable === t ? 'var(--accent-mauve)' : 'var(--text)',
                  background: activeTable === t ? 'var(--bg-surface0)' : 'transparent',
                  borderLeft: activeTable === t ? '2px solid var(--accent-mauve)' : '2px solid transparent',
                  fontSize: '11px'
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* SQL Editor */}
            <div className="flex gap-1 px-2 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleRunSql()}
                placeholder="SELECT * FROM table LIMIT 100"
                className="flex-1 px-2 py-1 rounded text-xs outline-none font-mono"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: '10px' }}
              />
              <button onClick={handleRunSql} disabled={loading}
                className="px-2 py-1 rounded text-xs font-medium flex-shrink-0"
                style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}
                title="Run (Ctrl+Enter)">
                ▶
              </button>
            </div>

            {/* Row count */}
            {activeTable && (
              <div className="px-2 py-0.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontSize: '10px' }}>
                  {activeTable} · {rowCount.toLocaleString()} rows · showing {rows.length}
                </span>
              </div>
            )}

            {/* Data table */}
            <div className="flex-1 overflow-auto">
              {columns.length > 0 ? (
                <table className="w-full text-xs border-collapse" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                  <thead className="sticky top-0" style={{ background: 'var(--bg-mantle)' }}>
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-2 py-1 text-left font-semibold whitespace-nowrap"
                          style={{ color: 'var(--accent-mauve)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface0)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-surface0)')}>
                        {columns.map(col => (
                          <td key={col} className="px-2 py-0.5 whitespace-nowrap max-w-48 truncate"
                            style={{ color: row[col] === null ? 'var(--text-subtle)' : 'var(--text)', borderRight: '1px solid var(--border)', fontStyle: row[col] === null ? 'italic' : 'normal' }}
                            title={String(row[col] ?? 'NULL')}>
                            {row[col] === null ? 'NULL' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : loading ? (
                <p className="text-xs text-center py-6 animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading…</p>
              ) : (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-subtle)' }}>
                  {activeTable ? 'Empty table' : 'Select a table'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
