import { useLocation, useNavigate } from 'react-router-dom'
import './BottomNav.css'

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Pakiety',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    path: '/statystyki',
    label: 'Statystyki',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinejoin="round" strokeLinecap="round"/>
        {active && <circle cx="12" cy="12" r="1" fill="currentColor"/>}
      </svg>
    ),
  },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottomnav">
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            className={`bottomnav__item ${active ? 'bottomnav__item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon(active)}
            <span className="bottomnav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
