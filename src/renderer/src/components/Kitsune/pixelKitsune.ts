/**
 * pixelKitsune.ts
 * Renders the kitsune as crisp pixel art from frames extracted out of the
 * real chibi sprite sheet (see kitsunePixels.ts — auto-generated). No white
 * background, no frame-cropping issues: the data IS the pixels.
 */

import { KITSUNE_PALETTE, KITSUNE_FRAMES, KITSUNE_FPS, type PixelAnim } from './kitsunePixels'

export type { PixelAnim }

const CH = '.0123456789abcdefghij'

export function pixelFps(anim: PixelAnim): number { return KITSUNE_FPS[anim] }
export function pixelFrameCount(anim: PixelAnim): number { return KITSUNE_FRAMES[anim].length }
export function pixelFrameIndex(anim: PixelAnim, t: number): number {
  return Math.floor(t * KITSUNE_FPS[anim]) % KITSUNE_FRAMES[anim].length
}

/** Native pixel-grid height of a frame (all frames are 44 tall). */
export function pixelGridHeight(anim: PixelAnim, frame = 0): number {
  return KITSUNE_FRAMES[anim][frame]?.length ?? 44
}

/**
 * Draw a kitsune frame. (cx, feetY) = horizontal center + feet baseline.
 * destH = rendered height in px (the frame is scaled to fit). flip mirrors
 * horizontally — the sheet art faces the viewer, so use flip to suggest
 * left/right travel direction.
 */
export function drawPixelKitsune(
  ctx: CanvasRenderingContext2D,
  anim: PixelAnim,
  frame: number,
  cx: number,
  feetY: number,
  destH: number,
  flip = false,
) {
  const frames = KITSUNE_FRAMES[anim]
  const grid = frames[Math.max(0, Math.min(frame, frames.length - 1))]
  if (!grid) return
  const rowsN = grid.length
  const colsN = Math.max(...grid.map(r => r.length))
  const px = destH / rowsN
  const totalW = colsN * px
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(cx, feetY)
  if (flip) ctx.scale(-1, 1)
  const ox = -totalW / 2
  const oy = -destH
  for (let r = 0; r < rowsN; r++) {
    const line = grid[r]
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '.') continue
      const idx = CH.indexOf(ch) - 1
      if (idx < 0) continue
      ctx.fillStyle = KITSUNE_PALETTE[idx]
      // +1 px overlap avoids hairline seams between cells when px is fractional
      ctx.fillRect(Math.floor(ox + c * px), Math.floor(oy + r * px), Math.ceil(px) + 1, Math.ceil(px) + 1)
    }
  }
  ctx.restore()
}
