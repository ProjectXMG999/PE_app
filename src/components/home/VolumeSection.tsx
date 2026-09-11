import { ReactNode, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LEVEL_COLORS } from '../../utils/packVisuals'
import { VolumeGroup, VolumeStats } from '../../utils/packRoute'
import { EASE_OUT_EXPO } from '../today/motion'
import './VolumeSection.css'

interface Props {
  group: VolumeGroup
  stats: VolumeStats
  collapsed: boolean
  onToggle: () => void
  /** Receives the sticky header node so HomePage can scroll-spy the volumes. */
  headRef?: (node: HTMLElement | null) => void
  children: ReactNode
}

/**
 * A milestone on the route map: a sticky, collapsible band per volume with its
 * own completion ring. Replaces the old per-level band — volumes are contiguous
 * in route order, `pack.level` is not.
 */
export function VolumeSection({ group, stats, collapsed, onToggle, headRef, children }: Props) {
  const reduced = useReducedMotion()
  // Don't play the open animation for a section that's already expanded on the
  // first render (the frontier volume, or a restored session) — only when the
  // user actually toggles it.
  const firstRender = useRef(true)
  const skipOpenAnim = firstRender.current
  firstRender.current = false

  const bandColor = LEVEL_COLORS[group.levels[0]] ?? 'var(--text-muted)'
  const allDone = stats.done === stats.packs
  const region = `volume-${group.short}`

  return (
    <section
      className={`volsec${allDone ? ' is-done' : ''}`}
      style={{ ['--band' as string]: bandColor }}
    >
      <h2 className="volsec__head" ref={headRef} data-volume={group.volume}>
        <button
          type="button"
          className="volsec__toggle"
          aria-expanded={!collapsed}
          aria-controls={region}
          onClick={onToggle}
        >
          <span className="volsec__titles">
            {/* "Tom VI" stays one horizontal unit. Stacking the roman numeral
                under a kicker made I/II/III read as tally marks or a progress
                bar rather than as digits. */}
            <span className="volsec__label">Tom {group.short}</span>
            <span className="volsec__meta">
              <span className="volsec__range">{group.firstNum}–{group.lastNum}</span>
              <span className="volsec__done">
                {allDone ? 'ukończony' : `${stats.done}/${stats.packs} ukończonych`}
              </span>
            </span>
            <span className="volsec__meter">
              <span className="volsec__meter-fill" style={{ width: `${stats.pct}%` }} />
            </span>
          </span>

          <span className={`volsec__chevron ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id={region}
            className="volsec__body"
            initial={reduced || skipOpenAnim ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT_EXPO }}
            style={{ overflow: 'hidden' }}
          >
            <div className="volsec__cards">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
