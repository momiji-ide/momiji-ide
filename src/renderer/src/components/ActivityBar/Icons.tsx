// Minimalist SVG icon set — 24×24, 1.5px stroke, currentColor
// Style: Lucide / VS Code Codicons inspired

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

interface P { size?: number }

export const IcoExplorer = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <path d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L10.414 6.5A1 1 0 0111.121 6.793h9.879A2 2 0 0123 9v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
)

export const IcoSearch = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

export const IcoScaffold = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
    <path d="M17 13v8M13 17h8" />
  </svg>
)

export const IcoTemplates = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <rect x="3" y="3" width="7" height="5" rx="1" />
    <rect x="3" y="11" width="7" height="10" rx="1" />
    <rect x="13" y="3" width="8" height="10" rx="1" />
    <rect x="13" y="16" width="8" height="5" rx="1" />
  </svg>
)

export const IcoPackages = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

export const IcoHttp = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18" />
  </svg>
)

export const IcoBlocks = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="5" rx="1" />
    <rect x="3" y="14" width="8" height="7" rx="1" />
    <rect x="13" y="11" width="8" height="10" rx="1" />
  </svg>
)

export const IcoFlow = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="19" cy="5" r="2.5" />
    <circle cx="19" cy="19" r="2.5" />
    <path d="M7.5 12l9-5.5M7.5 12l9 5.5" />
  </svg>
)

export const IcoDebug = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
    <line x1="3" y1="4" x2="6" y2="7" />
    <line x1="21" y1="4" x2="18" y2="7" />
  </svg>
)

export const IcoGit = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <line x1="6" y1="8.5" x2="6" y2="15.5" />
    <path d="M18 8.5a7 7 0 01-7 7H6" />
  </svg>
)

export const IcoSnippets = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

export const IcoAI = ({ size = 20 }: P) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="currentColor"
    stroke="none"
  >
    {/* Fox face / Kitsune */}
    <path d="M16 3C9.5 3 5 8 5 13.5c0 4.5 2.8 7.5 5.5 9L10 26l6-2 6 2-.5-3.5C24.2 21 27 18 27 13.5 27 8 22.5 3 16 3z" />
    {/* Left ear */}
    <path d="M5 3 C3.5 1 1.5 2 1 4 C2 7 5 9 7 9.5 C6.5 7 5.5 5 5 3z"
      style={{ fill: 'currentColor', opacity: 0.7 }} />
    {/* Right ear */}
    <path d="M27 3 C28.5 1 30.5 2 31 4 C30 7 27 9 25 9.5 C25.5 7 26.5 5 27 3z"
      style={{ fill: 'currentColor', opacity: 0.7 }} />
    {/* Eyes */}
    <circle cx="12" cy="14" r="1.8" fill="var(--bg-crust, #11111b)" />
    <circle cx="20" cy="14" r="1.8" fill="var(--bg-crust, #11111b)" />
    {/* Nose / smile */}
    <path d="M14 18.5 Q16 20.5 18 18.5" stroke="var(--bg-crust, #11111b)" strokeWidth="1.2"
      fill="none" strokeLinecap="round" />
  </svg>
)

export const IcoDatabase = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
  </svg>
)

export const IcoExtensions = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <path d="M14.5 3.5a2 2 0 10-4 0c0 .28.06.54.17.78L8 6H5a2 2 0 00-2 2v3l1.72 1.72c.24.11.5.17.78.17a2 2 0 100-4c-.28 0-.54.06-.78.17L3 10.78V13a2 2 0 002 2h3l2.22-1.22c.24.11.5.17.78.17a2 2 0 10-2-2c0 .28.06.54.17.78L8 13.5" />
    <path d="M10.5 3.5H8a2 2 0 00-2 2v.5M21 8a2 2 0 00-2-2h-3l-1.78 1.78c-.11.24-.17.5-.17.78a2 2 0 102 2c-.28 0-.54-.06-.78-.17L14 9.5V13a2 2 0 01-2 2" />
  </svg>
)

export const IcoSettings = ({ size = 20 }: P) => (
  <svg {...base} width={size} height={size}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
)

export function IcoTodo({ size = 20 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

export function IcoOutline({ size = 20 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="6" y1="10" x2="21" y2="10" />
      <line x1="6" y1="14" x2="21" y2="14" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
