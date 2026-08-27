import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, getActiveNavItem } from './navItems'
import { NavIndicator } from './NavIndicator'
import './BottomNav.css'

/**
 * Rendered once per page (each page mounts its own AppShell), so it must NOT
 * have a mount transition — an `initial`/`animate` slide would replay on every
 * single navigation. The bar just stays put; only the active-tab indicator
 * moves.
 */
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
            {active && <NavIndicator layoutId="bottomnav-active-indicator" className="bottomnav__indicator" />}
            <span className="bottomnav__icon-wrap">
              {item.icon(active)}
            </span>
            <span className="bottomnav__label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
