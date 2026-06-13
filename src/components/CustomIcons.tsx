export function TocIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="10" x2="20" y2="10" />
      <line x1="8" y1="14" x2="20" y2="14" />
      <line x1="4" y1="18" x2="16" y2="18" />
    </svg>
  )
}

export function DocListIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 20 L2 4 L3 4 L6 6 L18 6 L18 10 L22 10 L22 20 Z" />
      <path d="M6 3 L6 12 L16 12 L16 5 L14 3 Z" />
      <rect x="8" y="5" width="2" height="2" fill="white" />
      <rect x="8" y="8" width="2" height="2" fill="white" />
      <rect x="8" y="11" width="2" height="2" fill="white" />
      <rect x="11" y="5.5" width="4" height="0.8" fill="white" />
      <rect x="11" y="8.5" width="4" height="0.8" fill="white" />
      <rect x="11" y="11.5" width="4" height="0.8" fill="white" />
    </svg>
  )
}

export function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
      <circle cx="17" cy="6" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="7" cy="18" r="0.8" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

export function MoonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" opacity="0.5" />
      <circle cx="19" cy="10" r="0.6" fill="currentColor" opacity="0.4" />
      <circle cx="15" cy="4" r="0.5" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

export function AiChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Sleek chat bubble with rounder edges */}
      <path d="M12 21a9 9 0 0 1-9-9c0-5 4-9 9-9s9 4 9 9a9 9 0 0 1-2.5 6l.5 3.5-3.5-.5A8.96 8.96 0 0 1 12 21z" />
      {/* 4-pointed clean AI spark in the center */}
      <path d="M12 8.5c0 1.1-.4 1.5-1.5 1.5 1.1 0 1.5.4 1.5 1.5 0-1.1.4-1.5 1.5-1.5-1.1 0-1.5-.4-1.5-1.5z" opacity="0.95" strokeWidth="1.8" />
      <path d="M16 11c0 .7-.3 1-1 1 .7 0 1 .3 1 1 0-.7.3-1 1-1-.7 0-1-.3-1-1z" opacity="0.8" strokeWidth="1.5" />
    </svg>
  )
}
