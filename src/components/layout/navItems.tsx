import { ReactNode } from 'react'

/**
 * Calendar-with-today's-dot mark for Dziś.
 *
 * Deliberately not a sun: the theme toggle renders a sun in dark mode, and two
 * near-identical glyphs in the same chrome made this entry effectively
 * invisible — which is exactly how it was first reported.
 */
export function todayIcon(active = false) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <circle cx="12" cy="15.5" r="2" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

export const NAV_ITEMS = [
  {
    // First position, ahead of the library: this is the answer to "what do I do
    // today", which is the question the method is built around.
    path: '/dzis',
    label: 'Dzisiaj',
    icon: (active: boolean): ReactNode => todayIcon(active),
  },
  {
    path: '/',
    label: 'Pakiety',
    icon: (active: boolean): ReactNode => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        {active && <line x1="12" y1="12" x2="12" y2="17"/>}
        {active && <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>}
      </svg>
    ),
  },
  {
    path: '/trening',
    label: 'Trening',
    icon: (active: boolean): ReactNode => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
        {active && <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none"/>}
      </svg>
    ),
  },
  {
    path: '/postęp',
    label: 'Postęp',
    icon: (active: boolean): ReactNode => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        {active && <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>}
      </svg>
    ),
  },
  {
    path: '/ustawienia',
    label: 'Personalizacja',
    icon: (active: boolean): ReactNode => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        {active && <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>}
      </svg>
    ),
  },
]

export function getActiveNavItem(pathname: string): string {
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    path = pathname
  }
  if (path === '/') return '/'
  if (path === '/dzis') return '/dzis'
  // The review session runs from Dziś, so keep that tab lit while it's open
  // rather than falling through to the '/' default and highlighting Pakiety.
  if (path === '/powtorka') return '/dzis'
  if (path === '/trening' || path.startsWith('/trening/')) return '/trening'
  if (path === '/postęp' || path.startsWith('/postęp/')) return '/postęp'
  if (path === '/ustawienia' || path.startsWith('/ustawienia/')) return '/ustawienia'
  if (path.startsWith('/pakiet')) return '/'
  return '/'
}
