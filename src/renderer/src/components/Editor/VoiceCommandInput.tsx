import { useState, useRef, useEffect } from 'react'
import { processVoiceCommand } from '../../utils/voiceToCode'

interface Props {
  language: string
  onInsert: (code: string, description: string) => void
  onClose: () => void
}

const EXAMPLES = [
  'create function called greet',
  'for loop 10 times',
  'if statement',
  'console log',
  'create variable called total',
  'try catch',
  'while loop',
  'create class called Player',
  'return result',
  'import React from react'
]

export function VoiceCommandInput({ language, onInsert, onClose }: Props) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (value.trim()) {
      const result = processVoiceCommand(value, language)
      setPreview(result.code)
    } else {
      setPreview('')
    }
  }, [value, language])

  const handleInsert = () => {
    if (!value.trim()) return
    const result = processVoiceCommand(value, language)
    onInsert(result.code, `"${value}" → ${result.description}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleInsert() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-50 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          bottom: '48px',
          right: '16px',
          width: '380px',
          background: 'var(--bg-surface0)',
          border: '1px solid var(--accent-mauve)',
          animation: 'slideInRight 0.15s ease-out'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🎙️</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Voice Command</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Type what you'd say · Enter to insert</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs w-6 h-6 flex items-center justify-center rounded"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "create function called greet"'
              className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text)',
                border: '1px solid var(--border)'
              }}
            />
            <button
              onClick={handleInsert}
              disabled={!value.trim()}
              className="px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
              style={{
                background: value.trim() ? 'var(--accent-mauve)' : 'var(--bg-surface1)',
                color: value.trim() ? 'var(--bg-base)' : 'var(--text-muted)'
              }}
            >
              Insert
            </button>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div
                className="px-3 py-1 text-xs"
                style={{ background: 'var(--bg-mantle)', color: 'var(--text-subtle)' }}
              >
                Preview ({language})
              </div>
              <pre
                className="px-3 py-2 text-xs overflow-auto"
                style={{
                  background: 'var(--bg-crust)',
                  color: 'var(--accent-green)',
                  fontFamily: "'JetBrains Mono', monospace",
                  maxHeight: '80px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {preview}
              </pre>
            </div>
          )}

          {/* Example chips */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>
              Quick examples — click to try:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.slice(0, 6).map(ex => (
                <button
                  key={ex}
                  onClick={() => setValue(ex)}
                  className="text-xs px-2 py-1 rounded-full transition-colors"
                  style={{
                    background: 'var(--bg-surface1)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent-mauve)'
                    e.currentTarget.style.color = 'var(--bg-base)'
                    e.currentTarget.style.borderColor = 'var(--accent-mauve)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-surface1)'
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
