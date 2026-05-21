import { useState, Suspense } from 'react'
import { ColorPaletteStudio } from './ColorPaletteStudio'
import { EasingVisualizer }   from './EasingVisualizer'
import { ShaderPlayground }   from './ShaderPlayground'
import { SpriteSheetSlicer }  from './SpriteSheetSlicer'
import { CanvasPlayground }   from './CanvasPlayground'

interface Props { onClose: () => void }

const TABS = [
  { id: 'canvas',   icon: '🎨', label: 'Canvas'   },
  { id: 'palette',  icon: '🖌️', label: 'Colors'   },
  { id: 'easing',   icon: '📐', label: 'Easing'   },
  { id: 'shader',   icon: '✨', label: 'Shader'   },
  { id: 'sprite',   icon: '🖼️', label: 'Sprite'   },
] as const

type TabId = typeof TABS[number]['id']

function PanelLoader() {
  return (
    <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--text-subtle)' }}>
      <div className="w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent-mauve)', borderTopColor: 'transparent' }} />
      <span className="text-xs">Loading…</span>
    </div>
  )
}

export function CreativeHub({ onClose }: Props) {
  const [tab, setTab] = useState<TabId>('canvas')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0"
        style={{ background: 'var(--bg-crust)', borderBottom: '1px solid var(--border)', height: 44 }}>
        <span className="px-4 text-sm font-black tracking-wider" style={{ color: 'var(--accent-mauve)' }}>
          🎨 Creative Studio
        </span>
        <div className="flex items-stretch h-full">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 text-xs font-semibold transition-colors"
              style={{
                background: tab === t.id ? 'var(--bg-base)' : 'transparent',
                color: tab === t.id ? 'var(--accent-mauve)' : 'var(--text-subtle)',
                border: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? '2px solid var(--accent-mauve)' : '2px solid transparent',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-sm mr-1"
          style={{ color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
          ✕
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PanelLoader />}>
          {tab === 'canvas'  && <CanvasPlayground onClose={onClose} embedded />}
          {tab === 'palette' && <ColorPaletteStudio />}
          {tab === 'easing'  && <EasingVisualizer />}
          {tab === 'shader'  && <ShaderPlayground />}
          {tab === 'sprite'  && <SpriteSheetSlicer />}
        </Suspense>
      </div>
    </div>
  )
}
