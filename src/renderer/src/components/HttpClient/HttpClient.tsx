import { useState, useCallback, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
type BodyType = 'none' | 'json' | 'text' | 'form'
type AuthType = 'none' | 'bearer' | 'basic'
type ReqTab = 'params' | 'headers' | 'body' | 'auth'
type ResTab = 'body' | 'headers' | 'info'

interface KV { id: number; key: string; value: string; enabled: boolean }
interface HistoryItem {
  id: number; method: Method; url: string
  status?: number; elapsed?: number; time: string
}
interface Collection { id: number; name: string; method: Method; url: string; headers: KV[]; body: string; bodyType: BodyType }

const METHOD_COLORS: Record<Method, string> = {
  GET: '#a6e3a1', POST: '#89b4fa', PUT: '#f9e2af',
  PATCH: '#fab387', DELETE: '#f38ba8', HEAD: '#cba6f7', OPTIONS: '#94e2d5'
}

let kvId = 0
const newKV = (): KV => ({ id: kvId++, key: '', value: '', enabled: true })

const SAVED_KEY = 'parallax:http:collections'
const HISTORY_KEY = 'parallax:http:history'

function loadCollections(): Collection[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') } catch { return [] }
}
function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

export function HttpClient() {
  const { settings } = useAppStore()
  const monacoTheme = settings.theme === 'dark' ? 'parallax-dark' : 'parallax-light'

  const [method, setMethod] = useState<Method>('GET')
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1')
  const [reqTab, setReqTab] = useState<ReqTab>('headers')
  const [resTab, setResTab] = useState<ResTab>('body')

  const [params, setParams] = useState<KV[]>([newKV()])
  const [headers, setHeaders] = useState<KV[]>([
    { id: kvId++, key: 'Content-Type', value: 'application/json', enabled: true },
    { id: kvId++, key: 'Accept', value: 'application/json', enabled: true },
    newKV()
  ])
  const [bodyType, setBodyType] = useState<BodyType>('none')
  const [body, setBody] = useState('{\n  \n}')
  const [authType, setAuthType] = useState<AuthType>('none')
  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState('')
  const [authPass, setAuthPass] = useState('')

  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    status: number; statusText: string; headers: Record<string, string>
    body: string; elapsed: number; size: number
  } | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)
  const [collections, setCollections] = useState<Collection[]>(loadCollections)
  const [showHistory, setShowHistory] = useState(false)
  const [saveDialogName, setSaveDialogName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const buildRequestUrl = useCallback(() => {
    const activeParams = params.filter(p => p.enabled && p.key)
    if (!activeParams.length) return url
    const qs = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
  }, [url, params])

  const buildHeaders = useCallback(() => {
    const h: Record<string, string> = {}
    headers.filter(hd => hd.enabled && hd.key).forEach(hd => { h[hd.key] = hd.value })
    if (authType === 'bearer' && authToken) h['Authorization'] = `Bearer ${authToken}`
    if (authType === 'basic' && authUser) h['Authorization'] = `Basic ${btoa(`${authUser}:${authPass}`)}`
    return h
  }, [headers, authType, authToken, authUser, authPass])

  const send = useCallback(async () => {
    const reqUrl = buildRequestUrl()
    if (!reqUrl.startsWith('http')) { toast.error('URL must start with http:// or https://'); return }

    setLoading(true); setError(''); setResponse(null)

    try {
      const bodyContent =
        bodyType === 'none' ? undefined :
        bodyType === 'json' ? body :
        bodyType === 'text' ? body :
        body

      const result = await window.api.http.request({
        method,
        url: reqUrl,
        headers: buildHeaders(),
        body: ['GET', 'HEAD'].includes(method) ? undefined : bodyContent
      })

      if (!result.ok) {
        setError(result.error ?? 'Request failed')
        toast.error(`Request failed: ${result.error}`)
      } else {
        const bodyText = result.body ?? ''
        setResponse({
          status: result.status,
          statusText: result.statusText,
          headers: result.headers ?? {},
          body: bodyText,
          elapsed: result.elapsed,
          size: new Blob([bodyText]).size
        })
        setResTab('body')

        const hi: HistoryItem = {
          id: Date.now(), method, url: reqUrl,
          status: result.status, elapsed: result.elapsed,
          time: new Date().toLocaleTimeString()
        }
        const newHistory = [hi, ...history.slice(0, 49)]
        setHistory(newHistory)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); toast.error(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [method, buildRequestUrl, buildHeaders, bodyType, body, history])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send()
  }

  const saveCollection = () => {
    if (!saveDialogName.trim()) return
    const col: Collection = { id: Date.now(), name: saveDialogName.trim(), method, url, headers, body, bodyType }
    const updated = [col, ...collections]
    setCollections(updated)
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated))
    setShowSaveDialog(false)
    setSaveDialogName('')
    toast.success(`Saved as "${col.name}"`)
  }

  const loadCollection = (col: Collection) => {
    setMethod(col.method); setUrl(col.url)
    setHeaders(col.headers); setBody(col.body); setBodyType(col.bodyType)
    setShowHistory(false)
    toast.info(`Loaded: ${col.name}`)
  }

  const statusColor = (s: number) => s >= 500 ? 'var(--accent-red)' : s >= 400 ? 'var(--accent-yellow)' : s >= 300 ? 'var(--accent-blue)' : 'var(--accent-green)'

  const formatBody = (text: string) => {
    try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
  }

  const bodyLanguage = (text: string) => {
    try { JSON.parse(text); return 'json' } catch {}
    if (text.startsWith('<')) return 'html'
    return 'plaintext'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--accent-blue)' }}>🌐 REST Client</span>
        <div className="flex-1" />
        <button onClick={() => setShowHistory(!showHistory)}
          className="text-xs px-2 py-1 rounded"
          style={{ background: showHistory ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: showHistory ? 'var(--bg-base)' : 'var(--text-muted)' }}>
          📋 History ({history.length})
        </button>
        <button onClick={() => setShowSaveDialog(true)}
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          💾 Save
        </button>
        {collections.length > 0 && (
          <select onChange={e => { const col = collections.find(c => c.id === +e.target.value); if (col) loadCollection(col); e.target.value = '' }}
            className="text-xs px-2 py-1 rounded outline-none"
            style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <option value="">📁 Saved ({collections.length})</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.method} · {c.name}</option>)}
          </select>
        )}
      </div>

      {/* ── URL bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <select value={method} onChange={e => setMethod(e.target.value as Method)}
          className="text-xs font-bold px-2 py-2 rounded-lg outline-none flex-shrink-0"
          style={{ background: 'var(--bg-surface0)', color: METHOD_COLORS[method], border: `1px solid ${METHOD_COLORS[method]}`, minWidth: 90 }}>
          {(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'] as Method[]).map(m => (
            <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
          ))}
        </select>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }} />
        <button onClick={send} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 transition-all"
          style={{ background: loading ? 'var(--bg-surface0)' : 'var(--accent-green)', color: loading ? 'var(--text-muted)' : 'var(--bg-base)', minWidth: 80 }}>
          {loading ? <><span className="animate-spin text-xs">⟳</span> Wait</> : '▶ Send'}
        </button>
      </div>
      <div className="px-4 py-0.5 flex-shrink-0" style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Ctrl+Enter to send</span>
      </div>

      {/* ── Main split ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Request panel */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 50%', borderRight: '1px solid var(--border)' }}>
          {/* Request tabs */}
          <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            {(['params','headers','body','auth'] as ReqTab[]).map(t => (
              <button key={t} onClick={() => setReqTab(t)}
                className="px-3 py-1.5 text-xs capitalize transition-colors"
                style={{ color: reqTab === t ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: reqTab === t ? '2px solid var(--accent-blue)' : '2px solid transparent' }}>
                {t === 'params' ? `Params${params.filter(p=>p.enabled&&p.key).length ? ' ('+params.filter(p=>p.enabled&&p.key).length+')' : ''}` :
                 t === 'headers' ? `Headers${headers.filter(h=>h.enabled&&h.key).length ? ' ('+headers.filter(h=>h.enabled&&h.key).length+')' : ''}` :
                 t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {reqTab === 'params' && (
              <KVEditor rows={params} onChange={setParams} placeholder={{ key: 'param', value: 'value' }} />
            )}
            {reqTab === 'headers' && (
              <KVEditor rows={headers} onChange={setHeaders} placeholder={{ key: 'Header', value: 'Value' }} />
            )}
            {reqTab === 'body' && (
              <div className="flex flex-col h-full">
                <div className="flex gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                  {(['none','json','text'] as BodyType[]).map(bt => (
                    <button key={bt} onClick={() => setBodyType(bt)}
                      className="px-3 py-1 rounded text-xs capitalize"
                      style={{ background: bodyType === bt ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: bodyType === bt ? 'var(--bg-base)' : 'var(--text-muted)' }}>
                      {bt}
                    </button>
                  ))}
                </div>
                {bodyType === 'none' ? (
                  <div className="flex items-center justify-center flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>No body for this request</p>
                  </div>
                ) : (
                  <div className="flex-1">
                    <MonacoEditor
                      language={bodyType === 'json' ? 'json' : 'plaintext'}
                      value={body}
                      theme={monacoTheme}
                      onChange={v => setBody(v ?? '')}
                      options={{ fontSize: 12, minimap: { enabled: false }, lineNumbers: 'off', padding: { top: 8 }, scrollBeyondLastLine: false, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  </div>
                )}
              </div>
            )}
            {reqTab === 'auth' && (
              <div className="p-4 flex flex-col gap-4">
                <div className="flex gap-2">
                  {(['none','bearer','basic'] as AuthType[]).map(a => (
                    <button key={a} onClick={() => setAuthType(a)}
                      className="px-3 py-1.5 rounded text-xs capitalize"
                      style={{ background: authType === a ? 'var(--accent-blue)' : 'var(--bg-surface0)', color: authType === a ? 'var(--bg-base)' : 'var(--text-muted)' }}>
                      {a === 'bearer' ? 'Bearer Token' : a === 'basic' ? 'Basic Auth' : 'No Auth'}
                    </button>
                  ))}
                </div>
                {authType === 'bearer' && (
                  <LabeledInput label="Token" value={authToken} onChange={setAuthToken} placeholder="your-token-here" />
                )}
                {authType === 'basic' && (
                  <>
                    <LabeledInput label="Username" value={authUser} onChange={setAuthUser} placeholder="username" />
                    <LabeledInput label="Password" value={authPass} onChange={setAuthPass} placeholder="password" type="password" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Response panel */}
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Response tabs + status */}
          <div className="flex items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-mantle)' }}>
            <div className="flex flex-1">
              {(['body','headers','info'] as ResTab[]).map(t => (
                <button key={t} onClick={() => setResTab(t)}
                  className="px-3 py-1.5 text-xs capitalize transition-colors"
                  style={{ color: resTab === t ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: resTab === t ? '2px solid var(--accent-blue)' : '2px solid transparent' }}>
                  {t}
                </button>
              ))}
            </div>
            {response && (
              <div className="flex items-center gap-3 px-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: statusColor(response.status) + '22', color: statusColor(response.status) }}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{response.elapsed}ms</span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {response.size > 1024 ? `${(response.size/1024).toFixed(1)}KB` : `${response.size}B`}
                </span>
                <button onClick={() => navigator.clipboard.writeText(response.body).then(() => toast.success('Copied!'))}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  📋
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!response && !error && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <span style={{ fontSize: 48 }}>🌐</span>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>HTTP REST Client</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Enter a URL, configure your request, and press ▶ Send (or Ctrl+Enter)
                </p>
                <div className="text-xs p-3 rounded-lg text-left w-full max-w-xs"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)' }}>
                  <p>🔥 Bypass CORS — requests from main process</p>
                  <p>💾 Save requests as collections</p>
                  <p>📋 Full request history</p>
                  <p>🔐 Bearer & Basic auth support</p>
                </div>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sending request...</p>
              </div>
            )}
            {error && !loading && (
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--accent-red)' }}>✕</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--accent-red)' }}>Request Failed</span>
                </div>
                <pre className="text-xs p-3 rounded-lg" style={{ background: 'var(--bg-crust)', color: 'var(--accent-red)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {error}
                </pre>
              </div>
            )}
            {response && !loading && (
              <>
                {resTab === 'body' && (
                  <MonacoEditor
                    language={bodyLanguage(response.body)}
                    value={formatBody(response.body)}
                    theme={monacoTheme}
                    options={{ readOnly: true, fontSize: 12, minimap: { enabled: false }, lineNumbers: 'on', padding: { top: 8 }, scrollBeyondLastLine: false, wordWrap: 'on', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                )}
                {resTab === 'headers' && (
                  <div className="p-3 flex flex-col gap-1">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-2 py-1.5 px-2 rounded text-xs"
                        style={{ background: 'var(--bg-surface0)' }}>
                        <span className="font-medium flex-shrink-0" style={{ color: 'var(--accent-blue)', minWidth: 180 }}>{k}</span>
                        <span className="flex-1 break-all" style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {resTab === 'info' && (
                  <div className="p-4 flex flex-col gap-3">
                    {[
                      ['Method', method],
                      ['URL', buildRequestUrl()],
                      ['Status', `${response.status} ${response.statusText}`],
                      ['Time', `${response.elapsed}ms`],
                      ['Size', `${response.size} bytes (${(response.size/1024).toFixed(2)} KB)`],
                      ['Content-Type', response.headers['content-type'] ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>{label}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: 200, borderTop: '1px solid var(--border)', background: 'var(--bg-crust)' }}>
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>HISTORY</span>
            <button onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY) }}
              className="text-xs" style={{ color: 'var(--accent-red)' }}>Clear</button>
          </div>
          {history.map(item => (
            <button key={item.id} onClick={() => setUrl(item.url)}
              className="w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: METHOD_COLORS[item.method], minWidth: 55 }}>{item.method}</span>
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{item.url}</span>
              {item.status && <span className="text-xs flex-shrink-0" style={{ color: statusColor(item.status) }}>{item.status}</span>}
              {item.elapsed && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{item.elapsed}ms</span>}
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{item.time}</span>
            </button>
          ))}
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowSaveDialog(false)}>
            <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', width: 320 }}
              onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Save Request</p>
              <input value={saveDialogName} onChange={e => setSaveDialogName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCollection()}
                placeholder="Collection name..." autoFocus
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              <div className="flex gap-2">
                <button onClick={() => setShowSaveDialog(false)} className="flex-1 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-surface1)', color: 'var(--text)' }}>Cancel</button>
                <button onClick={saveCollection} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}>Save</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KVEditor({ rows, onChange, placeholder }: {
  rows: KV[]; onChange: (rows: KV[]) => void
  placeholder: { key: string; value: string }
}) {
  const update = (id: number, patch: Partial<KV>) => {
    let updated = rows.map(r => r.id === id ? { ...r, ...patch } : r)
    // Auto-add new row when last row has content
    const last = updated[updated.length - 1]
    if (last.key || last.value) updated = [...updated, newKV()]
    onChange(updated)
  }
  const remove = (id: number) => onChange(rows.filter(r => r.id !== id).length ? rows.filter(r => r.id !== id) : [newKV()])

  return (
    <div className="p-2 flex flex-col gap-1">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-1">
          <input type="checkbox" checked={row.enabled} onChange={e => update(row.id, { enabled: e.target.checked })} className="flex-shrink-0" style={{ accentColor: 'var(--accent-blue)' }} />
          <input value={row.key} onChange={e => update(row.id, { key: e.target.value })}
            placeholder={placeholder.key}
            className="flex-1 px-2 py-1 rounded text-xs outline-none"
            style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'monospace', opacity: row.enabled ? 1 : 0.5 }} />
          <input value={row.value} onChange={e => update(row.id, { value: e.target.value })}
            placeholder={placeholder.value}
            className="flex-1 px-2 py-1 rounded text-xs outline-none"
            style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'monospace', opacity: row.enabled ? 1 : 0.5 }} />
          {rows.length > 1 && (
            <button onClick={() => remove(row.id)} className="text-xs px-1 flex-shrink-0"
              style={{ color: 'var(--text-subtle)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }} />
    </div>
  )
}
