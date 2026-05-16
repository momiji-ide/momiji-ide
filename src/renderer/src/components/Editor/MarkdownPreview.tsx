import { useMemo } from 'react'

interface Props { content: string }

function parseMarkdown(md: string): string {
  let h = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Code blocks
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre style="background:var(--bg-crust);padding:12px 16px;border-radius:8px;overflow-x:auto;margin:12px 0;border:1px solid var(--border)"><code style="font-family:monospace;font-size:13px;color:var(--accent-green);white-space:pre">${code.trimEnd()}</code></pre>`)

  // Inline code
  h = h.replace(/`([^`]+)`/g, '<code style="background:var(--bg-surface0);color:var(--accent-green);padding:1px 6px;border-radius:4px;font-family:monospace;font-size:0.9em">$1</code>')

  // Headings
  h = h.replace(/^#{6}\s+(.+)$/gm, '<h6 style="color:var(--text);font-size:14px;margin:12px 0 6px">$1</h6>')
  h = h.replace(/^#{5}\s+(.+)$/gm, '<h5 style="color:var(--text);font-size:15px;margin:12px 0 6px">$1</h5>')
  h = h.replace(/^#{4}\s+(.+)$/gm, '<h4 style="color:var(--text);font-size:16px;margin:14px 0 6px">$1</h4>')
  h = h.replace(/^#{3}\s+(.+)$/gm, '<h3 style="color:var(--accent-blue);font-size:18px;margin:16px 0 8px;font-weight:700">$1</h3>')
  h = h.replace(/^#{2}\s+(.+)$/gm, '<h2 style="color:var(--accent-mauve);font-size:22px;margin:20px 0 10px;font-weight:700;border-bottom:1px solid var(--border);padding-bottom:6px">$1</h2>')
  h = h.replace(/^#{1}\s+(.+)$/gm, '<h1 style="color:var(--accent-mauve);font-size:28px;margin:0 0 16px;font-weight:800;border-bottom:2px solid var(--border);padding-bottom:10px">$1</h1>')

  // Bold & italic
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em style="color:var(--accent-peach)">$1</em></strong>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--accent-yellow)">$1</strong>')
  h = h.replace(/\*(.+?)\*/g, '<em style="color:var(--accent-teal)">$1</em>')
  h = h.replace(/~~(.+?)~~/g, '<del style="color:var(--text-subtle)">$1</del>')

  // Links & images
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0">')
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent-blue);text-decoration:underline" target="_blank">$1</a>')

  // Blockquote
  h = h.replace(/^&gt;\s*(.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-blue);padding:8px 16px;margin:12px 0;background:var(--bg-surface0);border-radius:0 8px 8px 0;color:var(--text-muted)">$1</blockquote>')

  // Horizontal rule
  h = h.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0">')

  // Checkboxes
  h = h.replace(/^- \[x\] (.+)$/gm, '<li style="list-style:none;padding:2px 0"><input type="checkbox" checked disabled style="margin-right:8px;accent-color:var(--accent-green)">$1</li>')
  h = h.replace(/^- \[ \] (.+)$/gm, '<li style="list-style:none;padding:2px 0"><input type="checkbox" disabled style="margin-right:8px">$1</li>')

  // Unordered lists
  h = h.replace(/^[*-] (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
  h = h.replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="padding-left:24px;margin:8px 0">${m}</ul>`)

  // Ordered lists
  h = h.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')

  // Tables
  h = h.replace(/^(\|.+\|)\n\|[-|: ]+\|\n((?:\|.+\|\n?)*)/gm, (_, head, body) => {
    const ths = head.split('|').filter((s: string) => s.trim())
      .map((s: string) => `<th style="padding:8px 14px;background:var(--bg-surface0);color:var(--accent-blue);font-weight:600;text-align:left;white-space:nowrap">${s.trim()}</th>`).join('')
    const trs = body.trim().split('\n').map((row: string) =>
      `<tr>${row.split('|').filter((s: string) => s.trim()).map((s: string) => `<td style="padding:8px 14px;border-top:1px solid var(--border)">${s.trim()}</td>`).join('')}</tr>`
    ).join('')
    return `<table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid var(--border);border-radius:8px;overflow:hidden"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
  })

  // Paragraphs — wrap lines that aren't already HTML
  h = h.replace(/^(?!<[h1-9|ul|ol|li|pre|blockquote|table|hr|img|div|p])(.+)$/gm, '<p style="margin:6px 0;line-height:1.75">$1</p>')

  // Double newlines → spacing
  h = h.replace(/\n\n/g, '<br style="display:block;margin:6px 0">')

  return h
}

export function MarkdownPreview({ content }: Props) {
  const html = useMemo(() => parseMarkdown(content), [content])

  return (
    <div
      className="h-full overflow-y-auto px-8 py-6"
      style={{
        background: 'var(--bg-base)',
        color: 'var(--text)',
        fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
        fontSize: 15,
        lineHeight: 1.7
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
