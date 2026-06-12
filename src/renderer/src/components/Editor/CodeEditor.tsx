import { useCallback, useRef, useEffect, useState } from 'react'
import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useAppStore } from '../../store/appStore'
import { MarkdownPreview } from './MarkdownPreview'
import { CodeFlowchart } from './CodeFlowchart'
import { isFlowchartSupported } from '../../utils/codeToFlowchart'
import { getT, getLang } from '../../utils/i18n'
import { getStats } from '../../utils/usageStats'
import { ImageViewer, isImageFile } from './ImageViewer'
import { HexViewer, isBinaryFile } from './HexViewer'
import { PdfViewer, isPdfFile } from './PdfViewer'
import { MomijiLogo } from '../Logo/MomijiLogo'
import { KitsuneLogo } from '../Logo/KitsuneLogo'
import kitsuneCharImg from '../../assets/kitsune-char.png'
import { FileIcon } from '../Sidebar/FileIcon'
import { ColorPickerPopup, findColorsInLine } from './ColorPicker'
import { useInlineCompletion } from './useInlineCompletion'

// Patterns for finding definitions across languages
function findDefinitionInText(content: string, word: string): number {
  const patterns = [
    // Python
    new RegExp(`^\\s*def\\s+${word}\\s*\\(`, 'm'),
    new RegExp(`^\\s*class\\s+${word}\\s*[:(]`, 'm'),
    new RegExp(`^\\s*async\\s+def\\s+${word}\\s*\\(`, 'm'),
    // JavaScript/TypeScript
    new RegExp(`\\bfunction\\s+${word}\\s*\\(`, 'm'),
    new RegExp(`\\bconst\\s+${word}\\s*=\\s*(?:async\\s+)?(?:\\(|function)`, 'm'),
    new RegExp(`\\blet\\s+${word}\\s*=\\s*(?:async\\s+)?(?:\\(|function)`, 'm'),
    new RegExp(`\\bclass\\s+${word}\\s*(?:extends|\\{)`, 'm'),
    new RegExp(`\\b${word}\\s*:\\s*(?:function|\\()`, 'm'),
    // Go
    new RegExp(`\\bfunc\\s+(?:\\(\\w+\\s+\\*?\\w+\\)\\s+)?${word}\\s*\\(`, 'm'),
    new RegExp(`\\btype\\s+${word}\\s+(?:struct|interface)`, 'm'),
    // Rust
    new RegExp(`\\bfn\\s+${word}\\s*(?:<|\\()`, 'm'),
    new RegExp(`\\bstruct\\s+${word}\\b`, 'm'),
    new RegExp(`\\benum\\s+${word}\\b`, 'm'),
    new RegExp(`\\bimpl\\s+${word}\\b`, 'm'),
    // Java/C#
    new RegExp(`\\b(?:public|private|protected|static|void|\\w+)\\s+${word}\\s*\\(`, 'm'),
    // Generic: variable assignment
    new RegExp(`^\\s*${word}\\s*=(?!=)`, 'm'),
    new RegExp(`^\\s*(?:let|const|var|int|string|bool|float)\\s+${word}\\b`, 'm'),
  ]

  const lines = content.split('\n')
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match.index !== undefined) {
      const charsBefore = content.slice(0, match.index)
      return charsBefore.split('\n').length
    }
  }
  return -1
}

// ─── Markdown Editor — self-contained, used when activeTab.language === 'markdown'
type MdViewMode = 'editor' | 'split' | 'preview'

function MarkdownEditor({ content, monacoTheme, settings, beforeMount, onMount, onChange }: {
  content: string; monacoTheme: string; settings: any
  beforeMount: any; onMount: any; onChange: any
}) {
  const [viewMode, setViewMode]       = useState<MdViewMode>('split')
  const [splitRatio, setSplitRatio]   = useState(50)   // % for editor pane
  const [scrollSync, setScrollSync]   = useState<number | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const isDragging = useRef(false)

  // Formatting helpers — insert markdown syntax at cursor
  const insert = (before: string, after = '', defaultText = '') => {
    const ed = monacoEditorRef.current
    if (!ed) return
    const sel  = ed.getSelection()
    const text = sel ? ed.getModel()?.getValueInRange(sel) || '' : ''
    const replacement = `${before}${text || defaultText}${after}`
    ed.executeEdits('md-toolbar', [{
      range: sel!,
      text: replacement,
      forceMoveMarkers: true,
    }])
    ed.focus()
  }

  // Resizable split drag
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const onMove = (me: MouseEvent) => {
      if (!isDragging.current || !wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      const ratio = Math.round(Math.max(20, Math.min(80, ((me.clientX - rect.left) / rect.width) * 100)))
      setSplitRatio(ratio)
    }
    const onUp = () => { isDragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Toolbar buttons
  const TOOLBAR = [
    { icon: 'B',   title: 'Bold (Ctrl+B)',        fn: () => insert('**', '**', 'bold text'),     style: 'font-weight:800' },
    { icon: 'I',   title: 'Italic (Ctrl+I)',       fn: () => insert('*',  '*',  'italic text'),   style: 'font-style:italic' },
    { icon: 'S',   title: 'Strikethrough',         fn: () => insert('~~', '~~', 'text'),          style: 'text-decoration:line-through' },
    { icon: '─',   title: 'Separator',             fn: null, style: '' },
    { icon: 'H1',  title: 'Heading 1',             fn: () => insert('# ', '', 'Heading'),         style: 'font-weight:700;font-size:10px' },
    { icon: 'H2',  title: 'Heading 2',             fn: () => insert('## ', '', 'Heading'),        style: 'font-weight:700;font-size:10px' },
    { icon: 'H3',  title: 'Heading 3',             fn: () => insert('### ', '', 'Heading'),       style: 'font-weight:700;font-size:10px' },
    { icon: '─',   title: 'Separator',             fn: null, style: '' },
    { icon: '🔗',  title: 'Link',                  fn: () => insert('[', '](url)', 'link text'),  style: '' },
    { icon: '🖼',  title: 'Image',                 fn: () => insert('![', '](url)', 'alt text'),  style: '' },
    { icon: '`',   title: 'Inline code',           fn: () => insert('`', '`', 'code'),            style: 'font-family:monospace' },
    { icon: '```', title: 'Code block',            fn: () => insert('```\n', '\n```', 'code'),    style: 'font-family:monospace;font-size:9px' },
    { icon: '─',   title: 'Separator',             fn: null, style: '' },
    { icon: '>',   title: 'Blockquote',            fn: () => insert('> ', '', 'quote'),           style: 'font-size:12px' },
    { icon: '☑',   title: 'Task list item',        fn: () => insert('- [ ] ', '', 'task'),        style: '' },
    { icon: '—',   title: 'Horizontal rule',       fn: () => insert('\n---\n', '', ''),           style: '' },
  ]

  const handleEditorMount = (ed: editor.IStandaloneCodeEditor, monaco: any) => {
    monacoEditorRef.current = ed
    onMount(ed, monaco)
    // Scroll sync
    ed.onDidScrollChange(e => {
      const model = ed.getModel()
      if (!model) return
      const lineCount = model.getLineCount()
      const fraction  = e.scrollTop / Math.max(1, e.scrollHeight - ed.getLayoutInfo().height)
      setScrollSync(Math.max(0, Math.min(1, fraction)))
    })
  }

  const showEditor  = viewMode !== 'preview'
  const showPreview = viewMode !== 'editor'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: 36 }}>

        {/* Formatting buttons */}
        {TOOLBAR.map((b, i) =>
          b.fn === null
            ? <div key={i} style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />
            : (
              <button key={i} onClick={b.fn} title={b.title}
                className="px-1.5 py-0.5 rounded text-xs transition-colors select-none"
                style={{ color: 'var(--text-muted)', minWidth: 24, textAlign: 'center', ...Object.fromEntries((b.style || '').split(';').filter(Boolean).map(s => { const [k, v] = s.split(':'); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim()] })) } as React.CSSProperties}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {b.icon}
              </button>
            )
        )}

        <div className="flex-1" />

        {/* View mode */}
        <div className="flex p-0.5 rounded-lg gap-0.5 mr-1" style={{ background: 'var(--bg-surface0)' }}>
          {([['editor', '✏️ Edit'], ['split', '⬜ Split'], ['preview', '👁 Preview']] as [MdViewMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setViewMode(m)}
              className="px-2 py-0.5 rounded-md text-xs font-medium transition-all"
              style={{ background: viewMode === m ? 'var(--accent-mauve)' : 'transparent', color: viewMode === m ? 'white' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Export HTML */}
        <button
          onClick={() => {
            const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.75;color:#1f2937}pre{background:#f3f4f6;padding:16px;border-radius:8px;overflow-x:auto}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}a{color:#f97316}h1,h2{border-bottom:1px solid #e5e7eb;padding-bottom:8px}blockquote{border-left:4px solid #f97316;padding:8px 16px;background:#fff7ed;margin:16px 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:8px 12px}img{max-width:100%;border-radius:8px}</style></head><body>${content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>').replace(/#{1,6}\s+(.+)/g, s => { const m = s.match(/^(#{1,6})\s+(.+)/); return m ? `<h${m[1].length}>${m[2]}</h${m[1].length}>` : s })}</body></html>`], { type: 'text/html' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export.html'; a.click()
          }}
          title="Export as HTML"
          className="px-2 py-0.5 rounded text-xs"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          ↗ HTML
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div ref={wrapRef} className="flex flex-1 overflow-hidden" style={{ userSelect: isDragging.current ? 'none' : 'auto' }}>

        {/* Editor pane */}
        {showEditor && (
          <div style={{ flex: viewMode === 'editor' ? '1' : `0 0 ${splitRatio}%`, overflow: 'hidden' }}>
            <MonacoEditor
              language="markdown"
              value={content}
              theme={monacoTheme}
              beforeMount={beforeMount}
              onMount={handleEditorMount}
              onChange={onChange}
              options={{
                fontSize: settings.fontSize, fontFamily: settings.fontFamily,
                wordWrap: 'on', lineNumbers: 'on', minimap: { enabled: false },
                scrollBeyondLastLine: false, padding: { top: 12 },
                scrollbar: { verticalScrollbarSize: 4 },
                renderWhitespace: 'none'
              }}
            />
          </div>
        )}

        {/* Drag handle */}
        {showEditor && showPreview && (
          <div onMouseDown={onDragStart} title="Drag to resize"
            style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: 'var(--border)', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-mauve)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
          />
        )}

        {/* Preview pane */}
        {showPreview && (
          <div style={{ flex: viewMode === 'preview' ? '1' : `0 0 ${100 - splitRatio}%`, overflow: 'hidden' }}>
            <MarkdownPreview
              content={content}
              scrollSync={viewMode === 'split' ? scrollSync : undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function CodeEditor() {
  const { tabs, activeTabId, settings, updateTabContent, markTabClean, splitTabId, setSplitTabId } = useAppStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const splitTab = tabs.find((t) => t.id === splitTabId)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lintTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kitsune AI Inline Completion (Copilot-style)
  const [inlineEnabled, setInlineEnabled] = useState(true)
  const inlineCompletion = useInlineCompletion(editorRef, monacoRef)

  // Git Blame
  const [blameMode, setBlameMode] = useState(false)
  const [blameData, setBlameData] = useState<{ line: number; hash: string; author: string; date: string; summary: string }[]>([])
  const blameDecsRef = useRef<string[]>([])

  // Code → Flowchart split view
  const [showFlowchart, setShowFlowchart] = useState(false)

  useEffect(() => {
    const handler = () => setInlineEnabled(inlineCompletion.toggle())
    window.addEventListener('kitsune:toggleInline', handler)
    return () => window.removeEventListener('kitsune:toggleInline', handler)
  }, [inlineCompletion])

  // ── Flowchart toggle (from EditorToolbar) ─────────────────────────────────
  useEffect(() => {
    const handler = () => setShowFlowchart(v => !v)
    window.addEventListener('editor:toggleFlowchart', handler)
    return () => window.removeEventListener('editor:toggleFlowchart', handler)
  }, [])

  // ── Git Blame toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setBlameMode(v => !v)
    window.addEventListener('editor:toggleBlame', handler)
    return () => window.removeEventListener('editor:toggleBlame', handler)
  }, [])

  useEffect(() => {
    const ed = editorRef.current
    const mo = monacoRef.current
    if (!ed || !mo) return

    // Clear existing blame decorations
    blameDecsRef.current = ed.deltaDecorations(blameDecsRef.current, [])

    if (!blameMode || !activeTab?.filePath || activeTab.filePath.startsWith('__')) return

    const { currentFolder } = useAppStore.getState()
    if (!currentFolder) return

    window.api.git.blame(currentFolder, activeTab.filePath).then(r => {
      if (!r.ok || !r.lines?.length) return
      setBlameData(r.lines)

      // Inject blame as inline text after each line number
      const decos: editor.IModelDeltaDecoration[] = r.lines.map(b => ({
        range: new mo.Range(b.line, 1, b.line, 1),
        options: {
          before: {
            content: ` ${(b.author || 'Unknown').slice(0, 12).padEnd(12)}  ${(b.date || '').slice(0, 11).padEnd(11)}  ${b.hash || '???????'} `,
            inlineClassName: 'blame-gutter-text',
          },
          zIndex: 1,
        }
      }))

      // Inject CSS once
      if (!document.getElementById('blame-style')) {
        const s = document.createElement('style')
        s.id = 'blame-style'
        s.textContent = `.blame-gutter-text { color: #585b70; font-size: 11px; font-family: monospace; background: #11111b; padding: 0 4px; border-right: 1px solid #313244; user-select: none; white-space: pre; }`
        document.head.appendChild(s)
      }

      blameDecsRef.current = ed.deltaDecorations([], decos)
    })
  }, [blameMode, activeTabId]) // eslint-disable-line

  // Color picker state
  const [colorPicker, setColorPicker] = useState<{ color: string; x: number; y: number; line: number; col: number; original: string } | null>(null)

  // Listen for F12 / editor commands from main process
  useEffect(() => {
    const unsub = window.api.editor.onCommand((cmd) => {
      const ed = editorRef.current
      const mo = monacoRef.current
      if (!ed || !mo) return

      const actionMap: Record<string, string> = {
        goToDefinition:   'editor.action.revealDefinition',
        peekDefinition:   'editor.action.peekDefinition',
        findAllReferences:'editor.action.referenceSearch.trigger'
      }

      const builtIn = actionMap[cmd]
      if (builtIn) {
        // Try Monaco's built-in first (works for JS/TS)
        const action = ed.getAction(builtIn)
        if (action) {
          action.run().catch(() => fallbackGoToDefinition(ed))
        } else {
          fallbackGoToDefinition(ed)
        }
      }
    })
    return unsub
  }, [])

  function fallbackGoToDefinition(ed: editor.IStandaloneCodeEditor) {
    // Generic definition finder using regex patterns
    const model = ed.getModel()
    const pos = ed.getPosition()
    if (!model || !pos) return

    const word = model.getWordAtPosition(pos)
    if (!word) return

    const content = model.getValue()
    const targetLine = findDefinitionInText(content, word.word)
    if (targetLine > 0) {
      ed.revealLineInCenter(targetLine)
      ed.setPosition({ lineNumber: targetLine, column: 1 })
      ed.focus()
    } else {
      // If not found in current file, show info
      const lineCount = model.getLineCount()
      ed.revealLineInCenter(1)
    }
  }

  const handleEditorMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance
    monacoRef.current = monaco

    // Ctrl+S = Format + Save
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      const tab = useAppStore.getState().tabs.find(t => t.id === useAppStore.getState().activeTabId)
      if (!tab || tab.filePath.startsWith('__')) return
      // Auto-format before save (Monaco built-in formatter for JS/TS/HTML/CSS/JSON)
      const formattable = ['.js','.ts','.jsx','.tsx','.html','.css','.json','.md']
      const ext = tab.filePath.slice(tab.filePath.lastIndexOf('.'))
      if (formattable.includes(ext)) {
        try { await editorInstance.getAction('editor.action.formatDocument')?.run() } catch {}
      }
      if (tab.isDirty) await saveFile(tab.filePath, tab.content, tab.id)
    })

    // ─── Emit Monaco markers (errors/warnings) to Problems panel ─────
    const emitMarkers = () => {
      const model = editorInstance.getModel()
      if (!model) return
      const raw = monaco.editor.getModelMarkers({ resource: model.uri })
      const items = raw.map(m => ({
        severity: m.severity as 1|2|4|8,
        message: m.message,
        file: model.uri.path,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        code: m.code,
      }))
      window.dispatchEvent(new CustomEvent('editor:markers', { detail: items }))
    }
    editorInstance.onDidChangeModelDecorations(() => setTimeout(emitMarkers, 300))
    monaco.editor.onDidChangeMarkers(() => emitMarkers())

    // ─── Context menu actions ────────────────────────────────────────
    editorInstance.addAction({
      id: 'momiji.goToDefinition',
      label: '🎯 Go to Definition',
      keybindings: [monaco.KeyCode.F12],
      contextMenuGroupId: '1_navigation',
      contextMenuOrder: 1,
      run: (ed) => {
        const action = ed.getAction('editor.action.revealDefinition')
        if (action) action.run().catch(() => fallbackGoToDefinition(ed))
        else fallbackGoToDefinition(ed)
      }
    })

    editorInstance.addAction({
      id: 'momiji.peekDefinition',
      label: '🔍 Peek Definition',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
      contextMenuGroupId: '1_navigation',
      contextMenuOrder: 2,
      run: (ed) => {
        ed.getAction('editor.action.peekDefinition')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.findReferences',
      label: '🔗 Find All References',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
      contextMenuGroupId: '1_navigation',
      contextMenuOrder: 3,
      run: (ed) => {
        ed.getAction('editor.action.referenceSearch.trigger')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.renameSymbol',
      label: '✏️ Rename Symbol',
      keybindings: [monaco.KeyCode.F2],
      contextMenuGroupId: '1_navigation',
      contextMenuOrder: 4,
      run: (ed) => {
        ed.getAction('editor.action.rename')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.formatDocument',
      label: '🎨 Format Document',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      contextMenuGroupId: '2_edit',
      contextMenuOrder: 1,
      run: (ed) => {
        ed.getAction('editor.action.formatDocument')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.toggleComment',
      label: '💬 Toggle Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      contextMenuGroupId: '2_edit',
      contextMenuOrder: 2,
      run: (ed) => {
        ed.getAction('editor.action.commentLine')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.copyLine',
      label: '📋 Copy Line',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      contextMenuGroupId: '2_edit',
      contextMenuOrder: 3,
      run: (ed) => {
        ed.getAction('editor.action.copyLinesDownAction')?.run()
      }
    })

    editorInstance.addAction({
      id: 'momiji.showErrors',
      label: '⚠️ Show Problems',
      contextMenuGroupId: '3_tools',
      contextMenuOrder: 1,
      run: (ed) => {
        ed.getAction('editor.action.marker.nextInFiles')?.run()
        window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'problems' } }))
      }
    })

    // ─── Kitsune AI right-click actions ─────────────────────────────
    const kitsuneAsk = (prompt: string, ed: editor.IStandaloneCodeEditor) => {
      const selection = ed.getSelection()
      const model = ed.getModel()
      if (!model) return
      const selected = selection && !selection.isEmpty()
        ? model.getValueInRange(selection)
        : model.getValue().slice(0, 3000)
      const lang = model.getLanguageId()
      const fullPrompt = `${prompt}\n\nLanguage: ${lang}\n\`\`\`${lang}\n${selected}\n\`\`\``
      window.dispatchEvent(new CustomEvent('kitsune:askWithPrompt', { detail: { prompt: fullPrompt } }))
    }

    editorInstance.addAction({
      id: 'kitsune.explain',
      label: '🦊 Explain this code',
      contextMenuGroupId: '9_kitsune',
      contextMenuOrder: 1,
      run: (ed) => kitsuneAsk('Explain this code clearly and concisely. What does it do?', ed)
    })
    editorInstance.addAction({
      id: 'kitsune.refactor',
      label: '🦊 Refactor / Improve',
      contextMenuGroupId: '9_kitsune',
      contextMenuOrder: 2,
      run: (ed) => kitsuneAsk('Refactor this code to improve readability, performance, and best practices. Show the improved version with explanations.', ed)
    })
    editorInstance.addAction({
      id: 'kitsune.tests',
      label: '🦊 Generate Unit Tests',
      contextMenuGroupId: '9_kitsune',
      contextMenuOrder: 3,
      run: (ed) => kitsuneAsk('Generate comprehensive unit tests for this code. Use appropriate test framework for the language.', ed)
    })
    editorInstance.addAction({
      id: 'kitsune.docs',
      label: '🦊 Generate JSDoc / Docstring',
      contextMenuGroupId: '9_kitsune',
      contextMenuOrder: 4,
      run: (ed) => kitsuneAsk('Generate JSDoc comments (or appropriate docstring for the language) for each function and class in this code.', ed)
    })
    editorInstance.addAction({
      id: 'kitsune.fix',
      label: '🦊 Fix / Debug this',
      contextMenuGroupId: '9_kitsune',
      contextMenuOrder: 5,
      run: (ed) => kitsuneAsk('Find and fix any bugs, errors, or issues in this code. Explain what was wrong.', ed)
    })

    // Listen for jump-to-line from Kitsune error panel
    const jumpHandler = (e: Event) => {
      const { line } = (e as CustomEvent).detail
      editorInstance.revealLineInCenter(line)
      editorInstance.setPosition({ lineNumber: line, column: 1 })
      editorInstance.focus()
    }
    window.addEventListener('editor:jumpToLine', jumpHandler)
    // Cleanup stored on editor dispose
    editorInstance.onDidDispose(() => window.removeEventListener('editor:jumpToLine', jumpHandler))

    // Broadcast cursor position for StatusBar
    editorInstance.onDidChangeCursorPosition((e) => {
      window.dispatchEvent(new CustomEvent('editor:cursor', {
        detail: { line: e.position.lineNumber, col: e.position.column }
      }))
    })

    // Color swatch decorations
    let colorDecorations: string[] = []
    const updateColorDecorations = () => {
      const model = editorInstance.getModel()
      if (!model) return
      const decorations: import('monaco-editor').editor.IModelDeltaDecoration[] = []
      const lineCount = Math.min(model.getLineCount(), 2000)
      for (let i = 1; i <= lineCount; i++) {
        const line = model.getLineContent(i)
        const colors = findColorsInLine(line)
        colors.forEach(c => {
          decorations.push({
            range: new monaco.Range(i, c.col + 1, i, c.col + 1),
            options: {
              before: {
                content: ' ',
                inlineClassName: `color-swatch-${c.hex.slice(1)}`,
              }
            }
          })
        })
      }
      colorDecorations = editorInstance.deltaDecorations(colorDecorations, decorations)
      // Inject swatch styles
      const styleId = 'momiji-color-swatches'
      let styleEl = document.getElementById(styleId)
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl) }
      const allColors = new Set<string>()
      for (let i = 1; i <= lineCount; i++) {
        findColorsInLine(model.getLineContent(i)).forEach(c => allColors.add(c.hex))
      }
      styleEl.textContent = [...allColors].map(hex =>
        `.color-swatch-${hex.slice(1)} { display:inline-block; width:10px; height:10px; background:${hex}; border:1px solid rgba(128,128,128,0.4); border-radius:2px; margin-right:2px; vertical-align:middle; cursor:pointer; }`
      ).join('\n')
    }
    editorInstance.onDidChangeModelContent(() => setTimeout(updateColorDecorations, 300))
    editorInstance.onDidChangeModel(() => setTimeout(updateColorDecorations, 100))
    setTimeout(updateColorDecorations, 200)

    // Click on color swatch → open picker
    editorInstance.onMouseDown((e) => {
      const pos = e.target.position
      if (pos && e.target.type === 1 /* outside gutter */) {
        const model = editorInstance.getModel()
        if (model) {
          const line = model.getLineContent(pos.lineNumber)
          const colors = findColorsInLine(line)
          // Check if click is near a color token
          const hit = colors.find(c => Math.abs(c.col - pos.column + 1) < c.value.length + 2)
          if (hit) {
            const editorDom = editorInstance.getDomNode()
            const rect = editorDom?.getBoundingClientRect()
            const scrolledVisibleRange = editorInstance.getScrolledVisiblePosition({ lineNumber: pos.lineNumber, column: hit.col + 1 })
            if (scrolledVisibleRange && rect) {
              setColorPicker({
                color: hit.hex,
                x: rect.left + scrolledVisibleRange.left,
                y: rect.top + scrolledVisibleRange.top,
                line: pos.lineNumber,
                col: hit.col,
                original: hit.value
              })
              return
            }
          }
        }
      }
    })

    // Override Ctrl+Click for definition (ensure it works)
    editorInstance.onMouseDown((e) => {
      if (e.event.ctrlKey || e.event.metaKey) {
        const pos = e.target.position
        if (pos) {
          setTimeout(() => {
            // Monaco handles Ctrl+Click natively for JS/TS
            // For other languages, use fallback
            const model = editorInstance.getModel()
            if (!model) return
            const word = model.getWordAtPosition(pos)
            if (!word) return
            // Check if built-in definition worked (cursor moved)
            const newPos = editorInstance.getPosition()
            const moved = newPos && (newPos.lineNumber !== pos.lineNumber || newPos.column !== pos.column)
            if (!moved) {
              fallbackGoToDefinition(editorInstance)
            }
          }, 100)
        }
      }
    })
  }, [])

  const saveFile = useCallback(
    async (filePath: string, content: string, tabId: string) => {
      const result = await window.api.fs.writeFile(filePath, content)
      if (result.success) markTabClean(tabId)
    },
    [markTabClean]
  )

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return
      updateTabContent(activeTab.id, value)

      if (settings.autoSave) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = setTimeout(() => {
          saveFile(activeTab.filePath, value, activeTab.id)
        }, settings.autoSaveDelay)
      }

      // Debounced lint (1.2s after last keystroke)
      if (lintTimerRef.current) clearTimeout(lintTimerRef.current)
      lintTimerRef.current = setTimeout(() => runLint(activeTab), 1200)
    },
    [activeTab, settings.autoSave, settings.autoSaveDelay, updateTabContent, saveFile]
  )

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      if (lintTimerRef.current) clearTimeout(lintTimerRef.current)
    }
  }, [])

  // Lint on tab switch
  useEffect(() => { if (activeTab) runLint(activeTab) }, [activeTabId])

  // ── Inline linting ──────────────────────────────────────────────
  const runLint = useCallback(async (tab: typeof activeTab) => {
    if (!tab || !editorRef.current || !monacoRef.current) return
    const model = editorRef.current.getModel()
    if (!model) return
    const mo = monacoRef.current

    if (tab.language === 'python' && !tab.filePath.startsWith('__')) {
      try {
        const pythonPath = useAppStore.getState().settings.pythonPath ?? 'python'
        const errors = await (window.api as any).lint.python(tab.filePath, pythonPath) as
          { line: number; col: number; message: string; severity: string }[]
        mo.editor.setModelMarkers(model, 'momiji-lint', errors.map(e => ({
          startLineNumber: e.line, endLineNumber: e.line,
          startColumn: 1, endColumn: model.getLineMaxColumn(e.line),
          message: e.message,
          severity: e.severity === 'error' ? mo.MarkerSeverity.Error : mo.MarkerSeverity.Warning
        })))
      } catch { /* lint failed silently */ }
    } else {
      // Clear markers for non-Python or unsaved files
      const model2 = editorRef.current?.getModel()
      if (model2) mo.editor.setModelMarkers(model2, 'momiji-lint', [])
    }
  }, [])

  // Apply picked color back to editor
  const handleColorApply = useCallback((newHex: string) => {
    if (!colorPicker || !editorRef.current || !monacoRef.current) return
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor.getModel()
    if (!model) return
    const line = colorPicker.line
    const lineText = model.getLineContent(line)
    const col = colorPicker.col
    const orig = colorPicker.original
    const startCol = col + 1
    const endCol = col + orig.length + 1
    editor.executeEdits('color-picker', [{
      range: new monaco.Range(line, startCol, line, endCol),
      text: newHex
    }])
  }, [colorPicker])

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  const handleEditorBeforeMount = (monaco: typeof import('monaco-editor')) => {
    // Dark theme — Catppuccin Mocha
    monaco.editor.defineTheme('momiji-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '585b70', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'cba6f7' },
        { token: 'string', foreground: 'a6e3a1' },
        { token: 'number', foreground: 'fab387' },
        { token: 'type', foreground: '89dceb' },
        { token: 'function', foreground: '89b4fa' },
        { token: 'variable', foreground: 'cdd6f4' },
        { token: 'operator', foreground: '89dceb' }
      ],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#313244',
        'editor.selectionBackground': '#45475a',
        'editorLineNumber.foreground': '#585b70',
        'editorLineNumber.activeForeground': '#89b4fa',
        'editorCursor.foreground': '#89b4fa',
        'editor.findMatchBackground': '#fab38744',
        'editor.findMatchHighlightBackground': '#fab38722',
        'editorWidget.background': '#181825',
        'editorWidget.border': '#313244',
        'input.background': '#313244',
        'input.foreground': '#cdd6f4',
        'scrollbarSlider.background': '#45475a',
        'scrollbarSlider.hoverBackground': '#585b70',
        'editorIndentGuide.background1': '#313244',
        'editorIndentGuide.activeBackground1': '#585b70',
        'editorBracketMatch.background': '#89b4fa22',
        'editorBracketMatch.border': '#89b4fa'
      }
    })

    // Light theme — Catppuccin Latte
    monaco.editor.defineTheme('momiji-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8c8fa1', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8839ef' },
        { token: 'string', foreground: '40a02b' },
        { token: 'number', foreground: 'fe640b' },
        { token: 'type', foreground: '179299' },
        { token: 'function', foreground: '1e66f5' },
        { token: 'variable', foreground: '4c4f69' }
      ],
      colors: {
        'editor.background': '#eff1f5',
        'editor.foreground': '#4c4f69',
        'editor.lineHighlightBackground': '#e6e9ef',
        'editor.selectionBackground': '#bcc0cc',
        'editorLineNumber.foreground': '#acb0be',
        'editorLineNumber.activeForeground': '#1e66f5',
        'editorCursor.foreground': '#1e66f5',
        'editorWidget.background': '#e6e9ef',
        'editorWidget.border': '#ccd0da',
        'input.background': '#ccd0da',
        'input.foreground': '#4c4f69',
        'scrollbarSlider.background': '#bcc0cc',
        'scrollbarSlider.hoverBackground': '#acb0be'
      }
    })
  }

  if (!activeTab) {
    return <WelcomeScreen />
  }

  // PDF files: native Chromium PDF renderer
  if (isPdfFile(activeTab.filePath)) {
    return <PdfViewer filePath={activeTab.filePath} />
  }

  // Image files: show viewer instead of Monaco
  if (isImageFile(activeTab.filePath)) {
    return <ImageViewer filePath={activeTab.filePath} />
  }

  // Binary files: show hex viewer instead of garbled text
  if (isBinaryFile(activeTab.filePath)) {
    return <HexViewer filePath={activeTab.filePath} />
  }

  // ── Markdown: view-mode toolbar + resizable split + formatting bar ──────
  if (activeTab.language === 'markdown') {
    return <MarkdownEditor
      key={activeTab.id + '-md'}
      content={activeTab.content}
      monacoTheme={monacoTheme}
      settings={settings}
      beforeMount={handleEditorBeforeMount}
      onMount={handleEditorMount}
      onChange={handleChange}
    />
  }

  const monacoOptions = {
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    fontLigatures: true,
    tabSize: settings.tabSize,
    wordWrap: settings.wordWrap,
    minimap: { enabled: settings.minimap },
    lineNumbers: settings.lineNumbers,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on' as const,
    cursorBlinking: 'smooth' as const,
    renderLineHighlight: 'line' as const,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    renderWhitespace: 'selection' as const,
    links: true,
    occurrencesHighlight: 'singleFile' as const,
    definitionLinkOpensInPeek: false,
    multiCursorModifier: 'alt' as const,
    contextmenu: true,
    suggest: { showKeywords: true, showSnippets: true },
    quickSuggestions: { other: true, comments: false, strings: true },
    parameterHints: { enabled: true },
    formatOnType: true,
    autoClosingBrackets: 'always' as const,
    autoClosingQuotes: 'always' as const,
    autoIndent: 'full' as const,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
  }

  // Split editor mode
  if (splitTabId && splitTab) {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Left pane — active tab */}
        <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
          <MonacoEditor key={activeTab.id} language={activeTab.language} value={activeTab.content}
            theme={monacoTheme} beforeMount={handleEditorBeforeMount} onMount={handleEditorMount}
            onChange={handleChange} options={monacoOptions} />
        </div>
        {/* Right pane — split tab */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2 py-0.5 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{splitTab.fileName}</span>
            <button onClick={() => setSplitTabId(null)} className="text-xs px-1 rounded"
              style={{ color: 'var(--text-subtle)' }} title="Close split">✕</button>
          </div>
          <MonacoEditor key={splitTab.id + '-split'} language={splitTab.language} value={splitTab.content}
            theme={monacoTheme} beforeMount={handleEditorBeforeMount}
            options={{ ...monacoOptions, readOnly: false }}
            onChange={(v) => { if (v !== undefined) useAppStore.getState().updateTabContent(splitTab.id, v) }} />
        </div>
      </div>
    )
  }

  // Flowchart: supported across C-family + Python (see isFlowchartSupported)
  const fcSupported = isFlowchartSupported(activeTab.language)

  return (
    <div className="flex h-full overflow-hidden">
      <div style={{ flex: showFlowchart ? '0 0 55%' : '1', overflow: 'hidden', position: 'relative' }}>
        <MonacoEditor
          key={activeTab.id}
          language={activeTab.language}
          value={activeTab.content}
          theme={monacoTheme}
          beforeMount={handleEditorBeforeMount}
          onMount={handleEditorMount}
          onChange={handleChange}
          options={monacoOptions}
        />
        {colorPicker && (
          <ColorPickerPopup
            color={colorPicker.color}
            x={colorPicker.x}
            y={colorPicker.y}
            onApply={handleColorApply}
            onClose={() => setColorPicker(null)}
          />
        )}
      </div>

      {/* Code → Flowchart panel */}
      {showFlowchart && (
        <div className="flex flex-col flex-shrink-0" style={{ flex: '0 0 45%', borderLeft: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-3 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: 30 }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>📊 Flowchart</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: 'var(--accent-green)', color: 'var(--bg-base)', fontSize: 9 }}>● live</span>
            <div className="flex-1" />
            <button onClick={() => setShowFlowchart(false)}
              className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--text-subtle)' }} title="Close flowchart">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            {fcSupported
              ? <CodeFlowchart code={activeTab.content} lang={activeTab.language} />
              : <div className="flex items-center justify-center h-full text-xs px-4 text-center" style={{ color: 'var(--text-subtle)' }}>
                  Flowchart works with C-family languages (JS, TS, Java, C, C++, C#, Go, Rust, PHP, Swift, Kotlin) &amp; Python.
                </div>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// Legacy helper — kept for FileExplorer compatibility
export function addRecentFolder(folderPath: string) {
  useAppStore.getState().addRecentFolder(folderPath)
}

function WelcomeScreen() {
  const { setActivePanel, recentFolders } = useAppStore()

  const openFolder = async (folderPath?: string) => {
    const { setCurrentFolder, setFileTree } = useAppStore.getState()
    const folder = folderPath ?? await window.api.dialog.openFolder()
    if (folder) {
      setCurrentFolder(folder)   // addRecentFolder called inside setCurrentFolder
      const tree = await window.api.fs.readDir(folder)
      if (tree) setFileTree(tree)
    }
  }

  const handleOpenFile = async () => {
    const { openTab } = useAppStore.getState()
    const filePaths = await window.api.dialog.openFile()
    if (filePaths) {
      for (const fp of filePaths) {
        const name = fp.split(/[\\/]/).pop() ?? 'file'
        const result = await window.api.fs.readFile(fp)
        if (result.content !== null) openTab(fp, name, result.content)
      }
    }
  }

  const recentFiles: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('momiji:recent-files') ?? '[]') } catch { return [] }
  })()

  const features = [
    { icon: '🧩', label: 'Block Editor', desc: 'Visual coding for beginners', panel: 'blocks' as const },
    { icon: '⚡', label: 'Flow Editor',  desc: 'Node-graph programming',       panel: 'flow' as const },
    { icon: '⏱', label: 'Time-Travel',  desc: 'Debug with time rewind',       panel: 'debug' as const },
    { icon: '✨', label: 'AI Assistant', desc: 'Claude, Gemini, GPT',          panel: 'ai' as const },
  ]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* LEFT — branding + actions */}
      <div className="flex flex-col items-center justify-center flex-shrink-0 px-8 overflow-y-auto"
        style={{ width: 280, borderRight: '1px solid var(--border)', gap: 20 }}>

        {/* Logo */}
        <div className="text-center flex flex-col items-center">
          <MomijiLogo size={44} className="mb-2" />
          <h1 className="text-xl font-black tracking-widest mb-1" style={{ color: 'var(--accent-mauve)', letterSpacing: '0.15em' }}>
            MOMIJI
          </h1>
          <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)', letterSpacing: '0.08em' }}>Where anyone becomes a developer.</p>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
            <KitsuneLogo size={13} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-mauve)' }}>Kitsune AI</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full">
          <ActionButton onClick={() => openFolder()} icon="📁" label="Open Folder" primary />
          <ActionButton onClick={handleOpenFile}      icon="📄" label="Open File" />
          <ActionButton onClick={() => setActivePanel('scaffold' as any)} icon="🏗️" label="New Project" />
          <ActionButton onClick={() => setActivePanel('templates' as any)} icon="🚀" label="Templates" />
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {features.map(f => (
            <button key={f.panel} onClick={() => setActivePanel(f.panel)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all"
              style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* CENTER — Kitsune character */}
      <div className="flex-1 flex flex-col items-center justify-end overflow-hidden relative"
        style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>

        {/* Background glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 80% at 50% 100%, rgba(251,146,60,0.08) 0%, rgba(203,166,247,0.05) 40%, transparent 70%)'
        }} />

        {/* ── Activity tiles + overview (Claude Desktop style) ── */}
        {/* In-flow with marginBottom:auto so it pins to the top and can never
            overlap the character below, even at small window sizes. */}
        <div className="w-full px-5 pt-4 overflow-y-auto" style={{ zIndex: 2, marginBottom: 'auto', maxHeight: '55%' }}>
          {(() => {
            const t = getT(getLang())
            const h = new Date().getHours()
            const greet = h < 11 ? `☀️ ${t.ws_greet_morning}` : h < 15 ? `🌤️ ${t.ws_greet_day}` : h < 19 ? `🌆 ${t.ws_greet_evening}` : `🌙 ${t.ws_greet_night}`
            const stats = getStats(12)
            const tiles = [
              recentFolders[0] && {
                icon: '📂', accent: false,
                title: recentFolders[0].split(/[\\/]/).pop() ?? '', sub: t.ws_last_project,
                onClick: () => openFolder(recentFolders[0])
              },
              {
                icon: '⛩️', accent: true,
                title: t.ws_command_center, sub: t.ws_cc_sub,
                onClick: () => setActivePanel('den' as any)
              },
              {
                icon: '✨', accent: false,
                title: `${t.ws_whats_new} v1.3.1`, sub: 'Flowchart · Creative · Robot',
                onClick: () => window.dispatchEvent(new CustomEvent('app:showAbout'))
              },
            ].filter(Boolean) as { icon: string; accent: boolean; title: string; sub: string; onClick: () => void }[]

            const cards = [
              { label: t.ws_sessions,    val: String(stats.sessions) },
              { label: t.ws_ai_msgs,     val: String(stats.aiMsgs) },
              { label: t.ws_tokens,      val: stats.tokens > 999 ? (stats.tokens / 1000).toFixed(1) + 'K' : String(stats.tokens) },
              { label: t.ws_active_days, val: String(stats.activeDays) },
              { label: t.ws_streak,      val: stats.streak + 'd' },
              { label: t.ws_fav_model,   val: stats.favModel ? stats.favModel.split('-').slice(0, 2).join(' ') : '—' },
            ]
            const maxH = Math.max(1, ...stats.heatmap.flat())

            return (
              <>
                <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>{greet}</p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>{t.ws_continue_sub}</p>

                <div className="flex gap-2 flex-wrap mb-3">
                  {tiles.map((tile, i) => (
                    <button key={i} onClick={tile.onClick}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all min-w-0"
                      style={{ background: 'var(--bg-surface0)', border: `1px solid ${tile.accent ? 'var(--accent-mauve)55' : 'var(--border)'}`, maxWidth: 190, flex: '1 1 140px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-mauve)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = tile.accent ? 'var(--accent-mauve)55' : 'var(--border)')}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{tile.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold truncate" style={{ color: tile.accent ? 'var(--accent-mauve)' : 'var(--text)' }}>{tile.title}</span>
                        <span className="block truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{tile.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Overview — stats + heatmap (Claude Desktop style) */}
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t.ws_overview}</p>
                  <div className="grid gap-1.5 mb-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))' }}>
                    {cards.map(c => (
                      <div key={c.label} className="rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-base)' }}>
                        <p className="truncate" style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{c.label}</p>
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {stats.heatmap.map((col, wi) => (
                      <div key={wi} className="flex flex-col gap-0.5">
                        {col.map((n, di) => (
                          <div key={di} style={{
                            width: 8, height: 8, borderRadius: 2,
                            background: n === 0 ? 'var(--bg-surface1)' : `rgba(249,115,22,${0.25 + 0.75 * (n / maxH)})`
                          }} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}
        </div>

        {/* Speech bubble */}
        <div className="relative mb-2 mx-6" style={{ zIndex: 2 }}>
          <div className="px-4 py-2.5 rounded-2xl text-center text-xs"
            style={{
              background: 'var(--bg-surface0)',
              border: '1px solid rgba(251,146,60,0.3)',
              color: 'var(--text)',
              maxWidth: 260,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
            <p className="font-semibold mb-0.5" style={{ color: '#fb923c' }}>Hey! I'm Kitsune 🦊</p>
            <p style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
              Open a project and I'll help you code,<br/>debug, and ship faster!
            </p>
          </div>
          {/* bubble tail */}
          <div style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(251,146,60,0.3)',
            margin: '0 auto',
            marginTop: -1
          }} />
        </div>

        {/* Kitsune character — cropped to main figure */}
        <div style={{
          width: '100%', maxWidth: 340,
          height: '75%', minHeight: 300,
          position: 'relative', zIndex: 1,
          animation: 'kitsuneFloat 4s ease-in-out infinite',
        }}>
          <img
            src={kitsuneCharImg}
            alt="Kitsune AI"
            style={{
              width: '100%', height: '100%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
              maskImage: 'linear-gradient(to top, transparent 0%, black 15%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 15%, black 100%)',
              filter: 'drop-shadow(0 8px 40px rgba(251,146,60,0.3))',
            }}
          />
        </div>

        <style>{`
          @keyframes kitsuneFloat {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-10px); }
          }
        `}</style>
      </div>

      {/* RIGHT — recent projects */}
      <div className="flex flex-col px-6 py-8 overflow-y-auto flex-shrink-0" style={{ width: 300 }}>
        {/* Recent Folders */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            Recent Projects
          </p>
          {recentFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2"
              style={{ border: '1px dashed var(--border)', borderRadius: 12 }}>
              <span className="text-3xl">📁</span>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>No recent projects yet</p>
              <button onClick={() => openFolder()}
                className="text-xs px-3 py-1.5 rounded-lg mt-1 transition-all"
                style={{ background: 'var(--accent-mauve)', color: 'white' }}>
                Open a folder
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentFolders.map(fp => {
                const name = fp.split(/[\\/]/).pop() ?? fp
                const parent = fp.split(/[\\/]/).slice(-3, -1).join('/')
                return (
                  <button key={fp} onClick={() => openFolder(fp)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                    style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface1)'; e.currentTarget.style.borderColor = 'var(--accent-mauve)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface0)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    <span className="text-xl">📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{parent}</p>
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity"
                      style={{ color: 'var(--accent-mauve)' }}>→</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
              Recent Files
            </p>
            <div className="flex flex-col gap-1">
              {recentFiles.slice(0, 5).map(fp => {
                const name = fp.split(/[\\/]/).pop() ?? fp
                return (
                  <button key={fp}
                    onClick={async () => {
                      const result = await window.api.fs.readFile(fp)
                      if (result.content !== null) useAppStore.getState().openTab(fp, name, result.content)
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <FileIcon name={name} size={14} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>
                        {fp.split(/[\\/]/).slice(-3, -1).join('/')}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function ActionButton({ onClick, icon, label, primary }: { onClick: () => void; icon: string; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        background: primary ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
        color: primary ? 'white' : 'var(--text)',
        border: primary ? 'none' : '1px solid var(--border)'
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
      <span>{icon}</span><span>{label}</span>
    </button>
  )
}
