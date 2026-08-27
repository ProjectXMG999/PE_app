import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { NAV_ITEMS, getActiveNavItem } from './navItems'
import { NavIndicator } from './NavIndicator'
import { EASE_OUT_EXPO } from '../today/motion'
import './BottomNav.css'

/**
 * Mounted/unmounted by AppShell's `hideBottomNav` (via AnimatePresence), not
 * just shown/hidden with CSS — pages like PackPreviewPage replace this bar
 * with their own fixed action buttons in the exact same screen region, and
 * the two need to visually hand off rather than one abruptly popping under
 * the other.
 */
export function BottomNav() {
  const location = useLocation()
  const activeItem = getActiveNavItem(location.pathname)
  const reduced = useReducedMotion()

  return (
    <motion.nav
      className="bottomnav"
      initial={{ y: '120%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '120%', opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.32, ease: EASE_OUT_EXPO }}
    >
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
    </motion.nav>
  )
}
