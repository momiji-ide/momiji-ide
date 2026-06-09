import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from '../../utils/toast'
import { callKitsune } from '../../utils/callKitsune'

// System prompt that keeps the AI output to compilable WebGL1 GLSL
const SHADER_SYSTEM = `You are a GLSL fragment-shader generator for WebGL1 (GLSL ES 1.0).
Output ONLY the fragment shader source — no markdown, no code fences, no commentary.
Hard rules:
- First line must be exactly: precision mediump float;
- Available uniforms (already provided, do NOT redeclare elsewhere):
    uniform vec2 u_resolution;
    uniform float u_time;
- Read pixel position from gl_FragCoord.xy; write the result to gl_FragColor (a vec4).
- WebGL1 ONLY: no "#version", no "in"/"out"/"layout", no textures/samplers.
- Any for-loop MUST use a constant integer bound (e.g. for (int i=0;i<50;i++)).
- Animate using u_time. Keep it under ~60 lines.
- Favor Momiji's warm orange palette (vec3(0.98,0.45,0.09)) when a color isn't specified.`

// ── Default shaders ──────────────────────────────────────────────────────────

const VERTEX_SRC = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0, 1); }
`

const PRESETS: Record<string, { name: string; icon: string; src: string }> = {
  gradient: {
    name: 'Gradient', icon: '🌈',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 col = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0,2,4));
  gl_FragColor = vec4(col, 1.0);
}`
  },
  plasma: {
    name: 'Plasma', icon: '⚡',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float v = sin(uv.x * 10.0 + u_time);
  v += sin(uv.y * 10.0 + u_time);
  v += sin((uv.x + uv.y) * 10.0 + u_time);
  v += sin(sqrt(uv.x*uv.x + uv.y*uv.y) * 10.0 - u_time);
  vec3 col = 0.5 + 0.5 * vec3(sin(v), sin(v + 2.09), sin(v + 4.18));
  gl_FragColor = vec4(col, 1.0);
}`
  },
  circles: {
    name: 'Ripples', icon: '💧',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  float d = length(uv);
  float wave = sin(d * 20.0 - u_time * 3.0) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.05, 0.02, 0.1), vec3(0.98, 0.45, 0.09), wave);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  noise: {
    name: 'Noise', icon: '🌊',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution * 3.0;
  float n = noise(uv + u_time * 0.3);
  n += 0.5 * noise(uv * 2.0 + u_time * 0.5);
  n += 0.25 * noise(uv * 4.0 + u_time * 0.7);
  vec3 col = mix(vec3(0.1, 0.0, 0.2), vec3(0.98, 0.45, 0.09), n);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  star: {
    name: 'Stars', icon: '✨',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 col = vec3(0.02, 0.01, 0.05);
  for (int i = 0; i < 80; i++) {
    vec2 sp = vec2(hash(vec2(float(i), 1.0)), hash(vec2(float(i), 2.0)));
    float brightness = 0.5 + 0.5 * sin(u_time * (0.5 + hash(vec2(float(i), 3.0))) + float(i));
    float d = length(uv - sp);
    col += vec3(brightness) * 0.0015 / (d * d + 0.001);
  }
  gl_FragColor = vec4(col, 1.0);
}`
  },
  sdf_circle: {
    name: 'SDF Shape', icon: '⭕',
    src: `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  float r = 0.25 + 0.05 * sin(u_time * 2.0);
  float d = mix(sdCircle(uv, r), sdBox(uv, vec2(r)), 0.5 + 0.5 * sin(u_time));
  vec3 col = d < 0.0 ? vec3(0.98, 0.45, 0.09) : vec3(0.05, 0.02, 0.1);
  col = mix(col, vec3(1.0), 1.0 - smoothstep(0.0, 0.005, abs(d)));
  gl_FragColor = vec4(col, 1.0);
}`
  }
}

// ── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null
  return shader
}

function createProgram(gl: WebGLRenderingContext, vSrc: string, fSrc: string) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fSrc)
  if (!vs || !fs) return null
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs); gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null
}

// ── Component ────────────────────────────────────────────────────────────────

export function ShaderPlayground() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const glRef       = useRef<WebGLRenderingContext | null>(null)
  const progRef     = useRef<WebGLProgram | null>(null)
  const rafRef      = useRef<number>(0)
  const startRef    = useRef(performance.now())

  const [src, setSrc]         = useState(PRESETS.gradient.src)
  const [error, setError]     = useState<string | null>(null)
  const [preset, setPreset]   = useState('gradient')
  const [paused, setPaused]   = useState(false)
  const pausedRef = useRef(false)

  // ── Kitsune Creative (prompt → shader) ──────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<string[]>([])   // recent prompts for chips
  const srcRef = useRef(src)
  useEffect(() => { srcRef.current = src }, [src])

  const buildProgram = useCallback((fragSrc: string) => {
    const gl = glRef.current
    if (!gl) return
    if (progRef.current) gl.deleteProgram(progRef.current)
    const prog = createProgram(gl, VERTEX_SRC, fragSrc)
    if (!prog) {
      // Get error details by recompiling fragment shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fs, fragSrc)
      gl.compileShader(fs)
      setError(gl.getShaderInfoLog(fs) ?? 'Compile error')
      return
    }
    setError(null)
    progRef.current = prog

    // Set up fullscreen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }, [])

  // Init WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
    if (!gl) { setError('WebGL not supported in this environment'); return }
    glRef.current = gl
    buildProgram(src)

    const render = () => {
      if (!pausedRef.current) {
        const gl = glRef.current!, prog = progRef.current
        if (gl && prog) {
          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.useProgram(prog)
          const t = (performance.now() - startRef.current) / 1000
          gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), t)
          gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), canvas.width, canvas.height)
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
      }
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(rafRef.current) }
  }, []) // eslint-disable-line

  const applyShader = () => {
    buildProgram(src)
    startRef.current = performance.now()
  }

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(p => !p)
  }

  const loadPreset = (key: string) => {
    setPreset(key)
    setSrc(PRESETS[key].src)
    setTimeout(() => buildProgram(PRESETS[key].src), 0)
    startRef.current = performance.now()
  }

  // ── Generate / iterate shader from a natural-language prompt ─────────────
  const generateFromPrompt = useCallback(async (prompt: string) => {
    const p = prompt.trim()
    if (!p) return
    setAiLoading(true)
    try {
      // Include the current shader so follow-ups like "make it faster" compound
      const hasShader = !!srcRef.current && srcRef.current.includes('gl_FragColor')
      const userMsg = hasShader
        ? `Current shader:\n${srcRef.current}\n\nModify it so: ${p}\nReturn the COMPLETE updated fragment shader.`
        : `Create a fragment shader: ${p}`

      let out = await callKitsune(userMsg, SHADER_SYSTEM)
      // strip markdown fences if the model added them anyway
      out = out.replace(/```(?:glsl|c|cpp)?\n?/gi, '').replace(/```/g, '').trim()
      if (!out.includes('gl_FragColor')) {
        toast.error('AI did not return a valid shader. Try rephrasing.')
        return
      }
      setSrc(out)
      buildProgram(out)
      startRef.current = performance.now()
      setAiHistory(h => [p, ...h.filter(x => x !== p)].slice(0, 6))
      setAiPrompt('')
      toast.success('🦊 Shader generated!')
    } catch (e: any) {
      if (e.message === 'NO_PROVIDER') toast.error('Enable an AI provider in Settings first')
      else toast.error('Generation failed: ' + (e.message ?? 'unknown'))
    } finally {
      setAiLoading(false)
    }
  }, [buildProgram])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ height: 44, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>✨ GLSL SHADER PLAYGROUND</span>
        <div className="flex-1" />
        <button onClick={togglePause}
          className="px-2 py-1 rounded text-xs"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button onClick={() => { navigator.clipboard.writeText(src); toast.success('Shader copied!') }}
          className="px-2 py-1 rounded text-xs"
          style={{ background: 'var(--bg-surface0)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          📋 Copy
        </button>
        <button onClick={applyShader}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{ background: 'var(--accent-mauve)', color: 'white' }}>
          ▶ Run
        </button>
      </div>

      {/* ── Kitsune Creative prompt bar ── */}
      <div className="flex flex-col gap-1.5 px-3 py-2 flex-shrink-0"
        style={{ background: 'linear-gradient(to right, rgba(249,115,22,0.08), transparent)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--accent-mauve)' }}>🦊 Kitsune Creative</span>
          <input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) generateFromPrompt(aiPrompt) }}
            disabled={aiLoading}
            placeholder={aiLoading ? 'Kitsune is painting…' : 'Describe a visual — e.g. "swirling neon galaxy with purple stars"'}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-base)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <button
            onClick={() => generateFromPrompt(aiPrompt)}
            disabled={aiLoading || !aiPrompt.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
            style={{
              background: aiLoading ? 'var(--bg-surface1)' : 'var(--accent-mauve)',
              color: aiLoading ? 'var(--text-subtle)' : 'white',
              opacity: (!aiPrompt.trim() && !aiLoading) ? 0.5 : 1, border: 'none',
              cursor: aiLoading ? 'wait' : 'pointer'
            }}>
            {aiLoading ? '⟳ Generating' : '✨ Generate'}
          </button>
        </div>
        {/* Iterate chips + recent prompts */}
        <div className="flex items-center gap-1 flex-wrap">
          {srcRef.current.includes('gl_FragColor') && !aiLoading && (
            <>
              {['make it faster', 'more colorful', 'add glow', 'slower & calmer'].map(q => (
                <button key={q} onClick={() => generateFromPrompt(q)}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-surface0)', color: 'var(--accent-mauve)', border: '1px solid var(--accent-mauve)44' }}>
                  {q}
                </button>
              ))}
            </>
          )}
          {aiHistory.slice(0, 3).map((h, i) => (
            <button key={i} onClick={() => generateFromPrompt(h)} title="Re-run this prompt"
              className="text-xs px-2 py-0.5 rounded-full truncate" style={{ maxWidth: 140, color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
              ↻ {h}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-1.5 px-3 py-2 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        {Object.entries(PRESETS).map(([key, p]) => (
          <button key={key} onClick={() => loadPreset(key)}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: preset === key ? 'var(--accent-mauve)' : 'var(--bg-surface0)',
              color: preset === key ? 'white' : 'var(--text-muted)',
              border: `1px solid ${preset === key ? 'var(--accent-mauve)' : 'var(--border)'}`,
            }}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: canvas preview */}
        <div className="flex flex-col" style={{ flex: '0 0 50%', borderRight: '1px solid var(--border)', background: '#0a0a0f' }}>
          <canvas ref={canvasRef} width={480} height={360}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
        </div>

        {/* Right: editor */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 flex-shrink-0 text-xs"
            style={{ background: 'var(--bg-surface0)', borderBottom: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            Fragment shader &nbsp;·&nbsp; <code style={{ color: 'var(--accent-green)' }}>u_time</code> float &nbsp;·&nbsp;
            <code style={{ color: 'var(--accent-green)' }}>u_resolution</code> vec2 &nbsp;·&nbsp;
            <code style={{ color: 'var(--accent-green)' }}>gl_FragCoord</code> vec4
          </div>
          <textarea
            value={src}
            onChange={e => setSrc(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); applyShader() } }}
            spellCheck={false}
            className="flex-1 p-3 font-mono text-xs outline-none resize-none"
            style={{
              background: 'var(--bg-base)', color: 'var(--text)', border: 'none',
              lineHeight: 1.6, tabSize: 2
            }}
            placeholder="Write GLSL fragment shader here... Ctrl+Enter to run"
          />
          {error && (
            <div className="px-3 py-2 text-xs font-mono flex-shrink-0"
              style={{ background: 'rgba(243,139,168,0.1)', color: 'var(--accent-red)', borderTop: '1px solid var(--accent-red)33', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'auto' }}>
              ⚠ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
