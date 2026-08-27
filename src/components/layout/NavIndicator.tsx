import { motion, useReducedMotion } from 'framer-motion'
import { EASE_SPRING } from '../today/motion'

interface Props {
  layoutId: string
  className: string
}

/**
 * The active-tab highlight, shared by BottomNav and Sidebar. A `layoutId`
 * shared across mounts of this same component (one per nav item, only the
 * active one rendered) makes Framer Motion slide it between positions
 * instead of snapping — the two navs use distinct layoutId namespaces since
 * both are mounted simultaneously (AppShell only toggles display, it never
 * unmounts either), not swapped in and out.
 */
export function NavIndicator({ layoutId, className }: Props) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      layoutId={layoutId}
      className={className}
      transition={reduced ? { duration: 0 } : EASE_SPRING}
    />
  )
}
