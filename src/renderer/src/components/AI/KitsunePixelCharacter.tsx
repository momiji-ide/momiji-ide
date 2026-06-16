import { useState, useEffect } from 'react'

// Color Palette Map for the pixel-art Kitsune character
const PALETTE: Record<string, string> = {
  '.': 'transparent',
  'k': '#0f172a', // Dark outline
  'o': '#f97316', // Brand orange (accent-mauve)
  'd': '#ea580c', // Dark orange shadow
  'w': '#ffffff', // White hair / jacket
  'g': '#cbd5e1', // Grey boots / highlights
  'y': '#f59e0b', // Golden eyes
  's': '#ffedd5', // Skin tone
  'b': '#1e293b', // Body / pants
  'c': '#06b6d4', // Hologram cyan (coding/working state)
}

// 24x24 Hand-crafted Pixel Art Poses
const FRAMES: Record<string, string[][]> = {
  idle: [
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksssssssssssswwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwwk...kkkkkk..",
      "..kkwwwwwwkk............",
      "...kwwwwwwk.............",
      "..kwwowwwowk............",
      ".kwwooooowwk............",
      "kwwooooooowwk...........",
      "kwwowwwwowwwk...........",
      ".kbbbbbbbbbk............",
      "..kbbk..kbbk............",
      "..koook..koook..........",
      "..koook..koook..........",
      "...kkk....kkk...........",
      "........................",
    ],
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook.........",
      "kwwwwwwwwwwwwwwk...kkkk.",
      "kwwssswwswssswwk..kooook",
      "kwsyyswwswsyyswk.koooook",
      "ksssssssssssswwkowwwoook",
      "ksssssssssssswkowwwwwok.",
      "kwwsssssssswwk.kowwwwok.",
      ".kwwwwwwwwwwk..kowwwook.",
      "..kkwwwwwwkk....kkkkkk..",
      "...kwwwwwwk.............",
      "..kwwowwwowk............",
      ".kwwooooowwk............",
      "kwwooooooowwk...........",
      "kwwowwwwowwwk...........",
      ".kbbbbbbbbbk............",
      "..kbbk..kbbk............",
      "..koook..koook..........",
      "..koook..koook..........",
      "...kkk....kkk...........",
      "........................",
    ],
  ],
  walk: [
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksssssssssssswwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwk....kkkkkk..",
      "..kkwwwwwwk.............",
      "...kwwwwwwk.............",
      "..kwwowwwowk............",
      ".kwwooooowwk............",
      "kwwooooooowwk...........",
      ".kwwwwwwwwwk............",
      "..kbbbk.kbbbk...........",
      "..kbbk...kbbk...........",
      ".koook....koook.........",
      "..kkk......koook........",
      "............kkk.........",
      "........................",
    ],
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksssssssssssswwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwk....kkkkkk..",
      "..kkwwwwwwk.............",
      "...kwwwwwwk.............",
      "..kwwowwwowk............",
      ".kwwooooowwk............",
      "kwwooooooowwk...........",
      ".kwwwwwwwwwk............",
      "..kbbbk.kbbbk...........",
      "...kbbk.kbbk............",
      "....kbbk.koook..........",
      "....koook.kkk...........",
      ".....kkk................",
      "........................",
    ],
  ],
  run: [
    [
      "........................",
      ".....k......k...........",
      "....kok....kok..........",
      "...koowk..koowk.........",
      "..koowwwkkwwwook...kkkk.",
      ".kwwwwwwwwwwwwwwk.kooook",
      ".kwwssswwswssswwkkooooook",
      ".kwsyyswwswsyyswkowwwook",
      ".ksssssssssssswwkowwwwok",
      "..kssssssssssw..kowwook.",
      "...kwwsssswwk....kkkkkk.",
      "....kwwwwwwk............",
      ".....kwwwwk.............",
      "....kwwowwwowk..........",
      "...kwwooooowwk..........",
      "..kwwooooooowwk.........",
      "..kwwowwwwowwwk.........",
      "...kbbbbbbbbbk..........",
      "....kbbk.kbbk...........",
      "....kbbk..kbbk..........",
      "...koook...koook........",
      "....kkk.....koook.......",
      ".............kkk........",
      "........................",
    ],
    [
      "........................",
      ".....k......k...........",
      "....kok....kok..........",
      "...koowk..koowk.........",
      "..koowwwkkwwwook...kkkk.",
      ".kwwwwwwwwwwwwwwk.kooook",
      ".kwwssswwswssswwkkooooook",
      ".kwsyyswwswsyyswkowwwook",
      ".ksssssssssssswwkowwwwok",
      "..kssssssssssw..kowwook.",
      "...kwwsssswwk....kkkkkk.",
      "....kwwwwwwk............",
      ".....kwwwwk.............",
      "....kwwowwwowk..........",
      "...kwwooooowwk..........",
      "..kwwooooooowwk.........",
      "..kwwowwwwowwwk.........",
      "...kbbbbbbbbbk..........",
      "....kbbk.kbbk...........",
      ".....kbbk.kbbk..........",
      "......kbbk.koook........",
      "......koook.kkk.........",
      ".......kkk..............",
      "........................",
    ],
  ],
  working: [
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksssssssssssswwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwwk...kkkkkk..",
      "..kkwwwwwwkk............",
      "...kwwwwwwk..ccccc......",
      "..kwwowwwowk.c...c......",
      ".kwwooooowwk.ck.kc......",
      "kwwooooooowwk.c.c.......",
      "kwwowwwwowwwk.ccc.......",
      ".kbbbbbbbbbk............",
      "..kbbk..kbbk............",
      "..koook..koook..........",
      "..koook..koook..........",
      "...kkk....kkk...........",
      "........................",
    ],
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksssssssssssswwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwwk...kkkkkk..",
      "..kkwwwwwwkk............",
      "...kwwwwwwk...cccc......",
      "..kwwowwwowk.cc..cc.....",
      ".kwwooooowwk..ck.kc.....",
      "kwwooooooowwk..c.c......",
      "kwwowwwwowwwk..cc.......",
      ".kbbbbbbbbbk............",
      "..kbbk..kbbk............",
      "..koook..koook..........",
      "..koook..koook..........",
      "...kkk....kkk...........",
      "........................",
    ],
  ],
  confused: [
    [
      "......yyy...............",
      ".....y...y..k......k....",
      ".......yy..kok....kok...",
      "......y...koowk..koowk..",
      "......y.koowwwkkwwwook..",
      "k....k.kwwwwwwwwwwwwwwk.",
      "kk..kk.kwwssswwswssswwk.",
      ".kkkk..kwsykswwswsyyswk.",
      "..kk...ksssssssssssswwk.",
      ".......ksssskkkkkssswk..",
      ".......kwwsssssssswwk...",
      "........kwwwwwwwwwwk....",
      ".........kkwwwwwwkk.....",
      "..........kwwwwwwk......",
      ".........kwwowwwowk.....",
      "........kwwooooowwk.....",
      "........kwwooooooowwk...",
      "........kwwowwwwowwwk...",
      ".........kbbbbbbbbbk....",
      "..........kbbk..kbbk....",
      "..........koook..koook..",
      "..........koook..koook..",
      "...........kkk....kkk...",
      "........................",
    ],
  ],
  tired: [
    [
      "........................",
      "....k......k............",
      "...kok....kok...........",
      "..koowk..koowk..........",
      ".koowwwkkwwwook...kkkk..",
      "kwwwwwwwwwwwwwwk.kooook.",
      "kwwssswwswssswwkkoooook.",
      "kwsyyswwswsyyswkowwwoook",
      "ksskkksssskkkwwkowwwwwok",
      "ksssssssssssswkowwwwwwok",
      "kwwsssssssswwk.kowwwook.",
      ".kwwwwwwwwwwk...kkkkkk..",
      "..kkwwwwwwkk..cc........",
      "...kwwwwwwk..c..c.......",
      "..kwwowwwowk..cc........",
      ".kwwooooowwk............",
      "kwwooooooowwk...........",
      "kwwowwwwowwwk...........",
      ".kbbbbbbbbbk............",
      "..kbbk..kbbk............",
      "..koook..koook..........",
      "..koook..koook..........",
      "...kkk....kkk...........",
      "........................",
    ],
  ],
}

interface Props {
  state?: 'idle' | 'walk' | 'run' | 'working' | 'confused' | 'tired'
  size?: number
  animate?: boolean
  style?: React.CSSProperties
}

export function KitsunePixelCharacter({ state = 'idle', size = 48, animate = true, style }: Props) {
  const [frameIdx, setFrameIdx] = useState(0)

  const frames = FRAMES[state] || FRAMES.idle
  const activeFrame = frames[frameIdx % frames.length]

  // Animation ticks
  useEffect(() => {
    if (!animate || frames.length <= 1) {
      setFrameIdx(0)
      return
    }

    const intervalMs = state === 'walk' ? 250 : state === 'run' ? 150 : 450
    const timer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [state, animate, frames.length])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {activeFrame.map((row, y) =>
        row.split('').map((char, x) => {
          const color = PALETTE[char] || 'transparent'
          if (color === 'transparent') return null
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={color}
              stroke="none"
            />
          )
        })
      )}
    </svg>
  )
}