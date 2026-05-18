import logoImg from '../../assets/logo-momiji.png'
import { useAppStore } from '../../store/appStore'

interface Props {
  size?: number
  className?: string
  /** Force a specific variant regardless of theme */
  variant?: 'auto' | 'light' | 'dark'
}

export function MomijiLogo({ size = 24, className = '', variant = 'auto' }: Props) {
  const theme = useAppStore(s => s.settings.theme)
  const isDark = variant === 'auto' ? theme === 'dark' : variant === 'dark'

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Dark mode: subtle dark rounded bg so the orange logo pops
        ...(isDark ? {
          background: 'rgba(0,0,0,0.35)',
          borderRadius: Math.max(4, size * 0.2),
          padding: size * 0.08,
        } : {}),
      }}
    >
      <img
        src={logoImg}
        width={isDark ? size * 0.84 : size}
        height={isDark ? size * 0.84 : size}
        draggable={false}
        style={{ objectFit: 'contain', display: 'block' }}
        alt="Momiji IDE"
      />
    </div>
  )
}
