import parallaxImg from '../../assets/logo-parallax.png'

interface Props {
  size?: number
  className?: string
}

export function ParallaxLogo({ size = 24, className = '' }: Props) {
  return (
    <img
      src={parallaxImg}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}
