// VS Code Material Icon Theme-style file icons

interface Props { name: string; isDir?: boolean; isOpen?: boolean; size?: number }

// ─── Language SVG icons ───────────────────────────────────────────────────────

const S = (props: { size: number; children: React.ReactNode; viewBox?: string }) => (
  <svg width={props.size} height={props.size} viewBox={props.viewBox ?? '0 0 32 32'}
    fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
    {props.children}
  </svg>
)

// JavaScript — yellow square with "JS"
const IconJS = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f0db4f"/>
    <path d="M8 24.5c.6.9 1.4 1.6 2.9 1.6 1.4 0 2.3-.7 2.3-1.7 0-1.1-.8-1.5-2.3-2.2l-.8-.3c-2.3-.9-3.7-2.1-3.7-4.5 0-2.2 1.7-3.9 4.3-3.9 1.9 0 3.2.6 4.1 2.2l-2.2 1.4c-.5-.9-1-1.2-1.9-1.2-.8 0-1.4.5-1.4 1.2 0 .8.5 1.2 1.7 1.7l.8.3c2.7 1.1 4.1 2.3 4.1 4.8 0 2.7-2.1 4.1-5 4.1-2.8 0-4.5-1.3-5.4-3.1L8 24.5z" fill="#323330"/>
    <path d="M19.5 24.2c.4.8 1 1.4 2 1.4.9 0 1.5-.5 1.5-1.2V14h2.8v10.5c0 2.8-1.6 4.1-4 4.1-2.1 0-3.4-1.1-4-2.6l1.7-1.8z" fill="#323330"/>
  </S>
)

// TypeScript — blue square with "TS"
const IconTS = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#3178c6"/>
    <path d="M18.2 19v1.8c.4.2.8.3 1.3.4.5.1 1 .1 1.5.1.5 0 1-.1 1.4-.2.5-.1.9-.3 1.2-.6.3-.2.6-.5.8-.9.2-.4.3-.8.3-1.3 0-.4-.1-.7-.2-1-.1-.3-.3-.5-.5-.8-.2-.2-.5-.4-.8-.6-.3-.2-.7-.3-1.1-.5-.3-.1-.5-.2-.7-.3-.2-.1-.4-.2-.5-.3-.1-.1-.2-.2-.3-.4-.1-.1-.1-.3-.1-.4 0-.2 0-.3.1-.4.1-.1.2-.2.3-.3.1-.1.3-.1.5-.2.2 0 .4-.1.6-.1.2 0 .4 0 .6.1.2 0 .4.1.6.2.2.1.4.2.5.3.2.1.3.2.4.4V14c-.3-.2-.7-.3-1.1-.4-.4-.1-.9-.1-1.4-.1-.5 0-1 .1-1.4.2-.5.1-.9.3-1.2.6-.3.2-.6.5-.8.9-.2.4-.3.8-.3 1.3 0 .7.2 1.2.5 1.7.4.5.9.9 1.7 1.2.3.1.6.2.8.3.3.1.5.2.7.4.2.1.3.3.4.4.1.2.1.3.1.5 0 .1 0 .3-.1.4 0 .1-.1.2-.3.3-.1.1-.3.2-.5.2-.2.1-.4.1-.7.1-.5 0-.9-.1-1.4-.3-.5-.2-.9-.4-1.2-.8z" fill="white"/>
    <path d="M8 13h10v2.2h-3.6V26H12V15.2H8V13z" fill="white"/>
  </S>
)

// Python — blue/yellow
const IconPY = ({ size }: { size: number }) => (
  <S size={size}>
    <defs>
      <linearGradient id="pyblue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#387eb8"/>
        <stop offset="100%" stopColor="#366994"/>
      </linearGradient>
      <linearGradient id="pyyellow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffe873"/>
        <stop offset="100%" stopColor="#ffca28"/>
      </linearGradient>
    </defs>
    <path d="M16 2C9.4 2 9.8 4.9 9.8 4.9l0.1 2h6.2v0.7H7.9S4 7.1 4 13.8s3.4 6.5 3.4 6.5h2v-3.1s-.1-3.4 3.3-3.4h5.7s3.2.1 3.2-3V5.7S22.1 2 16 2zm-3.2 1.9c.6 0 1 .5 1 1 0 .6-.5 1-1 1-.6 0-1-.5-1-1 0-.6.4-1 1-1z" fill="url(#pyblue)"/>
    <path d="M16.1 30c6.6 0 6.2-2.9 6.2-2.9l-.1-2h-6.2v-.7h8.2s3.9.4 3.9-6.3-3.4-6.5-3.4-6.5h-2v3.1s.1 3.4-3.3 3.4h-5.7s-3.2-.1-3.2 3v5.1s-.5 3.8 5.6 3.8zm3.1-1.9c-.6 0-1-.5-1-1 0-.6.5-1 1-1 .6 0 1 .5 1 1 0 .5-.4 1-1 1z" fill="url(#pyyellow)"/>
  </S>
)

// HTML — orange badge
const IconHTML = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#e44d26"/>
    <path d="M6 4l2.2 24.8L16 31l7.8-2.2L26 4H6zm17 4.8l-.3 3.4H13v3.2h9.4l-1 11-5.4 1.5-5.4-1.5-.4-4.2h3.2l.2 2.4 2.4.7 2.4-.7.2-3H10.8l-.8-9h12.4l-.2-2.8H9.5L9 6.4h14l-.3 2.4z" fill="white"/>
  </S>
)

// CSS — blue badge
const IconCSS = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#264de4"/>
    <path d="M6 4l2.2 24.8L16 31l7.8-2.2L26 4H6zm17.2 5.4-.4 4H13.6v3.2h8.8l-1.2 12.1-5.2 1.4-5.2-1.4-.4-3.8h3.2l.2 1.8 2.2.6 2.2-.6.3-3.4H10.2l-.8-9h13.2l-.2-3H9.6L9 6.4h14l.2 3z" fill="white"/>
  </S>
)

// React / JSX / TSX
const IconReact = ({ size, ts }: { size: number; ts?: boolean }) => (
  <S size={size}>
    <circle cx="16" cy="16" r="3" fill={ts ? '#61dafb' : '#61dafb'}/>
    <ellipse cx="16" cy="16" rx="14" ry="5.5" stroke={ts ? '#61dafb' : '#61dafb'} strokeWidth="1.5"/>
    <ellipse cx="16" cy="16" rx="14" ry="5.5" stroke={ts ? '#61dafb' : '#61dafb'} strokeWidth="1.5" transform="rotate(60 16 16)"/>
    <ellipse cx="16" cy="16" rx="14" ry="5.5" stroke={ts ? '#61dafb' : '#61dafb'} strokeWidth="1.5" transform="rotate(120 16 16)"/>
    {ts && <rect x="20" y="18" width="10" height="10" rx="2" fill="#3178c6"/>}
    {ts && <text x="23.5" y="26" fontSize="7" fontWeight="bold" fill="white" fontFamily="monospace">TS</text>}
  </S>
)

// JSON — yellow curly braces
const IconJSON = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#cbcb41"/>
    <path d="M10 6c-1.5 0-2.5 1-2.5 2.5v4c0 1.2-.8 2-2 2v3c1.2 0 2 .8 2 2v4c0 1.5 1 2.5 2.5 2.5h2v-2.5H11c-.4 0-.5-.2-.5-.5v-4.5c0-1.2-.5-2-1.5-2.5 1-.5 1.5-1.3 1.5-2.5V8.5c0-.3.1-.5.5-.5h1V6H10zm12 0h-2v2.5h1c.4 0 .5.2.5.5v4.5c0 1.2.5 2 1.5 2.5-1 .5-1.5 1.3-1.5 2.5v4.5c0 .3-.1.5-.5.5h-1V26h2c1.5 0 2.5-1 2.5-2.5v-4c0-1.2.8-2 2-2v-3c-1.2 0-2-.8-2-2v-4C24.5 7 23.5 6 22 6z" fill="white"/>
  </S>
)

// Markdown — blue M↓
const IconMD = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#42a5f5"/>
    <path d="M4 10h3v12H4V10zm4 12l4-6 4 6V10h3v12h-3l-4-6-4 6H8zm16-8v8h-3l3.5-4H21V10h3v4h1.5L29 18h-5z" fill="white"/>
  </S>
)

// Shell / Bash — green terminal
const IconSH = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#4caf50"/>
    <path d="M5 8h22v16H5V8zm2 2v12h18V10H7zm2 9l4-4-4-4 1.4-1.4 5.4 5.4-5.4 5.4L9 19z" fill="white"/>
    <rect x="16" y="18" width="6" height="1.5" rx=".75" fill="white"/>
  </S>
)

// Vue — green V
const IconVue = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#41b883"/>
    <path d="M16 6L6 22h4l6-10 6 10h4L16 6z" fill="white"/>
    <path d="M16 11l-4 7h2.5l1.5-2.6L17.5 18H20l-4-7z" fill="#41b883"/>
  </S>
)

// Go — cyan gopher
const IconGo = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#00acd7"/>
    <text x="3" y="22" fontSize="18" fontWeight="bold" fill="white" fontFamily="monospace">Go</text>
  </S>
)

// Rust — orange
const IconRust = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#b7410e"/>
    <text x="5" y="23" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">Rs</text>
  </S>
)

// Java — red/blue
const IconJava = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#ea2d2e"/>
    <path d="M12.7 20.3s-1 .6.7.8c2.2.3 3.3.2 5.7-.2 0 0 .6.4 1.5.7-5.5 2.3-12.4-.1-7.9-1.3zm-.6-2.7s-1.2.9.6 1.1c2.3.3 4.1.3 7.3-.4 0 0 .4.4 1.1.7-6.4 1.9-13.5.1-9-1.4z" fill="white"/>
    <path d="M17.3 13.2c1.3 1.5-.3 2.9-.3 2.9s3.3-1.7 1.8-3.8c-1.4-2-2.5-2.9 3.4-6.3 0 0-9.2 2.3-4.9 7.2z" fill="white"/>
    <path d="M23.8 22.3s.7.6-.8 1.1c-3 .9-12.4 1.2-15 0-1-.4.8-1 1.3-1.1.5-.1.9-.1.9-.1-1-1.4-6.7 1.4-2.9 2.1 10.4 1.7 19-1 15.5-2z" fill="white"/>
  </S>
)

// PHP
const IconPHP = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#777bb4"/>
    <text x="3" y="22" fontSize="14" fontWeight="bold" fill="white" fontFamily="monospace">PHP</text>
  </S>
)

// C/C++
const IconC = ({ size, cpp }: { size: number; cpp?: boolean }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill={cpp ? '#659ad2' : '#00599c'}/>
    <text x={cpp ? "2" : "5"} y="22" fontSize={cpp ? "13" : "18"} fontWeight="bold" fill="white" fontFamily="monospace">
      {cpp ? 'C++' : 'C'}
    </text>
  </S>
)

// C#
const IconCS = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#9b4f96"/>
    <text x="4" y="22" fontSize="14" fontWeight="bold" fill="white" fontFamily="monospace">C#</text>
  </S>
)

// Kotlin
const IconKT = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#7f52ff"/>
    <text x="4" y="22" fontSize="14" fontWeight="bold" fill="white" fontFamily="monospace">Kt</text>
  </S>
)

// Ruby
const IconRB = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#cc342d"/>
    <text x="3" y="23" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">Rb</text>
  </S>
)

// Swift
const IconSwift = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f05138"/>
    <path d="M23.4 20.8c.1-.1.2-.2.2-.3 2.2-2.9 1.9-6.8-.1-9.5-.5-.7-1.2-1.4-2-2.1l-.1-.1c0 0-.3-.2-.3-.1v.1c.1.7.1 1.5-.1 2.2-.4 1.8-1.5 3.3-2.9 4.5L17 16.5l-.1.1c-1.6 1-3.5 1.5-5.4 1.3-1.1-.1-2.2-.5-3.2-1.2l-.1-.1.1.1c1.2 1.3 2.7 2.4 4.4 3 1.3.5 2.8.7 4.2.4 0 0-2.4 1.6-5 1.5-1.1 0-2.1-.2-3-.7.9.8 1.9 1.5 3 2 1.7.8 3.6.9 5.4.5 1.9-.4 3.5-1.5 4.6-2.9.2-.2.3-.5.5-.7z" fill="white"/>
  </S>
)

// Dart
const IconDart = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#0175c2"/>
    <text x="4" y="23" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">Dt</text>
  </S>
)

// SQL / Database
const IconSQL = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#336791"/>
    <ellipse cx="16" cy="10" rx="10" ry="4" fill="#89b4fa"/>
    <path d="M6 10v4c0 2.2 4.5 4 10 4s10-1.8 10-4v-4c0 2.2-4.5 4-10 4S6 12.2 6 10z" fill="#74a7d4"/>
    <path d="M6 18v4c0 2.2 4.5 4 10 4s10-1.8 10-4v-4c0 2.2-4.5 4-10 4S6 20.2 6 18z" fill="#5c8fbe"/>
    <path d="M6 14v4c0 2.2 4.5 4 10 4s10-1.8 10-4v-4c0 2.2-4.5 4-10 4S6 16.2 6 14z" fill="#6da0ce"/>
  </S>
)

// YAML
const IconYAML = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#cc1018"/>
    <text x="2" y="22" fontSize="11" fontWeight="bold" fill="white" fontFamily="monospace">YAML</text>
  </S>
)

// Dockerfile
const IconDocker = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#0db7ed"/>
    <rect x="4" y="15" width="6" height="5" rx="1" fill="white"/>
    <rect x="12" y="15" width="6" height="5" rx="1" fill="white"/>
    <rect x="20" y="15" width="6" height="5" rx="1" fill="white"/>
    <rect x="12" y="8" width="6" height="5" rx="1" fill="white"/>
    <path d="M26 17c1-1 2.5-1 3 0s.5 2-.5 3c-1 1-5 2-5 2s-3-3-.5-5z" fill="white"/>
    <path d="M4 20h24v2H4z" fill="#0db7ed" opacity=".4"/>
  </S>
)

// Git
const IconGit = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f05033"/>
    <path d="M29.5 14.5L17.5 2.5a1.7 1.7 0 00-2.4 0l-2.4 2.4 3 3a2 2 0 012.5 2.5l2.9 2.9a2 2 0 11-1.2 1.2l-2.7-2.7v7a2 2 0 11-1.6 0v-7a2 2 0 01-1.1-2.6L11.6 7l-9 9a1.7 1.7 0 000 2.4l12 12a1.7 1.7 0 002.4 0l12.5-12.5a1.7 1.7 0 000-2.4z" fill="white"/>
  </S>
)

// Image files
const IconImg = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#cba6f7"/>
    <rect x="4" y="6" width="24" height="20" rx="2" fill="white" opacity=".2"/>
    <rect x="4" y="6" width="24" height="20" rx="2" stroke="white" strokeWidth="1.5"/>
    <circle cx="11" cy="13" r="2.5" fill="white"/>
    <path d="M4 22l7-7 5 5 3-3 9 9H4z" fill="white"/>
  </S>
)

// SVG file
const IconSVG = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f5c2e7"/>
    <circle cx="16" cy="16" r="8" stroke="#313244" strokeWidth="2" fill="none"/>
    <path d="M10 16 Q16 8 22 16 Q16 24 10 16" fill="#313244"/>
  </S>
)

// PDF
const IconPDF = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f38ba8"/>
    <text x="2" y="22" fontSize="12" fontWeight="bold" fill="white" fontFamily="monospace">PDF</text>
  </S>
)

// Env / config
const IconEnv = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#f9e2af"/>
    <text x="2" y="22" fontSize="11" fontWeight="bold" fill="#313244" fontFamily="monospace">.ENV</text>
  </S>
)

// Generic text
const IconTxt = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#585b70"/>
    <rect x="7" y="9" width="18" height="1.5" rx=".75" fill="white"/>
    <rect x="7" y="13" width="18" height="1.5" rx=".75" fill="white"/>
    <rect x="7" y="17" width="14" height="1.5" rx=".75" fill="white"/>
    <rect x="7" y="21" width="10" height="1.5" rx=".75" fill="white"/>
  </S>
)

// Lock file
const IconLock = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#45475a"/>
    <rect x="10" y="16" width="12" height="10" rx="2" fill="#a6adc8"/>
    <path d="M12 16v-3a4 4 0 018 0v3" stroke="#a6adc8" strokeWidth="2" fill="none"/>
    <circle cx="16" cy="21" r="2" fill="#45475a"/>
  </S>
)

// Package.json special
const IconPackage = ({ size }: { size: number }) => (
  <S size={size}>
    <rect width="32" height="32" rx="3" fill="#cb3837"/>
    <rect x="5" y="12" width="22" height="14" rx="2" fill="white"/>
    <rect x="13" y="8" width="6" height="6" rx="1" fill="white"/>
    <text x="8" y="23" fontSize="8" fontWeight="bold" fill="#cb3837" fontFamily="monospace">npm</text>
  </S>
)

// Folder icons
const IconFolder = ({ size, color, open }: { size: number; color: string; open?: boolean }) => (
  <S size={size}>
    {open ? (
      <>
        <path d="M2 10c0-1.1.9-2 2-2h10l2 3h14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V10z" fill={color}/>
        <path d="M2 14h28v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V14z" fill={color} opacity=".7"/>
      </>
    ) : (
      <>
        <path d="M2 10c0-1.1.9-2 2-2h10l2 3h14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V10z" fill={color}/>
        <path d="M2 14h28v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8z" fill={color} opacity=".8"/>
      </>
    )}
  </S>
)

// Generic file
const IconFile = ({ size }: { size: number }) => (
  <S size={size}>
    <path d="M6 4h14l6 6v18c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="#585b70"/>
    <path d="M20 4l6 6h-6V4z" fill="#45475a"/>
  </S>
)

// ─── Extension → icon map ─────────────────────────────────────────────────────

const DIR_COLORS: Record<string, string> = {
  src: '#89b4fa', components: '#cba6f7', pages: '#f9e2af',
  api: '#a6e3a1', styles: '#f5c2e7', utils: '#94e2d5',
  lib: '#fab387', hooks: '#f9e2af', store: '#cba6f7',
  tests: '#f38ba8', test: '#f38ba8', '__tests__': '#f38ba8',
  public: '#a6e3a1', assets: '#cba6f7', images: '#cba6f7',
  node_modules: '#45475a', '.git': '#45475a', dist: '#45475a',
  build: '#45475a', out: '#45475a', release: '#45475a',
}

export function FileIcon({ name, isDir, isOpen, size = 16 }: Props) {
  if (isDir) {
    const lower = name.toLowerCase()
    const color = DIR_COLORS[lower] ?? '#89b4fa'
    return <IconFolder size={size} color={color} open={isOpen} />
  }

  const lower = name.toLowerCase()
  const ext   = lower.split('.').pop() ?? ''

  // Full filename matches
  if (lower === 'package.json' || lower === 'package-lock.json') return <IconPackage size={size} />
  if (lower === '.gitignore' || lower === '.gitattributes') return <IconGit size={size} />
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return <IconDocker size={size} />
  if (lower === 'cargo.toml') return <IconRust size={size} />
  if (lower === 'go.mod' || lower === 'go.sum') return <IconGo size={size} />

  switch (ext) {
    case 'js':    return <IconJS size={size} />
    case 'jsx':   return <IconReact size={size} />
    case 'ts':    return <IconTS size={size} />
    case 'tsx':   return <IconReact size={size} ts />
    case 'mjs':
    case 'cjs':   return <IconJS size={size} />
    case 'py':
    case 'pyw':   return <IconPY size={size} />
    case 'html':
    case 'htm':   return <IconHTML size={size} />
    case 'css':   return <IconCSS size={size} />
    case 'scss':
    case 'sass':  return <S size={size}><rect width="32" height="32" rx="3" fill="#cc6699"/><text x="2" y="22" fontSize="12" fontWeight="bold" fill="white" fontFamily="monospace">Scss</text></S>
    case 'less':  return <S size={size}><rect width="32" height="32" rx="3" fill="#1d365d"/><text x="2" y="22" fontSize="13" fontWeight="bold" fill="white" fontFamily="monospace">Less</text></S>
    case 'vue':   return <IconVue size={size} />
    case 'svelte':return <S size={size}><rect width="32" height="32" rx="3" fill="#ff3e00"/><text x="4" y="22" fontSize="13" fontWeight="bold" fill="white" fontFamily="monospace">Sv</text></S>
    case 'json':
    case 'jsonc': return <IconJSON size={size} />
    case 'yaml':
    case 'yml':   return <IconYAML size={size} />
    case 'toml':  return <S size={size}><rect width="32" height="32" rx="3" fill="#9b4f96"/><text x="2" y="22" fontSize="10" fontWeight="bold" fill="white" fontFamily="monospace">TOML</text></S>
    case 'xml':   return <S size={size}><rect width="32" height="32" rx="3" fill="#f9e2af"/><text x="5" y="22" fontSize="11" fontWeight="bold" fill="#313244" fontFamily="monospace">XML</text></S>
    case 'md':
    case 'mdx':   return <IconMD size={size} />
    case 'txt':   return <IconTxt size={size} />
    case 'pdf':   return <IconPDF size={size} />
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':  return <IconSH size={size} />
    case 'ps1':   return <S size={size}><rect width="32" height="32" rx="3" fill="#5391fe"/><text x="3" y="22" fontSize="11" fontWeight="bold" fill="white" fontFamily="monospace">PS1</text></S>
    case 'env':   return <IconEnv size={size} />
    case 'go':    return <IconGo size={size} />
    case 'rs':    return <IconRust size={size} />
    case 'c':     return <IconC size={size} />
    case 'cpp':
    case 'cc':
    case 'cxx':   return <IconC size={size} cpp />
    case 'h':
    case 'hpp':   return <S size={size}><rect width="32" height="32" rx="3" fill="#00599c"/><text x="7" y="22" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">H</text></S>
    case 'cs':    return <IconCS size={size} />
    case 'java':  return <IconJava size={size} />
    case 'kt':
    case 'kts':   return <IconKT size={size} />
    case 'rb':    return <IconRB size={size} />
    case 'php':   return <IconPHP size={size} />
    case 'swift': return <IconSwift size={size} />
    case 'dart':  return <IconDart size={size} />
    case 'lua':   return <S size={size}><rect width="32" height="32" rx="3" fill="#000080"/><text x="2" y="23" fontSize="14" fontWeight="bold" fill="white" fontFamily="monospace">Lua</text></S>
    case 'r':     return <S size={size}><rect width="32" height="32" rx="3" fill="#276dc3"/><text x="8" y="23" fontSize="18" fontWeight="bold" fill="white" fontFamily="monospace">R</text></S>
    case 'sql':
    case 'db':
    case 'sqlite':return <IconSQL size={size} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'ico':   return <IconImg size={size} />
    case 'svg':   return <IconSVG size={size} />
    case 'lock':  return <IconLock size={size} />
    case 'dockerfile': return <IconDocker size={size} />
    case 'gitignore':  return <IconGit size={size} />
    default:      return <IconFile size={size} />
  }
}
