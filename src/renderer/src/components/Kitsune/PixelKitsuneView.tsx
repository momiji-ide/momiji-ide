import { useEffect, useRef } from 'react'
import { drawPixelKitsune, pixelFrameIndex, type PixelAnim } from './pixelKitsune'

interface Props {
  anim?: PixelAnim
  size?: number          // rendered height in CSS px
  className?: string
  float?: boolean        // gentle vertical bob
  lively?: boolean       // cycle through poses so she feels alive
}

// Each entry: [pose, how long to hold it (seconds)]. Idle dominates; the
// other poses pop in occasionally so she looks like she's actually doing things.
const LIVELY: [PixelAnim, number][] = [
  ['idle', 5], ['work', 4], ['idle', 4], ['confused', 2.5],
  ['idle', 4], ['celebrate', 2.5], ['idle', 5], ['tired', 3.5],
]
const LIVELY_TOTAL = LIVELY.reduce((s, [, d]) => s + d, 0)

function livelyAnim(t: number): { anim: PixelAnim; local: number } {
  let x = t % LIVELY_TOTAL
  for (const [anim, dur] of LIVELY) {
    if (x < dur) return { anim, local: x }
    x -= dur
  }
  return { anim: 'idle', local: 0 }
}

/** Small animated pixel-art kitsune on a transparent canvas. */
export function PixelKitsune({ anim = 'idle', size = 96, className, float = true, lively = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = size, H = size
    canvas.width = W * dpr; canvas.height = H * dpr

    let raf = 0
    const loop = (now: number) => {
      const t = now / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const cur = lively ? livelyAnim(t) : { anim, local: t }
      // calmer bob while working/tired, livelier when celebrating
      const amp = cur.anim === 'celebrate' ? 0.05 : cur.anim === 'tired' ? 0.015 : 0.03
      const bob = float ? Math.sin(t * 1.8) * (size * amp) : 0
      drawPixelKitsune(ctx, cur.anim, pixelFrameIndex(cur.anim, cur.local), W / 2, H - 2 + bob, size * 0.92)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [anim, size, float, lively])

  return (
    <canvas ref={ref} className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated',
               filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))' }} />
  )
}
