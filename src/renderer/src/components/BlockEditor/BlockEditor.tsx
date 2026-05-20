import { useEffect, useRef, useState, useCallback } from 'react'
import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { pythonGenerator } from 'blockly/python'
import MonacoEditor from '@monaco-editor/react'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

type Lang       = 'javascript' | 'python'
type SyncMode   = 'blocks-primary' | 'code-primary'
type Level      = 'beginner' | 'intermediate' | 'advanced'

export function BlockEditor() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const splitWrapRef  = useRef<HTMLDivElement>(null)
  const workspaceRef  = useRef<Blockly.WorkspaceSvg | null>(null)
  const { settings, openTab, aiProviders, toggleBottomPanel, showBottomPanel, currentFolder } = useAppStore()

  const [code, setCode]         = useState('// Drag blocks from the toolbox to generate code\n')
  const [lang, setLang]         = useState<Lang>('javascript')
  const [syncMode, setSyncMode] = useState<SyncMode>('blocks-primary')
  const [blockCount, setBlockCount] = useState(0)
  const [ready, setReady]       = useState(false)
  const [level, setLevel]       = useState<Level>('beginner')
  const [showTemplates, setShowTemplates] = useState(false)
  const [splitRatio, setSplitRatio] = useState(55)    // % width for Blockly panel
  const [aiConverting, setAiConverting] = useState(false)

  const monacoTheme = settings.theme === 'dark' ? 'momiji-dark' : 'momiji-light'

  // ─── Generate code from workspace ──────────────────────────────────
  const generateCode = useCallback((): string => {
    if (!workspaceRef.current) return ''
    try {
      return lang === 'javascript'
        ? javascriptGenerator.workspaceToCode(workspaceRef.current)
        : pythonGenerator.workspaceToCode(workspaceRef.current)
    } catch {
      return ''
    }
  }, [lang])

  // ─── Init workspace ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    // Dispose old workspace
    workspaceRef.current?.dispose()

    const theme = Blockly.Theme.defineTheme('momiji', {
      base: Blockly.Themes.Classic,
      blockStyles: {
        logic_blocks:     { colourPrimary: '#89b4fa', colourSecondary: '#74c7ec', colourTertiary: '#45475a' },
        loop_blocks:      { colourPrimary: '#a6e3a1', colourSecondary: '#94e2d5', colourTertiary: '#45475a' },
        math_blocks:      { colourPrimary: '#fab387', colourSecondary: '#f9e2af', colourTertiary: '#45475a' },
        text_blocks:      { colourPrimary: '#cba6f7', colourSecondary: '#f5c2e7', colourTertiary: '#45475a' },
        list_blocks:      { colourPrimary: '#94e2d5', colourSecondary: '#89dceb', colourTertiary: '#45475a' },
        colour_blocks:    { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        variable_blocks:  { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        variable_dynamic_blocks: { colourPrimary: '#f38ba8', colourSecondary: '#eba0ac', colourTertiary: '#45475a' },
        procedure_blocks: { colourPrimary: '#b4befe', colourSecondary: '#cba6f7', colourTertiary: '#45475a' }
      },
      categoryStyles: {
        logic_category:     { colour: '#89b4fa' },
        loop_category:      { colour: '#a6e3a1' },
        math_category:      { colour: '#fab387' },
        text_category:      { colour: '#cba6f7' },
        list_category:      { colour: '#94e2d5' },
        colour_category:    { colour: '#f38ba8' },
        variable_category:  { colour: '#f38ba8' },
        procedure_category: { colour: '#b4befe' }
      },
      componentStyles: {
        workspaceBackgroundColour: '#1e1e2e',
        toolboxBackgroundColour:   '#181825',
        toolboxForegroundColour:   '#cdd6f4',
        flyoutBackgroundColour:    '#181825',
        flyoutForegroundColour:    '#cdd6f4',
        flyoutOpacity:             1,
        scrollbarColour:           '#45475a',
        scrollbarOpacity:          0.7,
        insertionMarkerColour:     '#89b4fa',
        insertionMarkerOpacity:    0.5,
        markerColour:              '#89b4fa',
        cursorColour:              '#89b4fa'
      }
    })

    const ws = Blockly.inject(containerRef.current, {
      toolbox: TOOLBOX_BEGINNER,
      theme,
      grid:    { spacing: 24, length: 4, colour: '#313244', snap: true },
      zoom:    { controls: true, wheel: true, startScale: 1.0, maxScale: 2.5, minScale: 0.4, scaleSpeed: 1.2 },
      trashcan: true,
      sounds:   false,
      move:    { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true }
    })

    workspaceRef.current = ws
    setReady(true)

    const MEANINGFUL = new Set(['create', 'delete', 'change', 'move', 'endDrag'])
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (!MEANINGFUL.has(e.type)) return
      setBlockCount(ws.getAllBlocks(false).length)
      setSyncMode((current) => {
        if (current === 'blocks-primary') {
          const gen = ws.getAllBlocks(false).length === 0
            ? '// Drag blocks from the toolbox to generate code\n'
            : (lang === 'javascript'
                ? javascriptGenerator.workspaceToCode(ws)
                : pythonGenerator.workspaceToCode(ws))
          setCode(gen || '// Add blocks to generate code\n')
        }
        return current
      })
    })

    return () => { ws.dispose(); workspaceRef.current = null; setReady(false) }
  }, []) // Only run once on mount

  // Regenerate when language changes
  useEffect(() => {
    if (!ready) return
    const gen = generateCode()
    if (gen) setCode(gen)
  }, [lang, ready, generateCode])

  // Update toolbox when level changes
  useEffect(() => {
    if (!ready || !workspaceRef.current) return
    const toolboxMap = { beginner: TOOLBOX_BEGINNER, intermediate: TOOLBOX_INTERMEDIATE, advanced: TOOLBOX }
    workspaceRef.current.updateToolbox(toolboxMap[level] as any)
  }, [level, ready])

  // Resize observer
  useEffect(() => {
    if (!ready || !containerRef.current) return
    const obs = new ResizeObserver(() => {
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [ready])

  // ─── Actions ─────────────────────────────────────────────────────
  const handleClear = () => {
    workspaceRef.current?.clear()
    setCode('// Drag blocks from the toolbox to generate code\n')
    setBlockCount(0)
    toast.info('Workspace cleared')
  }

  const handleSave = () => {
    if (!workspaceRef.current) return
    try {
      const state = Blockly.serialization.workspaces.save(workspaceRef.current)
      localStorage.setItem('momiji:blockly:workspace', JSON.stringify(state))
      toast.success('Workspace saved!')
    } catch { toast.error('Failed to save') }
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('momiji:blockly:workspace')
    if (!raw || !workspaceRef.current) { toast.warning('No saved workspace found'); return }
    try {
      Blockly.serialization.workspaces.load(JSON.parse(raw), workspaceRef.current)
      toast.success('Workspace loaded!')
    } catch { toast.error('Failed to load workspace') }
  }

  const handleOpenInEditor = () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Add some blocks first!'); return }
    const ext = lang === 'python' ? 'py' : 'js'
    const name = `blocks_output.${ext}`
    openTab(`__blocks__/${name}`, name, code)
    toast.success(`Opened as ${name}`)
  }

  const handleToggleSync = () => {
    const next: SyncMode = syncMode === 'blocks-primary' ? 'code-primary' : 'blocks-primary'
    setSyncMode(next)
    if (next === 'blocks-primary') {
      const gen = generateCode()
      if (gen) setCode(gen)
      toast.info('Blocks → Code: blocks control the output')
    } else {
      toast.info('Code mode: edit freely, blocks frozen')
    }
  }

  // ─── Resizable split drag ─────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const wrap = splitWrapRef.current
    if (!wrap) return
    const startX   = e.clientX
    const startRatio = splitRatio

    const onMove = (me: MouseEvent) => {
      const delta   = me.clientX - startX
      const newRatio = Math.max(25, Math.min(75, startRatio + (delta / wrap.offsetWidth) * 100))
      setSplitRatio(newRatio)
      // Resize Blockly canvas after layout shift
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [splitRatio])

  // ─── Run generated code ───────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Add some blocks first!'); return }

    const ext      = lang === 'python' ? 'py' : 'js'
    const fname    = `blocks_output.${ext}`
    const tmpPath  = `${currentFolder ?? (navigator.userAgent.includes('Win') ? 'C:\\Temp' : '/tmp')}/${fname}`
    const command  = lang === 'python' ? (settings.pythonPath || 'python') : 'node'

    try {
      await window.api.fs.writeFile(tmpPath, code)
    } catch {
      toast.error('Could not write temp file. Open a folder first.')
      return
    }

    if (!showBottomPanel) toggleBottomPanel()
    window.dispatchEvent(new CustomEvent('bottomPanel:switchTab', { detail: { tab: 'output' } }))

    setTimeout(async () => {
      window.dispatchEvent(new CustomEvent('runner:start', {
        detail: { processId: 'runner-main', command, args: [tmpPath], cwd: currentFolder ?? '', label: fname, fileName: fname }
      }))
      await window.api.process.run('runner-main', command, [tmpPath], currentFolder ?? '')
    }, 150)

    toast.info(`▶ Running ${fname}…`)
  }, [code, lang, showBottomPanel, toggleBottomPanel, settings.pythonPath, currentFolder])

  // ─── Kitsune: convert code → blocks ──────────────────────────────
  const handleAIToBlocks = useCallback(async () => {
    if (!code.trim() || code.startsWith('//')) { toast.warning('Write some code first!'); return }
    const provider = aiProviders.find(p => p.enabled && (p.apiKey || p.id === 'ollama'))
    if (!provider) { toast.error('Enable an AI provider in Settings first'); return }

    setAiConverting(true)
    toast.info('Kitsune is converting code to blocks…')

    const prompt = `Convert this ${lang} code to a Blockly workspace XML string.
Only return the XML — no explanation, no markdown fences.
Use standard Blockly block types (controls_repeat_ext, math_number, text_print, variables_set, etc.).

Code:
\`\`\`${lang}
${code}
\`\`\``

    try {
      let xml = ''

      if (provider.id === 'claude') {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: provider.model, max_tokens: 2048, system: 'You are a Blockly XML generator. Return only valid Blockly XML, nothing else.', messages: [{ role: 'user', content: prompt }] })
        })
        const d = await r.json()
        xml = d.content?.[0]?.text ?? ''
      } else if (provider.id === 'gemini') {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
        })
        const d = await r.json()
        xml = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      } else {
        // OpenAI-compat (groq, openai, deepseek, mistral, openrouter, ollama)
        const base = provider.baseUrl || (
          provider.id === 'groq' ? 'https://api.groq.com/openai' :
          provider.id === 'openrouter' ? 'https://openrouter.ai/api' :
          provider.id === 'deepseek' ? 'https://api.deepseek.com' :
          provider.id === 'mistral' ? 'https://api.mistral.ai' :
          'https://api.openai.com'
        )
        const r = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
          body: JSON.stringify({ model: provider.model, max_tokens: 2048, messages: [
            { role: 'system', content: 'You are a Blockly XML generator. Return only valid Blockly XML, nothing else.' },
            { role: 'user', content: prompt }
          ]})
        })
        const d = await r.json()
        xml = d.choices?.[0]?.message?.content ?? ''
      }

      // Strip markdown fences if AI added them
      xml = xml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim()

      if (!xml.includes('<block') && !xml.includes('<xml')) {
        toast.error('AI returned invalid XML. Try simpler code.')
        return
      }

      const ws = workspaceRef.current
      if (!ws) return
      ws.clear()
      const dom = Blockly.utils.xml.textToDom(xml.startsWith('<xml') ? xml : `<xml>${xml}</xml>`)
      Blockly.Xml.domToWorkspace(dom, ws)
      setSyncMode('blocks-primary')
      setBlockCount(ws.getAllBlocks(false).length)
      toast.success(`Converted! ${ws.getAllBlocks(false).length} blocks created 🦊`)
    } catch (err: any) {
      toast.error('Conversion failed: ' + (err.message ?? 'unknown error'))
    } finally {
      setAiConverting(false)
    }
  }, [code, lang, aiProviders])

  // ─── Template loader ──────────────────────────────────────────────
  const loadTemplate = useCallback((templateFn: (ws: Blockly.WorkspaceSvg) => void) => {
    const ws = workspaceRef.current
    if (!ws) return
    ws.clear()
    templateFn(ws)
    const gen = lang === 'javascript'
      ? javascriptGenerator.workspaceToCode(ws)
      : pythonGenerator.workspaceToCode(ws)
    setCode(gen || '')
    setBlockCount(ws.getAllBlocks(false).length)
    setShowTemplates(false)
    toast.success('Template loaded!')
  }, [lang])

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', minHeight: '40px', paddingTop: 4, paddingBottom: 4 }}>

        {/* Level selector */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-surface0)' }}>
          {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => {
            const labels = { beginner: '🌱 Beginner', intermediate: '🔥 Pro', advanced: '⚡ Expert' }
            return (
              <button key={l} onClick={() => setLevel(l)}
                className="px-2 py-0.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: level === l ? 'var(--accent-mauve)' : 'transparent',
                  color: level === l ? 'white' : 'var(--text-muted)'
                }}>
                {labels[l]}
              </button>
            )
          })}
        </div>

        {/* Block count */}
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)' }}>
          {blockCount} blocks
        </span>

        <div className="flex-1" />

        {/* Templates */}
        <div className="relative">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ background: showTemplates ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: showTemplates ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            📋 Templates
          </button>
          {showTemplates && (
            <div className="absolute top-8 right-0 z-20 rounded-xl overflow-hidden shadow-xl"
              style={{ background: 'var(--bg-mantle)', border: '1px solid var(--border)', width: 220 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => loadTemplate(t.load)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language */}
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
          className="text-xs px-2 py-1 rounded-lg outline-none"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>

        {/* Sync toggle */}
        <button onClick={handleToggleSync}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: syncMode === 'blocks-primary' ? 'var(--accent-mauve)' : 'var(--accent-mauve)', color: 'var(--bg-base)' }}>
          {syncMode === 'blocks-primary' ? '⟳ Live' : '✏️ Free'}
        </button>

        {[
          { icon: '💾', title: 'Save workspace',  fn: handleSave },
          { icon: '📂', title: 'Load workspace',  fn: handleLoad },
          { icon: '🗑️', title: 'Clear',           fn: handleClear }
        ].map((b) => (
          <button key={b.icon} onClick={b.fn} title={b.title}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface0)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {b.icon}
          </button>
        ))}

        {/* Run */}
        <button onClick={handleRun}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--accent-green)', color: 'var(--bg-base)' }}>
          ▶ Run
        </button>

        <button onClick={handleOpenInEditor}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Open in Editor →
        </button>
      </div>

      {/* Kitsune beginner guide */}
      {level === 'beginner' && (
        <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 text-xs"
          style={{ background: 'var(--accent-mauve)18', borderBottom: '1px solid var(--accent-mauve)33' }}>
          <span>🦊</span>
          <span style={{ color: 'var(--accent-mauve)' }}>
            {blockCount === 0
              ? 'Pick a template above to get started, or drag any block from the left panel!'
              : blockCount < 3
              ? 'Nice! Connect blocks by dragging the dots on the sides. Keep going!'
              : blockCount < 6
              ? "Great progress! Click ▶ Open in Editor to see the code, or keep adding blocks."
              : "You're building something real! When you're ready, open it in the code editor."}
          </span>
        </div>
      )}

      {/* Dual view — resizable split */}
      <div ref={splitWrapRef} className="flex flex-1 overflow-hidden" style={{ userSelect: 'none' }}>

        {/* LEFT: Blockly */}
        <div style={{ flex: `0 0 ${splitRatio}%`, position: 'relative', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* DRAG HANDLE */}
        <div
          onMouseDown={handleDragStart}
          style={{
            width: 6, flexShrink: 0, cursor: 'col-resize',
            background: 'var(--border)',
            borderLeft: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-mauve)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
          title="Drag to resize"
        >
          <div style={{ width: 2, height: 32, background: 'var(--bg-surface2)', borderRadius: 2 }} />
        </div>

        {/* RIGHT: Monaco code output */}
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
          {/* Code header */}
          <div className="flex items-center gap-2 px-3 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)', height: '36px' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {lang === 'python' ? 'Python' : 'JavaScript'} Output
            </span>
            {syncMode === 'blocks-primary' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
                style={{ background: 'var(--accent-green)', color: 'var(--bg-base)', fontSize: 10 }}>
                ● live
              </span>
            )}
            <div className="flex-1" />
            {/* AI → Blocks button */}
            {syncMode === 'code-primary' && (
              <button
                onClick={handleAIToBlocks}
                disabled={aiConverting}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all"
                style={{
                  background: aiConverting ? 'var(--bg-surface1)' : 'var(--accent-mauve)22',
                  border: '1px solid var(--accent-mauve)55',
                  color: aiConverting ? 'var(--text-subtle)' : 'var(--accent-mauve)',
                  opacity: aiConverting ? 0.7 : 1,
                }}
                title="Let Kitsune convert this code back to blocks">
                {aiConverting ? '⟳ Converting…' : '🦊 → Blocks'}
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(code).then(() => toast.success('Copied!'))}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              📋 Copy
            </button>
          </div>

          {/* Monaco */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              language={lang}
              value={code}
              theme={monacoTheme}
              onChange={(v) => { if (syncMode === 'code-primary' && v !== undefined) setCode(v) }}
              options={{
                readOnly: syncMode === 'blocks-primary',
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily,
                fontLigatures: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                bracketPairColorization: { enabled: true },
                renderLineHighlight: syncMode === 'code-primary' ? 'line' : 'none'
              }}
            />
          </div>

          {/* Bottom hint */}
          <div className="px-3 py-1.5 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'var(--bg-mantle)', borderTop: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            {syncMode === 'blocks-primary'
              ? <><span>🔒 Read-only — drag blocks to update</span><button onClick={handleToggleSync} className="ml-auto underline" style={{ color: 'var(--accent-mauve)' }}>Edit freely</button></>
              : <><span>✏️ Editing freely — blocks frozen</span><button onClick={handleToggleSync} className="ml-auto underline" style={{ color: 'var(--accent-green)' }}>Sync from blocks</button></>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Templates ──────────────────────────────────────────────────────
const TEMPLATES: { id: string; name: string; desc: string; icon: string; load: (ws: Blockly.WorkspaceSvg) => void }[] = [
  {
    id: 'hello', name: 'Hello World', icon: '👋',
    desc: 'Print your first message',
    load: (ws) => {
      const print = ws.newBlock('text_print'); print.initSvg(); print.render(); print.moveBy(80, 80)
      const txt = ws.newBlock('text'); txt.setFieldValue('Hello, World! 🌍', 'TEXT'); txt.initSvg(); txt.render()
      print.getInput('VALUE')?.connection?.connect(txt.outputConnection!)
    }
  },
  {
    id: 'count', name: 'Count 1 to 10', icon: '🔢',
    desc: 'Loop that prints numbers',
    load: (ws) => {
      const loop = ws.newBlock('controls_repeat_ext'); loop.initSvg(); loop.render(); loop.moveBy(80, 80)
      const num = ws.newBlock('math_number'); num.setFieldValue('10', 'NUM'); num.initSvg(); num.render()
      loop.getInput('TIMES')?.connection?.connect(num.outputConnection!)
      const print = ws.newBlock('text_print'); print.initSvg(); print.render()
      loop.getInput('DO')?.connection?.connect(print.previousConnection!)
      const cnt = ws.newBlock('math_arithmetic'); cnt.setFieldValue('ADD', 'OP'); cnt.initSvg(); cnt.render()
      print.getInput('VALUE')?.connection?.connect(cnt.outputConnection!)
    }
  },
  {
    id: 'calculator', name: 'Simple Calculator', icon: '🧮',
    desc: 'Add two numbers and show result',
    load: (ws) => {
      const print = ws.newBlock('text_print'); print.initSvg(); print.render(); print.moveBy(80, 80)
      const join = ws.newBlock('text_join'); (join as any).itemCount_ = 3; (join as any).updateShape_?.(); join.initSvg(); join.render()
      print.getInput('VALUE')?.connection?.connect(join.outputConnection!)
      const lbl = ws.newBlock('text'); lbl.setFieldValue('10 + 5 = ', 'TEXT'); lbl.initSvg(); lbl.render()
      join.getInput('ADD0')?.connection?.connect(lbl.outputConnection!)
      const arith = ws.newBlock('math_arithmetic'); arith.setFieldValue('ADD', 'OP'); arith.initSvg(); arith.render()
      join.getInput('ADD1')?.connection?.connect(arith.outputConnection!)
      const a = ws.newBlock('math_number'); a.setFieldValue('10', 'NUM'); a.initSvg(); a.render()
      const b = ws.newBlock('math_number'); b.setFieldValue('5', 'NUM'); b.initSvg(); b.render()
      arith.getInput('A')?.connection?.connect(a.outputConnection!)
      arith.getInput('B')?.connection?.connect(b.outputConnection!)
    }
  },
  {
    id: 'greeting', name: 'Personalised Greeting', icon: '🙌',
    desc: 'Say hello with a name variable',
    load: (ws) => {
      const setVar = ws.newBlock('variables_set'); setVar.initSvg(); setVar.render(); setVar.moveBy(80, 80)
      const name = ws.newBlock('text'); name.setFieldValue('Kitsune', 'TEXT'); name.initSvg(); name.render()
      setVar.getInput('VALUE')?.connection?.connect(name.outputConnection!)
      const print = ws.newBlock('text_print'); print.initSvg(); print.render()
      setVar.nextConnection?.connect(print.previousConnection!)
      const join = ws.newBlock('text_join'); join.initSvg(); join.render()
      print.getInput('VALUE')?.connection?.connect(join.outputConnection!)
      const hi = ws.newBlock('text'); hi.setFieldValue('Hello, ', 'TEXT'); hi.initSvg(); hi.render()
      join.getInput('ADD0')?.connection?.connect(hi.outputConnection!)
      const getVar = ws.newBlock('variables_get'); getVar.initSvg(); getVar.render()
      join.getInput('ADD1')?.connection?.connect(getVar.outputConnection!)
    }
  },
  {
    id: 'evenodd', name: 'Even or Odd?', icon: '🎯',
    desc: 'Check if a number is even or odd',
    load: (ws) => {
      const ifBlock = ws.newBlock('controls_ifelse'); ifBlock.initSvg(); ifBlock.render(); ifBlock.moveBy(80, 80)
      const eq = ws.newBlock('logic_compare'); eq.setFieldValue('EQ', 'OP'); eq.initSvg(); eq.render()
      ifBlock.getInput('IF0')?.connection?.connect(eq.outputConnection!)
      const mod = ws.newBlock('math_modulo'); mod.initSvg(); mod.render()
      eq.getInput('A')?.connection?.connect(mod.outputConnection!)
      const num = ws.newBlock('math_number'); num.setFieldValue('7', 'NUM'); num.initSvg(); num.render()
      mod.getInput('DIVIDEND')?.connection?.connect(num.outputConnection!)
      const two = ws.newBlock('math_number'); two.setFieldValue('2', 'NUM'); two.initSvg(); two.render()
      mod.getInput('DIVISOR')?.connection?.connect(two.outputConnection!)
      const zero = ws.newBlock('math_number'); zero.setFieldValue('0', 'NUM'); zero.initSvg(); zero.render()
      eq.getInput('B')?.connection?.connect(zero.outputConnection!)
      const evenPrint = ws.newBlock('text_print'); evenPrint.initSvg(); evenPrint.render()
      ifBlock.getInput('DO0')?.connection?.connect(evenPrint.previousConnection!)
      const evenTxt = ws.newBlock('text'); evenTxt.setFieldValue('Even number! ✅', 'TEXT'); evenTxt.initSvg(); evenTxt.render()
      evenPrint.getInput('VALUE')?.connection?.connect(evenTxt.outputConnection!)
      const oddPrint = ws.newBlock('text_print'); oddPrint.initSvg(); oddPrint.render()
      ifBlock.getInput('ELSE')?.connection?.connect(oddPrint.previousConnection!)
      const oddTxt = ws.newBlock('text'); oddTxt.setFieldValue('Odd number! 🔢', 'TEXT'); oddTxt.initSvg(); oddTxt.render()
      oddPrint.getInput('VALUE')?.connection?.connect(oddTxt.outputConnection!)
    }
  }
]

// ─── Toolboxes (3 levels) ────────────────────────────────────────────

const TOOLBOX_BEGINNER = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: '📢 Output', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } }
      ]
    },
    {
      kind: 'category', name: '🔢 Numbers', colour: '#fab387',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: '🔄 Repeat', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 5 } } } } },
        { kind: 'block', type: 'controls_whileUntil' }
      ]
    },
    {
      kind: 'category', name: '🧠 If / Then', colour: '#89b4fa',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: '📦 Variables', categorystyle: 'variable_category', custom: 'VARIABLE' }
  ]
}

const TOOLBOX_INTERMEDIATE = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: '📢 Output', colour: '#a6e3a1',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category', name: '🧠 Logic', categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    {
      kind: 'category', name: '🔄 Loops', categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
                    BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
      ]
    },
    {
      kind: 'category', name: '🔢 Math', categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: '💬 Text', categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_print' }
      ]
    },
    {
      kind: 'category', name: '📋 Lists', categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: '📦 Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
    { kind: 'category', name: '🔧 Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' }
  ]
}

// ─── Toolbox ────────────────────────────────────────────────────────
const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Logic', categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_ifelse' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category', name: 'Loops', categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
                    BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category', name: 'Math', categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int',
          inputs: { FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                    TO:   { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }
      ]
    },
    {
      kind: 'category', name: 'Text', categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello World' } },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append',
          inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category', name: 'Lists', categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_empty' },
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' }
      ]
    },
    { kind: 'sep' },
    { kind: 'category', name: 'Variables', categorystyle: 'variable_category',  custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' }
  ]
}
