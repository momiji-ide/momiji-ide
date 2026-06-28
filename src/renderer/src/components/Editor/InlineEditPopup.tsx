import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'

interface Props {
  selection: string
  position: { top: number; left: number }
  language: string
  onApply: (newCode: string) => void
  onCancel: () => void
}

export function InlineEditPopup({ selection, position, language, onApply, onCancel }: Props) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { aiProviders } = useAppStore()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSubmit = async () => {
    if (!instruction.trim() || loading) return
    const provider = aiProviders.find(p => p.enabled && (p.apiKey || p.id === 'ollama' || p.id === 'custom'))
    if (!provider) return

    setLoading(true)
    const prompt = `Edit the following ${language} code according to the instruction. Output ONLY the edited code, no explanations, no markdown fences.\n\nInstruction: ${instruction}\n\nCode:\n${selection}`

    try {
      let edited = ''
      if (provider.id === 'claude') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: provider.model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
        })
        const data = await resp.json()
        edited = data.content?.[0]?.text ?? ''
      } else if (provider.id === 'gemini') {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        })
        const data = await resp.json()
        edited = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      } else {
        const endpoints: Record<string, string> = {
          groq: 'https://api.groq.com/openai/v1/chat/completions',
          openai: 'https://api.openai.com/v1/chat/completions',
          deepseek: 'https://api.deepseek.com/v1/chat/completions',
          mistral: 'https://api.mistral.ai/v1/chat/completions',
          sambanova: 'https://api.sambanova.ai/v1/chat/completions',
          cerebras: 'https://api.cerebras.ai/v1/chat/completions',
          openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        }
        const url = provider.id === 'ollama'
          ? `${provider.baseUrl ?? 'http://localhost:11434'}/v1/chat/completions`
          : (provider.baseUrl ? `${provider.baseUrl.replace(/\/$/, '')}/v1/chat/completions` : endpoints[provider.id])
        if (!url) throw new Error('No endpoint')
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey || 'ollama'}` },
          body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }] })
        })
        const data = await resp.json()
        edited = data.choices?.[0]?.message?.content ?? ''
      }
      const cleaned = edited.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim()
      setResult(cleaned)
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
    setLoading(false)
  }

  return (
    <div className="fixed z-50" style={{ top: position.top, left: position.left, minWidth: 360, maxWidth: 500 }}>
      <div className="rounded-lg shadow-2xl overflow-hidden" style={{ background: 'var(--bg-mantle)', border: '1px solid var(--accent-mauve)88' }}>
        {!result ? (
          <div className="flex items-center gap-1 p-1.5">
            <span style={{ color: 'var(--accent-mauve)', fontSize: 11, fontWeight: 700, paddingLeft: 6 }}>K</span>
            <input
              ref={inputRef}
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel() }}
              placeholder="Describe the edit…"
              disabled={loading}
              className="flex-1 px-2 py-1.5 rounded text-xs outline-none"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: 'none' }}
            />
            {loading
              ? <span className="text-xs px-2 animate-pulse" style={{ color: 'var(--accent-mauve)' }}>thinking…</span>
              : <button onClick={handleSubmit} disabled={!instruction.trim()}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ background: instruction.trim() ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: instruction.trim() ? 'white' : 'var(--text-subtle)' }}>
                  ↵
                </button>
            }
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--accent-mauve)' }}>Edit preview</span>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{instruction}</span>
            </div>
            <pre className="px-3 py-2 text-xs overflow-x-auto" style={{ color: 'var(--accent-green)', fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto', margin: 0 }}>
              {result}
            </pre>
            <div className="flex gap-1.5 px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => onApply(result!)}
                className="flex-1 py-1 rounded text-xs font-semibold"
                style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
                ✓ Apply
              </button>
              <button onClick={() => setResult(null)}
                className="px-3 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                ↻ Retry
              </button>
              <button onClick={onCancel}
                className="px-3 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
