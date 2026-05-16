import { useAppStore } from '../store/appStore'

/**
 * Call whichever AI provider is currently enabled.
 * Returns the text reply or throws.
 */
export async function callKitsune(prompt: string, systemPrompt?: string): Promise<string> {
  const { aiProviders } = useAppStore.getState()
  const provider = aiProviders.find((p) => p.enabled && p.apiKey)
  if (!provider) throw new Error('NO_PROVIDER')

  const sys = systemPrompt ?? `You are Kitsune, the friendly AI assistant inside Parallax IDE.
You help people of all skill levels understand and fix their code.
Be concise, warm, and encouraging. Avoid jargon. Use plain language.`

  if (provider.id === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: provider.model, max_tokens: 1024, system: sys, messages: [{ role: 'user', content: prompt }] })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error?.message ?? 'Claude error')
    return d.content[0].text as string
  }

  if (provider.id === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      }
    )
    const d = await res.json()
    if (!res.ok) throw new Error(d.error?.message ?? 'Gemini error')
    return d.candidates[0].content.parts[0].text as string
  }

  // OpenAI
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] })
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error?.message ?? 'OpenAI error')
  return d.choices[0].message.content as string
}

/** Parse error line number from common runtime error formats */
export function parseErrorLine(errorText: string): number | null {
  const patterns = [
    /File ".+", line (\d+)/,          // Python
    /\.py:(\d+):/,                     // Python gcc-style
    /\bat line (\d+)/i,                // generic
    /\.js:(\d+):/,                     // JS
    /\.ts:(\d+):/,                     // TS
    /:(\d+):\d+:/,                     // C/C++ (file.c:5:3:)
    /line (\d+),? col/i,               // generic
    /line (\d+)/i,                     // last resort
  ]
  for (const p of patterns) {
    const m = errorText.match(p)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

/** Check if output text contains a runtime/compile error */
export function hasError(stderr: string, exitCode: number): boolean {
  if (exitCode === 0) return false
  if (!stderr.trim()) return false
  // Filter out warnings-only scenarios
  const errorKeywords = ['error', 'exception', 'traceback', 'fatal', 'failed', 'cannot', 'undefined']
  const lower = stderr.toLowerCase()
  return errorKeywords.some((k) => lower.includes(k))
}
