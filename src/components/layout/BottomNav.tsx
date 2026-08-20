import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, getActiveNavItem } from './navItems'
import './BottomNav.css'

export function BottomNav() {
  const location = useLocation()
  const activeItem = getActiveNavItem(location.pathname)

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
