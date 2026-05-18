interface Props {
  size?: number
  className?: string
}

/**
 * Momiji IDE logo — inline SVG maple leaf, no external file needed.
 * Works crisp at any size from 12px to 200px+.
 */
export function MomijiLogo({ size = 24, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="mg" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#fb923c" />
          <stop offset="55%"  stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>

      {/* Maple leaf */}
      <path
        d="M50,3 C48,7 44,10 40,13 C35,8 26,10 22,16
           C26,18 28,21 27,25 C20,22 11,24 7,32
           C13,31 17,30 20,33 C14,40 13,49 16,57
           C21,52 27,50 31,52 L30,70 L36,66 L37,80
           L44,76 L44,88 L50,90 L56,88 L56,76
           L63,80 L64,66 L70,70 L69,52
           C73,50 79,52 84,57 C87,49 86,40 80,33
           C83,30 87,31 93,32 C89,24 80,22 73,25
           C72,21 74,18 78,16 C74,10 65,8 60,13
           C56,10 52,7 50,3 Z"
        fill="url(#mg)"
      />

      {/* Stem */}
      <rect x="47" y="88" width="6" height="16" rx="3" fill="#ea580c" />
    </svg>
  )
}
