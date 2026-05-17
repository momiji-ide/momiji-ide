/**
 * Kitsune AI — Inline Code Completion (Copilot-style)
 *
 * Registers a Monaco InlineCompletionsProvider that:
 * 1. Fires after 600ms of inactivity
 * 2. Sends code context to the active AI provider
 * 3. Shows ghost text in the editor
 * 4. Tab to accept, Escape to dismiss
 */

import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { useAppStore } from '../../store/appStore'

const DEBOUNCE_MS = 700
const MAX_CONTEXT_LINES = 60  // lines before cursor to send as context
const MAX_SUFFIX_LINES  = 10  // lines after cursor for FIM (fill-in-middle)

// Build the prompt for code completion
function buildPrompt(prefix: string, suffix: string, language: string): string {
  return `You are an expert ${language} programmer. Complete the code at the cursor position.

RULES:
- Output ONLY the completion code, nothing else
- No markdown, no backticks, no explanation
- Max 5 lines
- Match the existing code style and indentation
- If the line is complete, start the next logical line

CODE BEFORE CURSOR:
${prefix}
<CURSOR>
CODE AFTER CURSOR:
${suffix}

COMPLETION:`
}

// Call Claude for completion
async function callClaude(apiKey: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? ''
}

// Call Gemini
async function callGemini(apiKey: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
      }),
      signal,
    }
  )
  if (!res.ok) return ''
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

// Call OpenAI / Ollama
async function callOpenAI(apiKey: string, model: string, baseUrl: string, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || 'ollama'}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export function useInlineCompletion(
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof Monaco | null>
) {
  const disposeRef = useRef<Monaco.IDisposable | null>(null)
  const abortRef   = useRef<AbortController | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout>>()
  const enabledRef = useRef(true)

  useEffect(() => {
    const monaco = monacoRef.current
    const editor = editorRef.current
    if (!monaco || !editor) return

    // Register inline completions provider for all languages
    disposeRef.current = monaco.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model, position, _context, token) => {
        if (!enabledRef.current) return { items: [] }

        // Get active AI provider
        const { aiProviders } = useAppStore.getState()
        const provider = aiProviders.find(p =>
          p.enabled && (p.apiKey || p.id === 'ollama')
        )
        if (!provider) return { items: [] }

        // Build prefix (code before cursor)
        const lineCount  = model.getLineCount()
        const startLine  = Math.max(1, position.lineNumber - MAX_CONTEXT_LINES)
        const endLine    = position.lineNumber
        const suffixEnd  = Math.min(lineCount, position.lineNumber + MAX_SUFFIX_LINES)

        const prefix = model.getValueInRange({
          startLineNumber: startLine, startColumn: 1,
          endLineNumber:   endLine,   endColumn: position.column,
        })
        const suffix = model.getValueInRange({
          startLineNumber: endLine,    startColumn: position.column,
          endLineNumber:   suffixEnd,  endColumn: model.getLineMaxColumn(suffixEnd),
        })

        // Don't complete on empty lines or very short context
        const currentLine = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        if (currentLine.trim().length < 2) return { items: [] }

        // Debounce — wait for typing to stop
        clearTimeout(timerRef.current)
        await new Promise<void>((resolve, reject) => {
          timerRef.current = setTimeout(resolve, DEBOUNCE_MS)
          token.onCancellationRequested(reject)
        }).catch(() => null)

        if (token.isCancellationRequested) return { items: [] }

        // Abort previous request
        abortRef.current?.abort()
        const ctrl = new AbortController()
        abortRef.current = ctrl

        const lang   = model.getLanguageId()
        const prompt = buildPrompt(prefix, suffix, lang)

        let completion = ''
        try {
          if (provider.id === 'claude') {
            completion = await callClaude(provider.apiKey, provider.model, prompt, ctrl.signal)
          } else if (provider.id === 'gemini') {
            completion = await callGemini(provider.apiKey, provider.model, prompt, ctrl.signal)
          } else if (provider.id === 'openai') {
            completion = await callOpenAI(provider.apiKey, provider.model, 'https://api.openai.com', prompt, ctrl.signal)
          } else if (provider.id === 'ollama') {
            completion = await callOpenAI('', provider.model, provider.baseUrl ?? 'http://localhost:11434', prompt, ctrl.signal)
          }
        } catch {
          return { items: [] }
        }

        if (!completion || token.isCancellationRequested) return { items: [] }

        // Clean up completion — remove any markdown fences if AI added them
        completion = completion
          .replace(/^```[\w]*\n?/, '')
          .replace(/\n?```$/, '')
          .trimEnd()

        return {
          items: [{
            insertText: completion,
            range: {
              startLineNumber: position.lineNumber,
              startColumn:     position.column,
              endLineNumber:   position.lineNumber,
              endColumn:       position.column,
            },
          }],
          enableForwardStability: true,
        }
      },
      freeInlineCompletions: () => {},
    })

    return () => {
      disposeRef.current?.dispose()
      abortRef.current?.abort()
      clearTimeout(timerRef.current)
    }
  }, [editorRef.current, monacoRef.current]) // eslint-disable-line

  return {
    toggle: () => { enabledRef.current = !enabledRef.current; return enabledRef.current },
    isEnabled: () => enabledRef.current,
  }
}
