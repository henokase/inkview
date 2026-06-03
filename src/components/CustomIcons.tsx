export function TocIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="7.5" cy="8" r="1.5" fill="currentColor" />
      <line x1="11" y1="8" x2="19" y2="8" />
      <circle cx="9.5" cy="13" r="1" fill="currentColor" />
      <line x1="13" y1="13" x2="19" y2="13" />
      <circle cx="9.5" cy="18" r="1" fill="currentColor" />
      <line x1="13" y1="18" x2="19" y2="18" />
    </svg>
  )
}

export function DocListIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
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
