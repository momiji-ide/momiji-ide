/**
 * pixelKitsune.ts
 * Renders the kitsune as crisp pixel art from frames extracted out of the
 * real chibi sprite sheet (see kitsunePixels.ts — auto-generated). No white
 * background, no frame-cropping issues: the data IS the pixels.
 */

import { KITSUNE_PALETTE, KITSUNE_FRAMES, KITSUNE_FPS, type PixelAnim } from './kitsunePixels'

export type { PixelAnim }

const CH = '.0123456789abcdefghij'

// ─── Background cleanup ───────────────────────────────────────────────────────
// Some animations (confused, notably) were extracted from sheets with an
// opaque near-white studio background — their corner pixels are not
// transparent. Strip that at load time: flood-fill the near-white field in
// from the frame edges, then drop tiny stranded noise specks, so only the
// character survives. Frames that already have transparent corners are
// returned untouched.
const BG_CHARS = new Set(['0', '1', '2'])

function stripBackground(grid: string[]): string[] {
  const rows = grid.length
  const cols = Math.max(...grid.map(r => r.length))
  const at = (r: number, c: number) => grid[r]?.[c] ?? '.'
  // Only frames whose border is substantially opaque carry a studio
  // background. Cleanly-keyed frames have a (nearly) transparent border.
  let borderCells = 0, opaqueBorder = 0
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) {
    borderCells++; if (at(r, c) !== '.') opaqueBorder++
  }
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) {
    borderCells++; if (at(r, c) !== '.') opaqueBorder++
  }
  if (opaqueBorder / borderCells < 0.25) return grid

  const cells = grid.map(r => r.padEnd(cols, '.').split(''))

  // Flood-fill from every edge cell. Edge cells are always background; from
  // there only near-white cells are consumed, so the dark character outline
  // stops the fill before it reaches the white fur inside.
  const bg = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))
  const stack: number[] = []
  const push = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols || bg[r][c]) return
    const edge = r === 0 || c === 0 || r === rows - 1 || c === cols - 1
    if (!edge && !BG_CHARS.has(cells[r][c])) return
    bg[r][c] = true
    stack.push(r * cols + c)
  }
  for (let r = 0; r < rows; r++) { push(r, 0); push(r, cols - 1) }
  for (let c = 0; c < cols; c++) { push(0, c); push(rows - 1, c) }
  while (stack.length) {
    const i = stack.pop()!
    const r = (i / cols) | 0, c = i % cols
    push(r - 1, c); push(r + 1, c); push(r, c - 1); push(r, c + 1)
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (bg[r][c]) cells[r][c] = '.'

  // The cleared field leaves behind small stranded specks (quantization noise
  // that wasn't near-white). Drop every connected component that's too small
  // to be part of the character.
  const comp = Array.from({ length: rows }, () => new Array<number>(cols).fill(-1))
  const sizes: number[] = []
  for (let r0 = 0; r0 < rows; r0++) for (let c0 = 0; c0 < cols; c0++) {
    if (cells[r0][c0] === '.' || comp[r0][c0] !== -1) continue
    const id = sizes.length
    sizes.push(0)
    const st = [r0 * cols + c0]
    comp[r0][c0] = id
    while (st.length) {
      const i = st.pop()!
      const r = (i / cols) | 0, c = i % cols
      sizes[id]++
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
        if (cells[nr][nc] === '.' || comp[nr][nc] !== -1) continue
        comp[nr][nc] = id
        st.push(nr * cols + nc)
      }
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (cells[r][c] !== '.' && sizes[comp[r][c]] < 25) cells[r][c] = '.'
  }

  return cells.map(r => r.join(''))
}

const FRAMES: Record<PixelAnim, string[][]> = Object.fromEntries(
  (Object.keys(KITSUNE_FRAMES) as PixelAnim[]).map(a => [a, KITSUNE_FRAMES[a].map(stripBackground)])
) as Record<PixelAnim, string[][]>

export function pixelFps(anim: PixelAnim): number { return KITSUNE_FPS[anim] }
export function pixelFrameCount(anim: PixelAnim): number { return FRAMES[anim].length }
export function pixelFrameIndex(anim: PixelAnim, t: number): number {
  return Math.floor(t * KITSUNE_FPS[anim]) % FRAMES[anim].length
}

/** Native pixel-grid height of a frame (all frames are 44 tall). */
export function pixelGridHeight(anim: PixelAnim, frame = 0): number {
  return FRAMES[anim][frame]?.length ?? 44
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
  const frames = FRAMES[anim]
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
