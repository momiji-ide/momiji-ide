import { useMemo, useEffect, useRef } from 'react'
import { marked, Renderer } from 'marked'

interface Props {
  content: string
  scrollSync?: number   // 0-1 scroll fraction from editor
}

// ─── Custom renderer — Momiji-themed HTML ────────────────────────────────────
const renderer = new Renderer()

renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  const id = text.toLowerCase().replace(/[^\w]+/g, '-')
  const sizes: Record<number, string> = {
    1: 'font-size:2em;margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid var(--border)',
    2: 'font-size:1.5em;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)',
    3: 'font-size:1.25em;margin:20px 0 8px',
    4: 'font-size:1.05em;margin:16px 0 6px',
    5: 'font-size:0.95em;margin:14px 0 4px',
    6: 'font-size:0.875em;margin:12px 0 4px;color:var(--text-muted)',
  }
  return `<h${depth} id="${id}" style="${sizes[depth] ?? ''};font-weight:700;color:var(--accent-mauve);line-height:1.3">${text}</h${depth}>\n`
}

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const label = lang ?? ''
  return `<div class="md-code-block" style="position:relative;margin:16px 0">
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-surface0);border:1px solid var(--border);border-bottom:none;border-radius:8px 8px 0 0;padding:4px 12px">
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent-mauve);font-weight:600">${label || 'code'}</span>
      <button class="md-copy-btn" data-code="${encodeURIComponent(text)}" style="background:transparent;border:1px solid var(--border);color:var(--text-muted);font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer;font-family:inherit">Copy</button>
    </div>
    <pre style="background:var(--bg-crust);padding:14px 16px;border-radius:0 0 8px 8px;overflow-x:auto;margin:0;border:1px solid var(--border)"><code style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-green);white-space:pre;line-height:1.6">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>
  </div>\n`
}

renderer.codespan = ({ text }: { text: string }) =>
  `<code style="background:var(--bg-surface0);color:var(--accent-green);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.875em">${text}</code>`

renderer.blockquote = ({ text }: { text: string }) =>
  `<blockquote style="border-left:3px solid var(--accent-mauve);padding:8px 16px;margin:16px 0;background:var(--bg-surface0);border-radius:0 8px 8px 0;color:var(--text-muted)">${text}</blockquote>\n`

renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
  `<a href="${href}" title="${title ?? ''}" style="color:var(--accent-mauve);text-decoration:underline;text-underline-offset:3px" target="_blank" rel="noopener">${text}</a>`

renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
  `<figure style="margin:16px 0;text-align:center">
    <img src="${href}" alt="${text}" title="${title ?? ''}" style="max-width:100%;border-radius:8px;border:1px solid var(--border)">
    ${title ? `<figcaption style="font-size:12px;color:var(--text-muted);margin-top:6px">${title}</figcaption>` : ''}
  </figure>\n`

renderer.hr = () =>
  `<hr style="border:none;border-top:1px solid var(--border);margin:24px 0">\n`

renderer.table = ({ header, rows }: { header: string; rows: string }) =>
  `<div style="overflow-x:auto;margin:16px 0">
    <table style="border-collapse:collapse;width:100%;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <thead style="background:var(--bg-surface0)">${header}</thead>
      <tbody>${rows}</tbody>
    </table>
  </div>\n`

renderer.tablerow = ({ text }: { text: string }) =>
  `<tr style="border-top:1px solid var(--border)">${text}</tr>\n`

renderer.tablecell = ({ text, header, align }: { text: string; header: boolean; align?: string | null }) => {
  const style = `padding:8px 14px;text-align:${align ?? 'left'}${header ? ';color:var(--accent-mauve);font-weight:600' : ''}`
  return header ? `<th style="${style}">${text}</th>` : `<td style="${style}">${text}</td>`
}

renderer.checkbox = ({ checked }: { checked: boolean }) =>
  `<input type="checkbox" ${checked ? 'checked' : ''} disabled style="margin-right:6px;accent-color:var(--accent-mauve);cursor:default">`

marked.use({ renderer, gfm: true, breaks: false })

// ─── Word count helper ────────────────────────────────────────────────────────
function wordStats(md: string) {
  const words = md.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~\[\]]/g, '').trim().split(/\s+/).filter(Boolean)
  const readMin = Math.max(1, Math.round(words.length / 200))
  return { words: words.length, readMin }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MarkdownPreview({ content, scrollSync }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const html = useMemo(() => {
    try { return marked(content) as string }
    catch { return `<pre>${content}</pre>` }
  }, [content])

  const stats = useMemo(() => wordStats(content), [content])

  // Wire copy buttons after render
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const btns = container.querySelectorAll('.md-copy-btn')
    const handlers: Array<{ btn: Element; fn: EventListener }> = []
    btns.forEach(btn => {
      const fn: EventListener = () => {
        const code = decodeURIComponent((btn as HTMLElement).dataset.code ?? '')
        navigator.clipboard.writeText(code).then(() => {
          const b = btn as HTMLElement
          const prev = b.textContent
          b.textContent = 'Copied!'
          b.style.color = 'var(--accent-green)'
          setTimeout(() => { b.textContent = prev; b.style.color = '' }, 1500)
        })
      }
      btn.addEventListener('click', fn)
      handlers.push({ btn, fn })
    })
    return () => handlers.forEach(({ btn, fn }) => btn.removeEventListener('click', fn))
  }, [html])

  // Scroll sync from editor
  useEffect(() => {
    if (scrollSync === undefined) return
    const el = containerRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll > 0) el.scrollTop = scrollSync * maxScroll
  }, [scrollSync])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-1 flex-shrink-0"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: 28 }}>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {stats.words} words · ~{stats.readMin} min read
        </span>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          background: 'var(--bg-base)',
          color: 'var(--text)',
          fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
          fontSize: 15,
          lineHeight: 1.75,
          padding: '24px 40px 48px',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
