import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RobotSimulatorProps {
  runLines: { id: number; text: string; type: 'out' | 'err' | 'sys' }[]
  runStatus: 'idle' | 'running' | 'done' | 'error'
  tmpPath: string
}

type ArenaPreset = 'oval' | 'figure8' | 'sumo' | 'maze' | 'custom'
type ViewMode    = '2D' | '3D'
type PaintTool   = 'paint' | 'erase' | 'off'

interface ObstacleItem { id: number; x: number; y: number; w: number; h: number }

interface RobotPhysics {
  x: number; y: number; angle: number; speed: number
  dir: string; ledColor: string; servoAngle: number; oledLines: string[]
}

interface MissionState {
  active: boolean; laps: number; targetLaps: number
  status: 'idle' | 'running' | 'success'; lastCrossed: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CW = 360
const CH = 260
const TW = 3   // track half-width for sensor detection (narrower = sensors don't both trigger at once)
const SUMO = { x: 180, y: 130, r: 100 }

// ─── Preset track pixel sets (for sensor detection) ───────────────────────────
function buildPixelSet(fn: (add: (x: number, y: number) => void) => void): Set<string> {
  const s = new Set<string>()
  fn((x, y) => {
    for (let dx = -TW; dx <= TW; dx++) {
      for (let dy = -TW; dy <= TW; dy++) {
        if (dx * dx + dy * dy <= TW * TW)
          s.add(`${Math.round(x + dx)},${Math.round(y + dy)}`)
      }
    }
  })
  return s
}

const PRESET_PIXELS: Record<Exclude<ArenaPreset, 'custom'>, Set<string>> = {
  oval: buildPixelSet(add => {
    for (let i = 0; i < 800; i++) {
      const t = (i / 800) * Math.PI * 2
      add(180 + Math.cos(t) * 110, 130 + Math.sin(t) * 70)
    }
  }),
  figure8: buildPixelSet(add => {
    for (const [cx, cy] of [[130, 130], [235, 130]]) {
      for (let i = 0; i < 500; i++) {
        const t = (i / 500) * Math.PI * 2
        add(cx + Math.cos(t) * 68, cy + Math.sin(t) * 55)
      }
    }
  }),
  maze: buildPixelSet(add => {
    const segs: [number, number, number, number][] = [
      [50,60,310,60],[310,60,310,200],[310,200,50,200],[50,200,50,60],
      [50,130,190,130],[190,60,190,130],[120,130,120,200]
    ]
    for (const [x1, y1, x2, y2] of segs) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
      }
    }
  }),
  sumo: new Set(), // no line track
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RobotSimulator({ runLines, runStatus, tmpPath }: RobotSimulatorProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const container3dRef = useRef<HTMLDivElement>(null)
  const paintCanvas    = useRef<HTMLCanvasElement | null>(null) // offscreen for custom track

  const [viewMode, setViewMode]         = useState<ViewMode>('2D')
  const [arenaPreset, setArenaPreset]   = useState<ArenaPreset>('oval')
  const [paintTool, setPaintTool]       = useState<PaintTool>('off')
  const [paintSize, setPaintSize]       = useState(8)

  const [robot, setRobot] = useState<RobotPhysics>({
    x: 180, y: 60, angle: 0,   // ON the oval top, facing RIGHT along the tangent
    speed: 0, dir: 'STOP', ledColor: 'OFF', servoAngle: 90, oledLines: []
  })
  const robotRef = useRef(robot)
  useEffect(() => { robotRef.current = robot }, [robot])

  const [obstacles, setObstacles] = useState<ObstacleItem[]>([
    { id: 1, x: 180, y: 50, w: 36, h: 36 }
  ])
  const obstaclesRef = useRef(obstacles)
  useEffect(() => { obstaclesRef.current = obstacles }, [obstacles])

  const [selectedObs, setSelectedObs]   = useState<number | null>(null)
  const [buttonA, setButtonA]           = useState(false)
  const [buttonB, setButtonB]           = useState(false)
  const [lineLeft, setLineLeft]         = useState(0)
  const [lineRight, setLineRight]       = useState(0)
  const [distance, setDistance]         = useState(999)
  const [mission, setMission]           = useState<MissionState>({
    active: false, laps: 0, targetLaps: 3, status: 'idle', lastCrossed: false
  })
  const missionRef = useRef(mission)
  useEffect(() => { missionRef.current = mission }, [mission])

  // Drag / paint state (refs — no re-render needed)
  const dragRef    = useRef<{ type: 'robot' | 'obs'; id?: number; ox: number; oy: number } | null>(null)
  const isPainting = useRef(false)

  // ── Init offscreen paint canvas ──────────────────────────────────────────
  useEffect(() => {
    const c = document.createElement('canvas')
    c.width = CW; c.height = CH
    paintCanvas.current = c
  }, [])

  // ── Preset switch ────────────────────────────────────────────────────────
  useEffect(() => {
    setRobot(r => ({ ...r, x: 180, y: 60, angle: 0, speed: 0, dir: 'STOP' }))
    setMission({ active: false, laps: 0, targetLaps: 3, status: 'idle', lastCrossed: false })
    if (arenaPreset === 'custom') {
      // Clear paint canvas
      const ctx = paintCanvas.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, CW, CH)
    }
    setPaintTool('off')
  }, [arenaPreset])

  // ── Track detection ──────────────────────────────────────────────────────
  const isOnTrack = useCallback((px: number, py: number): boolean => {
    if (arenaPreset === 'sumo') return false
    if (arenaPreset === 'custom') {
      const c = paintCanvas.current
      if (!c) return false
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return false
      const d = ctx.getImageData(Math.max(0, Math.round(px)), Math.max(0, Math.round(py)), 1, 1).data
      return d[3] > 50
    }
    const set = PRESET_PIXELS[arenaPreset as Exclude<ArenaPreset, 'custom'>]
    // ±1 slop — sensors now sit 6px lateral (just outside TW=3 track), so
    // tight detection triggers only when robot actually drifts ~3px off-center.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (set.has(`${Math.round(px + dx)},${Math.round(py + dy)}`)) return true
      }
    }
    return false
  }, [arenaPreset])

  // ── Command parser ───────────────────────────────────────────────────────
  useEffect(() => {
    if (runStatus === 'idle' || runLines.length === 0) {
      setRobot(r => ({ ...r, speed: 0, dir: 'STOP', ledColor: 'OFF', servoAngle: 90, oledLines: [] }))
      return
    }
    const last = runLines[runLines.length - 1]?.text || ''
    if (!last.startsWith('[Robotics]')) return

    setRobot(prev => {
      const n = { ...prev }
      const m1 = last.match(/🤖 Motor:\s*(\w+)\s*at speed\s*(\d+)%/)
      if (m1) { n.dir = m1[1]; n.speed = Number(m1[2]) }
      const m2 = last.match(/💡 LED set to\s*(\w+)/)
      if (m2) n.ledColor = m2[1]
      const m3 = last.match(/🦾 Servo\s*\w+\s*set to\s*(\d+)°/)
      if (m3) n.servoAngle = Number(m3[1])
      if (last.includes('📺 Display:')) {
        const m4 = last.match(/📺 Display:\s*"(.*)"\s*at/)
        if (m4) {
          const lines = [...prev.oledLines]; if (lines.length >= 3) lines.shift(); lines.push(m4[1]); n.oledLines = lines
        }
      }
      if (last.includes('📺 Screen cleared')) n.oledLines = []
      return n
    })
  }, [runLines, runStatus])

  // ── Physics loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    let id: number, last = Date.now()
    const tick = () => {
      const now = Date.now()
      const dt  = Math.min((now - last) / 1000, 0.05)
      last = now
      if (runStatus === 'running') {
        setRobot(prev => {
          let { x, y, angle, dir, speed } = prev
          const vel = (speed / 100) * 120
          if (dir === 'FORWARD')  { x += Math.cos(angle) * vel * dt; y += Math.sin(angle) * vel * dt }
          if (dir === 'BACKWARD') { x -= Math.cos(angle) * vel * dt; y -= Math.sin(angle) * vel * dt }
          if (dir === 'LEFT')  angle -= 2.8 * dt
          if (dir === 'RIGHT') angle += 2.8 * dt
          x = Math.max(22, Math.min(CW - 22, x))
          y = Math.max(22, Math.min(CH - 22, y))
          return { ...prev, x, y, angle }
        })
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [runStatus])

  // ── Sensor calc + state write ────────────────────────────────────────────
  useEffect(() => {
    const r  = robotRef.current
    // Sensors placed laterally (perpendicular to heading) for proper line following.
    // fwd = slight forward offset so they're in front of the robot body
    // side = lateral distance — just outside the track half-width (TW=3 + 3 margin = 6)
    const fwd = 8, side = 6
    // Left direction: (sin(a), -cos(a))   Right direction: (-sin(a), cos(a))
    const lx = r.x + Math.cos(r.angle) * fwd + Math.sin(r.angle) * side
    const ly = r.y + Math.sin(r.angle) * fwd - Math.cos(r.angle) * side
    const rx = r.x + Math.cos(r.angle) * fwd - Math.sin(r.angle) * side
    const ry = r.y + Math.sin(r.angle) * fwd + Math.cos(r.angle) * side
    const ll = isOnTrack(lx, ly) ? 1 : 0
    const lr = isOnTrack(rx, ry) ? 1 : 0
    setLineLeft(ll); setLineRight(lr)

    const showObs = arenaPreset === 'sumo' || arenaPreset === 'custom'
    let minD = 999
    if (showObs) {
      for (const o of obstaclesRef.current) {
        const d = Math.max(2, Math.round(Math.sqrt((o.x-r.x)**2 + (o.y-r.y)**2) / 3.3))
        if (d < minD) minD = d
      }
    }
    setDistance(showObs ? minD : 999)

    if (runStatus === 'running' && tmpPath) {
      window.api.fs.writeFile(`${tmpPath}_state.json`,
        JSON.stringify({ distance: showObs ? minD : 999, line_left: ll, line_right: lr })
      ).catch(() => {})
    }
  }, [robot.x, robot.y, robot.angle, obstacles, runStatus, tmpPath, arenaPreset, isOnTrack])

  // ── Button state write ───────────────────────────────────────────────────
  useEffect(() => {
    if (runStatus !== 'running' || !tmpPath) return
    window.api.fs.writeFile(`${tmpPath}_buttons.json`, JSON.stringify({ A: buttonA, B: buttonB })).catch(() => {})
  }, [buttonA, buttonB, runStatus, tmpPath])

  // ── Mission lap detection ────────────────────────────────────────────────
  useEffect(() => {
    const m = missionRef.current
    if (!m.active || m.status !== 'running') return
    const r = robot
    const near = Math.abs(r.x - 180) < 18 && Math.abs(r.y - 55) < 14
    if (near && !m.lastCrossed) {
      setMission(prev => {
        const laps = prev.laps + 1
        return { ...prev, laps, lastCrossed: true, status: laps >= prev.targetLaps ? 'success' : 'running' }
      })
    }
    if (!near) setMission(prev => ({ ...prev, lastCrossed: false }))
  }, [robot.x, robot.y])

  // ── 2D Canvas Draw ───────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== '2D') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CW, CH)

    // Grid
    ctx.strokeStyle = 'rgba(100,80,60,0.12)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= CW; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke() }
    for (let y = 0; y <= CH; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }

    // Track rendering (by preset)
    const drawGlowTrack = (draw: () => void, color = '#06b6d4') => {
      ctx.save()
      ctx.strokeStyle = color + '55'; ctx.lineWidth = TW * 2 + 4
      ctx.shadowBlur = 12; ctx.shadowColor = color
      draw()
      ctx.shadowBlur = 0; ctx.strokeStyle = color; ctx.lineWidth = 3
      draw()
      ctx.restore()
    }

    if (arenaPreset === 'oval') {
      drawGlowTrack(() => { ctx.beginPath(); ctx.ellipse(180, 130, 110, 70, 0, 0, Math.PI * 2); ctx.stroke() })
    } else if (arenaPreset === 'figure8') {
      drawGlowTrack(() => {
        ctx.beginPath(); ctx.ellipse(130, 130, 68, 55, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(235, 130, 68, 55, 0, 0, Math.PI * 2); ctx.stroke()
      })
    } else if (arenaPreset === 'maze') {
      drawGlowTrack(() => {
        for (const [x1, y1, x2, y2] of [[50,60,310,60],[310,60,310,200],[310,200,50,200],[50,200,50,60],[50,130,190,130],[190,60,190,130],[120,130,120,200]] as [number,number,number,number][]) {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        }
      })
    } else if (arenaPreset === 'sumo') {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(SUMO.x, SUMO.y, SUMO.r, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill()
      ctx.restore()
    } else if (arenaPreset === 'custom' && paintCanvas.current) {
      ctx.save(); ctx.globalAlpha = 0.9
      ctx.drawImage(paintCanvas.current, 0, 0)
      ctx.restore()
    }

    // Start line marker
    if (arenaPreset === 'oval' || arenaPreset === 'figure8') {
      ctx.save()
      ctx.strokeStyle = 'rgba(249,115,22,0.9)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(167, 55); ctx.lineTo(193, 55); ctx.stroke()
      ctx.font = 'bold 7px JetBrains Mono'; ctx.fillStyle = '#f97316'
      ctx.fillText('START', 164, 50)
      ctx.restore()
    }

    // Obstacles
    if (arenaPreset === 'sumo' || arenaPreset === 'custom') {
      for (const o of obstacles) {
        const sel = o.id === selectedObs
        ctx.save()
        ctx.fillStyle = sel ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)'
        ctx.fillRect(o.x - o.w/2, o.y - o.h/2, o.w, o.h)
        ctx.strokeStyle = sel ? '#ef4444' : 'rgba(239,68,68,0.55)'
        ctx.lineWidth = sel ? 2 : 1.5
        ctx.strokeRect(o.x - o.w/2, o.y - o.h/2, o.w, o.h)
        // Stripes
        ctx.fillStyle = 'rgba(239,68,68,0.35)'
        for (let i = -20; i < 30; i += 8) {
          ctx.beginPath()
          ctx.moveTo(o.x - o.w/2 + i, o.y - o.h/2)
          ctx.lineTo(o.x - o.w/2 + i + 4, o.y - o.h/2)
          ctx.lineTo(o.x - o.w/2 + i - 4, o.y + o.h/2)
          ctx.lineTo(o.x - o.w/2 + i - 8, o.y + o.h/2)
          ctx.fill()
        }
        if (sel) {
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px sans-serif'
          ctx.fillText('✕', o.x - o.w/2 - 12, o.y - o.h/2 + 10)
        }
        ctx.restore()
      }
    }

    // Sonar cone
    {
      const r       = robot
      const cone    = Math.PI / 5
      const maxPx   = Math.min(distance, 120) * 3.3
      const cc      = distance < 20 ? [239,68,68] : distance < 50 ? [234,179,8] : [34,197,94]
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.angle)
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, maxPx)
      grad.addColorStop(0, `rgba(${cc},0.4)`)
      grad.addColorStop(1, `rgba(${cc},0)`)
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.moveTo(0, 0)
      ctx.arc(0, 0, maxPx, -cone/2 - Math.PI/2, cone/2 - Math.PI/2)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }

    // Sensor rays (match the actual sensor positions used for detection)
    {
      const r = robot; const fwd = 8, side = 6
      const lx = r.x + Math.cos(r.angle)*fwd + Math.sin(r.angle)*side
      const ly = r.y + Math.sin(r.angle)*fwd - Math.cos(r.angle)*side
      const rx = r.x + Math.cos(r.angle)*fwd - Math.sin(r.angle)*side
      const ry = r.y + Math.sin(r.angle)*fwd + Math.cos(r.angle)*side
      ctx.save(); ctx.lineWidth = 1.5
      ctx.strokeStyle = lineLeft  ? '#ea580c' : 'rgba(100,100,100,0.25)'
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(lx, ly); ctx.stroke()
      // sensor dot
      ctx.fillStyle = lineLeft ? '#ea580c' : 'rgba(100,100,100,0.4)'
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2); ctx.fill()
      ctx.strokeStyle = lineRight ? '#ea580c' : 'rgba(100,100,100,0.25)'
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(rx, ry); ctx.stroke()
      ctx.fillStyle = lineRight ? '#ea580c' : 'rgba(100,100,100,0.4)'
      ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI*2); ctx.fill()
      ctx.restore()
    }

    // Robot body
    ctx.save(); ctx.translate(robot.x, robot.y); ctx.rotate(robot.angle)

    // Servo arm
    ctx.fillStyle = '#4b5563'; ctx.fillRect(-12, 10, 8, 8)
    ctx.save(); ctx.translate(-8, 14); ctx.rotate(((robot.servoAngle - 90) * Math.PI) / 180)
    ctx.strokeStyle = 'var(--accent-yellow)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-18); ctx.stroke()
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0,-18,3,0,Math.PI*2); ctx.fill()
    ctx.restore()

    // Chassis
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); ctx.stroke()

    // Fox face
    ctx.fillStyle = '#f97316'
    ctx.beginPath(); ctx.moveTo(-15,-5); ctx.quadraticCurveTo(0,-22,15,-5); ctx.lineTo(10,15); ctx.lineTo(-10,15); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#ea580c'
    ctx.beginPath(); ctx.moveTo(-16,-10); ctx.lineTo(-24,-22); ctx.lineTo(-8,-17); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(16,-10); ctx.lineTo(24,-22); ctx.lineTo(8,-17); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(-6,-2,3,0,Math.PI*2); ctx.arc(6,-2,3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle = '#0f172a'
    ctx.beginPath(); ctx.arc(-6,-2,1.5,0,Math.PI*2); ctx.arc(6,-2,1.5,0,Math.PI*2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(-4,5); ctx.lineTo(4,5); ctx.lineTo(0,10); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(0,5,1.5,0,Math.PI*2); ctx.fill()

    // LED glow
    if (robot.ledColor !== 'OFF') {
      const lm: Record<string,string> = { RED:'rgba(239,68,68,0.9)', GREEN:'rgba(34,197,94,0.9)', BLUE:'rgba(59,130,246,0.9)', ORANGE:'rgba(249,115,22,0.9)' }
      ctx.shadowBlur = 14; ctx.shadowColor = lm[robot.ledColor] || 'white'
      ctx.fillStyle = lm[robot.ledColor] || 'white'
      ctx.beginPath(); ctx.arc(0,-11,4,0,Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
    }

    // Ultrasonic sensor
    ctx.save(); ctx.translate(0,-18)
    ctx.fillStyle = '#1e3a8a'; ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.rect(-16,-4,32,8); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(-8,0,5,0,Math.PI*2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(8,0,5,0,Math.PI*2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(-8,0,3.5,0,Math.PI*2); ctx.arc(8,0,3.5,0,Math.PI*2); ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.beginPath(); ctx.arc(-8,0,1,0,Math.PI*2); ctx.arc(8,0,1,0,Math.PI*2); ctx.fill()
    ctx.restore()

    // Line tracker dots
    ctx.fillStyle = lineLeft  ? '#ea580c' : '#4b5563'; ctx.beginPath(); ctx.arc(-7,12,2.5,0,Math.PI*2); ctx.fill()
    ctx.fillStyle = lineRight ? '#ea580c' : '#4b5563'; ctx.beginPath(); ctx.arc(7,12,2.5,0,Math.PI*2); ctx.fill()

    ctx.restore() // end robot transform

    // Mission success overlay
    if (mission.status === 'success') {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0,0,CW,CH)
      ctx.textAlign = 'center'
      ctx.font = 'bold 26px JetBrains Mono'; ctx.fillStyle = '#f97316'
      ctx.fillText('🎉 MISSION CLEAR!', CW/2, CH/2 - 10)
      ctx.font = '11px JetBrains Mono'; ctx.fillStyle = '#94a3b8'
      ctx.fillText(`${mission.laps} laps completed`, CW/2, CH/2 + 16)
      ctx.restore()
    }

  }, [robot, obstacles, lineLeft, lineRight, distance, viewMode, arenaPreset, selectedObs, mission.status])

  // ── Three.js 3D with camera orbit + scroll zoom ─────────────────────────
  useEffect(() => {
    if (viewMode !== '3D' || !container3dRef.current) return

    // Use fixed pixel dimensions identical to the 2D canvas (CW×CH = 360×260).
    // CSS width/height:100% on the renderer domElement stretches it to fill the
    // container visually — no need to read container dimensions from the DOM.
    const container = container3dRef.current
    if (!container) return
    let outerCleanup: (() => void) | null = null
    const W = CW   // 360
    const H = CH   // 260

    const scene  = new THREE.Scene(); scene.background = new THREE.Color('#141210')
    let camTheta = 0.4, camPhi = 0.85, camR = 220

    const camera = new THREE.PerspectiveCamera(40, W/H, 0.1, 1000)
    const syncCam = () => {
      camera.position.set(
        Math.cos(camTheta) * Math.sin(camPhi) * camR,
        Math.cos(camPhi) * camR,
        Math.sin(camTheta) * Math.sin(camPhi) * camR
      )
      camera.lookAt(0, 0, 0)
    }
    syncCam()

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H); renderer.shadowMap.enabled = true
    // Stretch canvas to fill the container (CSS, not pixel buffer)
    renderer.domElement.style.width  = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    // Lights
    scene.add(new THREE.AmbientLight('#ffffff', 0.45))
    const dl = new THREE.DirectionalLight('#fff8f0', 1.2)
    dl.position.set(50, 100, 50); dl.castShadow = true; scene.add(dl)

    // Floor + grid
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(320,240), new THREE.MeshStandardMaterial({ color:'#161210', roughness:0.9 }))
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor)
    scene.add(new THREE.GridHelper(280, 28, '#3d3128', '#2d2420'))

    // Track line
    const buildLine = (): THREE.Vector3[] => {
      const pts: THREE.Vector3[] = []
      if (arenaPreset === 'oval' || arenaPreset === 'custom') {
        for (let i = 0; i <= 120; i++) {
          const t = (i/120)*Math.PI*2
          pts.push(new THREE.Vector3(Math.cos(t)*88, 0.3, Math.sin(t)*56))
        }
      } else if (arenaPreset === 'figure8') {
        for (const [cx,cz] of [[-40,0],[40,0]]) {
          for (let i = 0; i <= 80; i++) {
            const t = (i/80)*Math.PI*2
            pts.push(new THREE.Vector3(cx+Math.cos(t)*54, 0.3, cz+Math.sin(t)*44))
          }
        }
      } else if (arenaPreset === 'sumo') {
        for (let i = 0; i <= 120; i++) {
          const t = (i/120)*Math.PI*2
          pts.push(new THREE.Vector3(Math.cos(t)*80, 0.3, Math.sin(t)*80))
        }
      } else if (arenaPreset === 'maze') {
        for (const [x1,z1,x2,z2] of [[-104,-56,104,-56],[104,-56,104,56],[104,56,-104,56],[-104,56,-104,-56],[-104,0,4,0],[4,-56,4,0],[-28,0,-28,56]] as [number,number,number,number][]) {
          const steps = Math.max(Math.abs(x2-x1),Math.abs(z2-z1))
          for (let i = 0; i <= steps; i++) {
            const t = i/steps
            pts.push(new THREE.Vector3(x1+(x2-x1)*t, 0.3, z1+(z2-z1)*t))
          }
        }
      }
      return pts
    }
    const pts = buildLine()
    if (pts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#06b6d4' })))
    }

    // Robot group
    const rg = new THREE.Group(); scene.add(rg)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(16,16,5,24), new THREE.MeshStandardMaterial({ color:'#1e293b', roughness:0.8 }))
    body.castShadow = true; body.position.set(0, 2.5, 0); rg.add(body)
    const wg  = new THREE.CylinderGeometry(6,6,2,16); wg.rotateZ(Math.PI/2)
    const wm  = new THREE.MeshStandardMaterial({ color:'#111827', roughness:0.9 })
    for (const [x,y,z] of [[-17,3,0],[17,3,0],[0,3,14],[0,3,-14]] as [number,number,number][]) {
      const w = new THREE.Mesh(wg, wm); w.position.set(x,y,z); w.castShadow = true; rg.add(w)
    }
    const face = new THREE.Mesh(new THREE.CylinderGeometry(14,14,2,24), new THREE.MeshStandardMaterial({ color:'#f97316', roughness:0.6 }))
    face.position.y = 6; rg.add(face)
    const ledMat = new THREE.MeshStandardMaterial({ color:'#888', emissive:'#000' })
    const led3d  = new THREE.Mesh(new THREE.SphereGeometry(2.5,8,8), ledMat)
    led3d.position.set(0,8,12); rg.add(led3d)
    const ledLight = new THREE.PointLight('#fff', 0, 50); ledLight.position.set(0,8,12); rg.add(ledLight)
    const sg = new THREE.Group(); sg.position.set(-8,7,-12); rg.add(sg)
    const sa = new THREE.Mesh(new THREE.BoxGeometry(3,14,3), new THREE.MeshStandardMaterial({ color:'#94a3b8' }))
    sa.position.y = 7; sg.add(sa)

    // Obstacle meshes
    const omeshes: THREE.Mesh[] = []
    for (const o of obstacles) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, 20, o.h), new THREE.MeshStandardMaterial({ color:'#ef4444', roughness:0.7 }))
      m.position.set((o.x-180)*0.8, 10, (o.y-130)*0.8); m.castShadow = true
      scene.add(m); omeshes.push(m)
    }

    // Camera orbit mouse handlers
    let orbiting = false, lmx = 0, lmy = 0
    const onMD = (e: MouseEvent) => { orbiting = true; lmx = e.clientX; lmy = e.clientY }
    const onMM = (e: MouseEvent) => {
      if (!orbiting) return
      camTheta -= (e.clientX - lmx) * 0.01
      camPhi    = Math.max(0.18, Math.min(1.4, camPhi + (e.clientY - lmy) * 0.01))
      lmx = e.clientX; lmy = e.clientY; syncCam()
    }
    const onMU = () => { orbiting = false }
    const onWh = (e: WheelEvent) => { camR = Math.max(80, Math.min(400, camR + e.deltaY * 0.3)); syncCam() }
    renderer.domElement.addEventListener('mousedown', onMD)
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    renderer.domElement.addEventListener('wheel', onWh)

    // Hint
    const hintDiv = document.createElement('div')
    hintDiv.textContent = 'Drag to orbit · Scroll to zoom'
    Object.assign(hintDiv.style, { position:'absolute', bottom:'8px', left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,0.3)', fontSize:'9px', fontFamily:'JetBrains Mono', pointerEvents:'none', whiteSpace:'nowrap' })
    container.style.position = 'relative'
    container.appendChild(hintDiv)

    // Animate
    let running = true
    const animate = () => {
      if (!running) return
      const cur = robotRef.current
      rg.position.set((cur.x-180)*0.8, 0, (cur.y-130)*0.8)
      rg.rotation.y = -(cur.angle - Math.PI/2)
      const cm: Record<string,string> = { RED:'#f87171', GREEN:'#4ade80', BLUE:'#60a5fa', ORANGE:'#fb923c' }
      if (cur.ledColor !== 'OFF') { ledMat.color.set(cm[cur.ledColor]||'#fff'); ledMat.emissive.set(cm[cur.ledColor]||'#fff'); ledMat.emissiveIntensity = 0.9; ledLight.intensity = 2.5 }
      else { ledMat.emissiveIntensity = 0; ledLight.intensity = 0 }
      sg.rotation.y = ((cur.servoAngle - 90) * Math.PI) / 180
      const obs = obstaclesRef.current
      omeshes.forEach((m, i) => { const o = obs[i]; if (o) { m.position.x = (o.x-180)*0.8; m.position.z = (o.y-130)*0.8 } })
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    outerCleanup = () => {
      running = false
      renderer.domElement.removeEventListener('mousedown', onMD)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
      renderer.domElement.removeEventListener('wheel', onWh)
      if (container.contains(hintDiv)) container.removeChild(hintDiv)
      renderer.dispose(); scene.clear()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }

    return () => { outerCleanup?.() }
  // NOTE: 'obstacles' intentionally omitted — positions read via obstaclesRef inside loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, arenaPreset])

  // ── Canvas event handlers ────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const applyPaint = useCallback((x: number, y: number) => {
    const c = paintCanvas.current; if (!c) return
    const ctx = c.getContext('2d')!
    if (paintTool === 'paint') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.shadowBlur = 6; ctx.shadowColor = '#06b6d4'; ctx.fillStyle = '#06b6d4'
      ctx.beginPath(); ctx.arc(x, y, paintSize, 0, Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath(); ctx.arc(x, y, paintSize, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }
    setRobot(r => ({ ...r })) // trigger redraw
  }, [paintTool, paintSize])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    if (paintTool !== 'off' && arenaPreset === 'custom') { isPainting.current = true; applyPaint(x, y); return }
    if (runStatus !== 'running') {
      if (Math.sqrt((x-robot.x)**2 + (y-robot.y)**2) < 22) {
        dragRef.current = { type: 'robot', ox: x - robot.x, oy: y - robot.y }; return
      }
    }
    for (const o of [...obstacles].reverse()) {
      if (x >= o.x-o.w/2 && x <= o.x+o.w/2 && y >= o.y-o.h/2 && y <= o.y+o.h/2) {
        setSelectedObs(o.id)
        dragRef.current = { type: 'obs', id: o.id, ox: x - o.x, oy: y - o.y }; return
      }
    }
    setSelectedObs(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    if (isPainting.current) { applyPaint(x, y); return }
    const ds = dragRef.current; if (!ds) return
    if (ds.type === 'robot') {
      setRobot(r => ({ ...r, x: Math.max(22, Math.min(CW-22, x-ds.ox)), y: Math.max(22, Math.min(CH-22, y-ds.oy)) }))
    } else {
      setObstacles(os => os.map(o => o.id === ds.id ? { ...o, x: Math.max(10, Math.min(CW-10, x-ds.ox)), y: Math.max(10, Math.min(CH-10, y-ds.oy)) } : o))
    }
  }

  const handleMouseUp = () => { dragRef.current = null; isPainting.current = false }

  const cursor = () => {
    if (paintTool === 'paint') return 'crosshair'
    if (paintTool === 'erase') return 'cell'
    return 'default'
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const PRESETS: { id: ArenaPreset; label: string }[] = [
    { id:'oval',    label:'⭕ Oval'     },
    { id:'figure8', label:'♾️ Figure-8' },
    { id:'sumo',    label:'🥋 Sumo'    },
    { id:'maze',    label:'🌀 Maze'    },
    { id:'custom',  label:'✏️ Custom'  },
  ]

  return (
    <div className="flex gap-3 p-2 h-full overflow-hidden" style={{ minHeight: 320 }}>

      {/* ── Arena ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">

        {/* Top toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Arena presets */}
          <div className="flex p-0.5 rounded-lg border gap-0.5 flex-wrap" style={{ background:'var(--bg-mantle)', borderColor:'var(--border)' }}>
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setArenaPreset(p.id)}
                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all select-none"
                style={{ background: arenaPreset === p.id ? 'var(--accent-mauve)' : 'transparent', color: arenaPreset === p.id ? 'white' : 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Paint tools (custom mode) */}
          {arenaPreset === 'custom' && (
            <div className="flex gap-1 items-center">
              {(['paint','erase','off'] as PaintTool[]).map(t => (
                <button key={t} onClick={() => setPaintTool(t)}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all"
                  style={{ background: paintTool === t ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: paintTool === t ? 'white' : 'var(--text-muted)', borderColor:'var(--border)' }}>
                  {t === 'paint' ? '✏️' : t === 'erase' ? '🧹' : '✋'}
                </button>
              ))}
              <select value={paintSize} onChange={e => setPaintSize(Number(e.target.value))}
                className="text-[9px] rounded px-1 py-0.5 outline-none"
                style={{ background:'var(--bg-surface0)', color:'var(--text)', border:'1px solid var(--border)' }}>
                {[4,8,14,20].map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
              <button onClick={() => { const ctx = paintCanvas.current?.getContext('2d'); if (ctx) { ctx.clearRect(0,0,CW,CH); setRobot(r => ({...r})) } }}
                className="px-1.5 py-0.5 rounded text-[9px] border"
                style={{ background:'var(--bg-surface0)', color:'var(--accent-red)', borderColor:'var(--border)' }}>
                🗑️
              </button>
            </div>
          )}

          {/* Obstacle controls */}
          {(arenaPreset === 'sumo' || arenaPreset === 'custom') && (
            <div className="flex gap-1">
              <button onClick={() => setObstacles(os => [...os, { id: Date.now(), x: 80 + Math.random()*200, y: 60 + Math.random()*140, w: 36, h: 36 }])}
                className="px-2 py-0.5 rounded-lg text-[9px] font-bold border"
                style={{ background:'var(--bg-surface0)', color:'var(--accent-green)', borderColor:'var(--border)' }}>
                + Wall
              </button>
              {selectedObs != null && (
                <button onClick={() => { setObstacles(os => os.filter(o => o.id !== selectedObs)); setSelectedObs(null) }}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-bold border"
                  style={{ background:'var(--bg-surface0)', color:'var(--accent-red)', borderColor:'var(--border)' }}>
                  🗑 Del
                </button>
              )}
            </div>
          )}

          {/* 2D / 3D */}
          <div className="ml-auto flex p-0.5 rounded-lg border gap-0.5" style={{ background:'var(--bg-mantle)', borderColor:'var(--border)' }}>
            {(['2D','3D'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className="px-2 py-0.5 rounded-md text-[9px] font-extrabold"
                style={{ background: viewMode === m ? 'var(--accent-mauve)' : 'transparent', color: viewMode === m ? 'white' : 'var(--text-muted)' }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 rounded-xl border overflow-hidden"
          style={{ background:'var(--bg-base)', borderColor:'var(--border)', minHeight: 250 }}>

          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <div className="text-[10px] font-black" style={{ color:'var(--accent-mauve)' }}>🍁 Kitsune Arena</div>
            <div className="text-[9px] mt-0.5" style={{ color:'var(--text-subtle)' }}>
              {paintTool !== 'off' ? '🎨 Draw track with mouse' : 'Drag 🦊 robot to reposition'}
            </div>
          </div>

          {/* Distance badge */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background:'var(--bg-surface0)', border:'1px solid var(--border)' }}>
            <span style={{ color:'var(--accent-yellow)' }}>📏</span>
            <span style={{ color: distance < 20 ? 'var(--accent-red)' : 'var(--text)' }}>{distance} cm</span>
          </div>

          {/* Line follower hint — shown when both sensors read 1 and robot is stopped */}
          {runStatus === 'running' && lineLeft === 1 && lineRight === 1 && robot.dir === 'STOP' && (
            <div className="absolute top-8 left-2 right-2 z-10 px-2 py-1.5 rounded-lg text-[9px] leading-relaxed"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid var(--accent-mauve)', color: 'var(--accent-mauve)' }}>
              💡 <strong>Hint:</strong> Both sensors ON the line → robot stops. For line following,
              change <code style={{ background:'var(--bg-surface0)', padding:'0 3px', borderRadius:2 }}>else → STOP</code> to{' '}
              <code style={{ background:'var(--bg-surface0)', padding:'0 3px', borderRadius:2 }}>else → FORWARD</code>
            </div>
          )}

          {/* Mission bar */}
          {mission.active && mission.status === 'running' && (
            <div className="absolute bottom-8 left-3 right-3 z-10">
              <div className="flex justify-between text-[8px] mb-0.5" style={{ color:'var(--text-muted)' }}>
                <span>🎯 Lap {mission.laps} / {mission.targetLaps}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--bg-surface1)' }}>
                <div style={{ width:`${(mission.laps/mission.targetLaps)*100}%`, height:'100%', background:'var(--accent-mauve)', borderRadius:99, transition:'width 0.3s' }} />
              </div>
            </div>
          )}

          {viewMode === '2D' ? (
            <canvas ref={canvasRef} width={CW} height={CH}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              style={{ display:'block', width:'100%', height:'100%', cursor: cursor() }}
            />
          ) : (
            <div ref={container3dRef} style={{ width:'100%', height:'100%', minHeight:250 }} />
          )}
        </div>
      </div>

      {/* ── Dashboard ─────────────────────────────────────────────── */}
      <div className="w-[162px] flex flex-col gap-2 flex-shrink-0">

        {/* OLED */}
        <div className="rounded-xl border p-2 flex-shrink-0" style={{ background:'#090d16', borderColor:'#1e293b' }}>
          <div className="text-[9px] font-black uppercase mb-1" style={{ color:'var(--accent-mauve)' }}>📺 OLED (128×64)</div>
          <div className="rounded p-1.5 min-h-[38px] font-mono text-[9px] leading-tight"
            style={{ background:'#020617', border:'1px solid #1e293b', color:'#38bdf8', textShadow:'0 0 4px rgba(56,189,248,0.4)' }}>
            {robot.oledLines.length === 0
              ? <span style={{ color:'rgba(56,189,248,0.18)' }}>[No output]</span>
              : robot.oledLines.map((l,i) => <div key={i} className="truncate">{l}</div>)
            }
          </div>
        </div>

        {/* Buttons */}
        <div className="rounded-xl border p-2 flex-shrink-0" style={{ background:'var(--bg-mantle)', borderColor:'var(--border)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold uppercase" style={{ color:'var(--text-subtle)' }}>🔘 Onboard Inputs</span>
            {runStatus !== 'running' && (
              <span className="text-[8px] px-1 rounded" style={{ background:'var(--accent-yellow)22', color:'var(--accent-yellow)' }}>▶ Run first</span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[{ lbl:'BTN A', k:'A', s: buttonA, fn: setButtonA }, { lbl:'BTN B', k:'B', s: buttonB, fn: setButtonB }].map(b => (
              <button key={b.lbl}
                title={`Hold to press button ${b.k}. Use with the "Button ${b.k} pressed?" block.`}
                onMouseDown={() => b.fn(true)} onMouseUp={() => b.fn(false)} onMouseLeave={() => b.fn(false)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-black select-none transition-all"
                style={{ background: b.s ? 'var(--accent-mauve)' : 'var(--bg-surface0)', color: b.s ? 'white' : 'var(--text-muted)', border:`1px solid ${b.s ? 'var(--accent-mauve)' : 'var(--border)'}`, boxShadow: b.s ? '0 0 8px var(--accent-mauve)' : 'none', transform: b.s ? 'scale(0.94)' : 'scale(1)', cursor:'pointer' }}>
                {b.lbl}{b.s ? ' ●' : ''}
              </button>
            ))}
          </div>
          <p className="text-[8px] mt-1.5 leading-tight" style={{ color:'var(--text-subtle)' }}>
            Hold to press. Pairs with the <span style={{ color:'var(--accent-mauve)' }}>Button A/B pressed?</span> block.
          </p>
        </div>

        {/* Status HUD */}
        <div className="rounded-xl border p-2 text-[9px] leading-relaxed flex flex-col gap-0.5 flex-shrink-0"
          style={{ background:'rgba(0,0,0,0.1)', borderColor:'var(--border)', color:'var(--text-muted)' }}>
          {[
            { label:'⚙️ Direction', val: robot.dir,            active: robot.dir !== 'STOP',      color:'var(--accent-green)' },
            { label:'⚡ Speed',     val: `${robot.speed}%`,    active: robot.speed > 0,            color:'var(--accent-yellow)' },
            { label:'🦾 Servo',    val: `${robot.servoAngle}°`,active: true,                       color:'var(--text)' },
            { label:'💡 LED',      val: robot.ledColor,        active: robot.ledColor !== 'OFF',   color:'var(--accent-mauve)' },
          ].map(s => (
            <div key={s.label} className="flex justify-between">
              <span>{s.label}</span>
              <span className="font-bold font-mono" style={{ color: s.active ? s.color : 'var(--text-subtle)' }}>{s.val}</span>
            </div>
          ))}
          <div className="border-t mt-1 pt-1 flex flex-col gap-0.5" style={{ borderColor:'var(--border)' }}>
            <div className="flex justify-between"><span>👁 Line L</span><span className="font-bold" style={{ color: lineLeft  ? 'var(--accent-teal)' : 'var(--text-subtle)' }}>{lineLeft  ? 'ON (1)' : 'OFF (0)'}</span></div>
            <div className="flex justify-between"><span>👁 Line R</span><span className="font-bold" style={{ color: lineRight ? 'var(--accent-teal)' : 'var(--text-subtle)' }}>{lineRight ? 'ON (1)' : 'OFF (0)'}</span></div>
          </div>
        </div>

        {/* Mission */}
        {(arenaPreset === 'oval' || arenaPreset === 'figure8') && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => setMission(m => ({
                ...m,
                active: !m.active || m.status !== 'running',
                status: (!m.active || m.status !== 'running') ? 'running' : 'idle',
                laps: 0, lastCrossed: false
              }))}
              className="w-full py-1.5 rounded-lg text-[10px] font-black transition-all"
              style={{ background: mission.active && mission.status === 'running' ? 'var(--accent-red)' : 'var(--accent-mauve)', color:'white', border:'none', cursor:'pointer' }}>
              {mission.active && mission.status === 'running' ? '⏹ End Mission' : '🎯 Start Mission'}
            </button>
            {mission.status === 'success' && (
              <div className="rounded-lg p-1.5 text-center text-[9px] font-bold"
                style={{ background:'var(--accent-green)22', border:'1px solid var(--accent-green)', color:'var(--accent-green)' }}>
                🎉 {mission.laps} laps done!
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
