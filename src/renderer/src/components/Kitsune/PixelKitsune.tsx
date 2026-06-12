import { useEffect, useRef } from 'react'
import { drawPixelKitsune, pixelFrameIndex, type PixelAnim } from './pixelKitsune'

interface Props {
  anim?: PixelAnim
  size?: number          // rendered height in CSS px
  className?: string
  float?: boolean        // gentle vertical bob
}

/** Small animated pixel-art kitsune on a transparent canvas. */
export function PixelKitsune({ anim = 'idle', size = 96, className, float = true }: Props) {
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
      const bob = float ? Math.sin(t * 1.8) * (size * 0.03) : 0
      drawPixelKitsune(ctx, anim, pixelFrameIndex(anim, t), W / 2, H - 2 + bob, size * 0.92)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [anim, size, float])

  return (
    <canvas ref={ref} className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated' }} />
  )
}
