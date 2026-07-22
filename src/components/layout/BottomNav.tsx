import { Link, useLocation } from 'react-router-dom'
import './BottomNav.css'

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Pakiety',
    icon: (active: boolean) => (
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
    icon: (active: boolean) => (
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
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        {active && <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>}
      </svg>
    ),
  },
  {
    path: '/ustawienia',
    label: 'Personalizacja',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        {active && <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>}
      </svg>
    ),
  },
]

export function BottomNav() {
  const location = useLocation()

  const getActiveItem = () => {
    let path: string
    try {
      path = decodeURIComponent(location.pathname)
    } catch {
      path = location.pathname
    }
    if (path === '/') return '/'
    if (path === '/trening' || path.startsWith('/trening/')) return '/trening'
    if (path === '/postęp' || path.startsWith('/postęp/')) return '/postęp'
    if (path === '/ustawienia' || path.startsWith('/ustawienia/')) return '/ustawienia'
    if (path.startsWith('/pakiet')) return '/'
    return '/'
  }

  const activeItem = getActiveItem()

  return (
    <nav className="bottomnav">
      {NAV_ITEMS.map(item => {
        const active = activeItem === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            viewTransition
            className={`bottomnav__item ${active ? 'bottomnav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottomnav__icon-wrap">
              {item.icon(active)}
              {active && <span className="bottomnav__dot" aria-hidden="true"/>}
            </span>
            <span className="bottomnav__label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
