import kitsuneImg from '../../assets/iconkitsune.png'

interface Props {
  size?: number
  className?: string
}

export function KitsuneLogo({ size = 24, className = '' }: Props) {
  return (
    <img
      src={kitsuneImg}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}
