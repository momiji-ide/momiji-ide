/**
 * kitsuneSheet.ts
 * Loader + frame map for the chibi kitsune mega sprite sheet
 * (src/renderer/src/assets/sprites/kitsune_chibi_mega_sheet.png, 1024×1024).
 *
 * Frame rects are NORMALIZED (0-1 fractions of sheet size) so the sheet can
 * be re-exported at any resolution. If frames look misaligned after the art
 * is updated, tweak ROW_Y / COLS_* below — nothing else needs to change.
 */

import sheetUrl from '../../assets/sprites/kitsune_chibi_mega_sheet.png'

export type KitsuneAnim =
  | 'idle' | 'walk' | 'run' | 'jump'
  | 'work' | 'confused' | 'work2' | 'angry'
  | 'tired' | 'celebrate'

// Five label rows on the sheet, top to bottom. y = top of sprite band, h = band height.
const ROW_Y = [0.018, 0.201, 0.384, 0.567, 0.750]
const ROW_H = 0.150

// 4-frame groups (narrow frames)
const COLS_L4 = [0.023, 0.133, 0.242, 0.352]
const COLS_R4 = [0.523, 0.637, 0.750, 0.863]
const W4 = 0.107

// 3-frame groups (wider frames — working poses include the laptop)
const COLS_L3 = [0.020, 0.175, 0.330]
const COLS_R3 = [0.545, 0.690, 0.835]
const W3 = 0.135

interface AnimDef { row: number; cols: number[]; w: number; fps: number; loop: boolean }

export const ANIMS: Record<KitsuneAnim, AnimDef> = {
  idle:      { row: 0, cols: COLS_L4, w: W4, fps: 4,  loop: true  },
  walk:      { row: 0, cols: COLS_R4, w: W4, fps: 8,  loop: true  },
  run:       { row: 1, cols: COLS_L4, w: W4, fps: 10, loop: true  },
  jump:      { row: 1, cols: COLS_R4, w: W4, fps: 6,  loop: false },
  work:      { row: 2, cols: COLS_L3, w: W3, fps: 3,  loop: true  },
  confused:  { row: 2, cols: COLS_R3, w: W3, fps: 3,  loop: true  },
  work2:     { row: 3, cols: COLS_L3, w: W3, fps: 3,  loop: true  },
  angry:     { row: 3, cols: COLS_R3, w: W3, fps: 4,  loop: true  },
  tired:     { row: 4, cols: COLS_L3, w: W3, fps: 2,  loop: true  },
  celebrate: { row: 4, cols: COLS_R3, w: W3, fps: 5,  loop: true  },
}

export type KitsuneSheet = HTMLCanvasElement

let _sheet: KitsuneSheet | null = null
let _loading: Promise<KitsuneSheet> | null = null

/**
 * The source PNG has a WHITE background, not transparency. We remove it with
 * a flood fill from the sheet borders: only near-white pixels CONNECTED to
 * the edge become transparent — whites inside the character (hair, coat)
 * are preserved because they're enclosed by darker outlines.
 */
function removeWhiteBackground(img: HTMLImageElement): KitsuneSheet {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const W = c.width, H = c.height
  const data = ctx.getImageData(0, 0, W, H)
  const px = data.data
  const isWhite = (i: number) => px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232
  const visited = new Uint8Array(W * H)
  const stack: number[] = []
  // Seed from every border pixel
  for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1) }
  while (stack.length) {
    const p = stack.pop()!
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    if (!isWhite(i)) continue
    px[i + 3] = 0
    const x = p % W, y = (p / W) | 0
    if (x > 0)     stack.push(p - 1)
    if (x < W - 1) stack.push(p + 1)
    if (y > 0)     stack.push(p - W)
    if (y < H - 1) stack.push(p + W)
  }
  ctx.putImageData(data, 0, 0)
  return c
}

export function loadKitsuneSheet(): Promise<KitsuneSheet> {
  if (_sheet) return Promise.resolve(_sheet)
  if (_loading) return _loading
  _loading = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { _sheet = removeWhiteBackground(img); resolve(_sheet) }
    img.onerror = reject
    img.src = sheetUrl
  })
  return _loading
}

export function getKitsuneSheet(): KitsuneSheet | null { return _sheet }

/** Which frame index to show for a given animation at time t (seconds). */
export function frameIndex(anim: KitsuneAnim, t: number): number {
  const a = ANIMS[anim]
  const idx = Math.floor(t * a.fps)
  return a.loop ? idx % a.cols.length : Math.min(idx, a.cols.length - 1)
}

/**
 * Draw a kitsune frame centered at (cx, baselineY) where baselineY is the
 * FEET position. destH = rendered height in px. flip mirrors horizontally
 * (sheet art faces left-ish; flip=true to face right).
 */
export function drawKitsune(
  ctx: CanvasRenderingContext2D,
  img: KitsuneSheet,
  anim: KitsuneAnim,
  frame: number,
  cx: number,
  baselineY: number,
  destH: number,
  flip = false,
) {
  const a = ANIMS[anim]
  const f = Math.max(0, Math.min(frame, a.cols.length - 1))
  const sx = a.cols[f] * img.width
  const sy = ROW_Y[a.row] * img.height
  const sw = a.w * img.width
  const sh = ROW_H * img.height
  const destW = destH * (sw / sh)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.translate(cx, baselineY)
  if (flip) ctx.scale(-1, 1)
  ctx.drawImage(img, sx, sy, sw, sh, -destW / 2, -destH, destW, destH)
  ctx.restore()
}
