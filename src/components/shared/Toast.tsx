import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion, type PanInfo, type Variants } from 'framer-motion'
import type { AchievementToast, NoteToast, ToastData } from '../../services/toast'
import { TIER_LABEL } from '../../data/achievements'
import { playSuccess, playUnlock } from '../../services/sfx'
import '../progress/tiers.css'
import './Toast.css'

export type ExitDirection = 'down' | 'left' | 'right'

interface Props {
  toast: ToastData
  onDismiss: (direction?: ExitDirection) => void
  /** Tap on a badge notice — opens it in the cabinet. */
  onOpen?: (toast: AchievementToast) => void
}

/** How long each kind stays up. Longer for the ones with more to read — and a
 *  badge is a moment worth giving time to. */
function durationOf(t: ToastData): number {
  if (t.kind === 'achievement') return 6500
  return t.celebrate ? 5200 : 4200
}

const SPRING = { type: 'spring', stiffness: 460, damping: 34, mass: 0.9 } as const

const variants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.94, filter: 'blur(8px)' },
  shown: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', transition: SPRING },
  exit: (dir: ExitDirection = 'down') => ({
    opacity: 0,
    x: dir === 'left' ? -320 : dir === 'right' ? 320 : 0,
    y: dir === 'down' ? 40 : 0,
    scale: dir === 'down' ? 0.96 : 1,
    filter: 'blur(4px)',
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] as const },
  }),
}

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
}

/**
 * Counts down to auto-dismiss, but only while `running`. Pausing keeps the
 * time already spent, so a toast you held for five seconds still has the rest
 * of its time left when you let go — not a fresh four seconds, and not zero.
 */
function useDismissTimer(ms: number, running: boolean, onElapsed: () => void) {
  const remaining = useRef(ms)
  useEffect(() => {
    if (!running) return
    const startedAt = performance.now()
    const id = window.setTimeout(onElapsed, remaining.current)
    return () => {
      window.clearTimeout(id)
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt))
    }
  }, [running, onElapsed])
}

function useDocumentHidden() {
  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}

/** A ring of sparks thrown out from the icon. Pure CSS — each spark reads its
 *  angle and reach from custom properties, so there is no per-frame JS. */
function Sparks({ count = 10 }: { count?: number }) {
  return (
    <span className="toast__sparks" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            '--angle': `${(360 / count) * i + (i % 2 ? 14 : 0)}deg`,
            '--reach': `${i % 2 ? 22 : 30}px`,
            '--delay': `${120 + (i % 3) * 30}ms`,
          } as CSSProperties}
        />
      ))}
    </span>
  )
}

/**
 * The app's notification: a milestone, a confirmation, or a newly earned badge.
 *
 * Anchored to the bottom and non-modal on purpose: most of these fire *during*
 * a study session, and anything that stole focus or covered the card would
 * punish the user for the very behaviour it's congratulating. So it never takes
 * focus, pauses while you touch or hover it (and while the tab is hidden), and
 * goes away with a flick in any direction you'd expect.
 */
export function Toast({ toast, onDismiss, onOpen }: Props) {
  const reduced = useReducedMotion()
  const docHidden = useDocumentHidden()
  const [held, setHeld] = useState(false)
  const [dragging, setDragging] = useState(false)
  const duration = durationOf(toast)
  const paused = held || dragging || docHidden

  const expire = useCallback(() => onDismiss('down'), [onDismiss])
  useDismissTimer(duration, !paused, expire)

  const celebratory = toast.kind === 'achievement' || toast.celebrate === true
  const tier = toast.kind === 'achievement' ? toast.achievement.tier : null

  // Sound and touch land with the entrance, once per notice.
  useEffect(() => {
    if (tier) {
      playUnlock(tier)
      navigator.vibrate?.(tier === 'legend' || tier === 'gold' ? [10, 50, 10, 50, 18] : [8, 40, 12])
    } else if (celebratory) {
      playSuccess()
      navigator.vibrate?.([8, 40, 8])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  function handleDragEnd(_: unknown, info: PanInfo) {
    setDragging(false)
    const { offset, velocity } = info
    if (offset.y > 36 || velocity.y > 380) onDismiss('down')
    else if (offset.x < -72 || velocity.x < -450) onDismiss('left')
    else if (offset.x > 72 || velocity.x > 450) onDismiss('right')
  }

  function activate() {
    if (toast.kind === 'achievement' && onOpen) onOpen(toast)
    else onDismiss('down')
  }

  const className = [
    'toast',
    `toast--${toast.kind}`,
    celebratory ? 'toast--celebrate' : '',
    tier ? `tier-${tier}` : '',
    reduced ? 'toast--reduced' : '',
  ].filter(Boolean).join(' ')

  return (
    <motion.div
      className={className}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
      variants={reduced ? reducedVariants : variants}
      initial="hidden"
      animate="shown"
      exit="exit"
      drag={!reduced}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={{ top: 0.06, bottom: 0.7, left: 0.7, right: 0.7 }}
      dragSnapToOrigin
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onTap={activate}
      onHoverStart={() => setHeld(true)}
      onHoverEnd={() => setHeld(false)}
      onTapStart={() => setHeld(true)}
      onTapCancel={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onKeyDown={e => {
        if (e.key === 'Escape') onDismiss('down')
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate() }
      }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
    >
      {toast.kind === 'achievement'
        ? <AchievementBody toast={toast} reduced={!!reduced} />
        : <NoteBody toast={toast} reduced={!!reduced} />}

      <span
        className="toast__timer"
        style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        aria-hidden="true"
      />
    </motion.div>
  )
}

function NoteBody({ toast, reduced }: { toast: NoteToast; reduced: boolean }) {
  return (
    <>
      {toast.icon && (
        <span className="toast__icon-wrap">
          <motion.span
            className="toast__icon"
            aria-hidden="true"
            initial={reduced ? false : { scale: 0.3, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 16, delay: 0.08 }}
          >
            {toast.icon}
          </motion.span>
          {toast.celebrate && !reduced && <Sparks />}
        </span>
      )}
      <span className="toast__text">{toast.text}</span>
    </>
  )
}

function AchievementBody({ toast, reduced }: { toast: AchievementToast; reduced: boolean }) {
  const a = toast.achievement
  const rise = (delay: number) => reduced
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const, delay },
      }

  return (
    <>
      <span className="toast__medal-wrap">
        <motion.span
          className="toast__medal"
          initial={reduced ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.06 }}
        >
          <span className="toast__medal-icon" aria-hidden="true">{a.icon}</span>
        </motion.span>
        {!reduced && <Sparks count={12} />}
      </span>

      <span className="toast__body">
        <motion.span className="toast__kicker" {...rise(0.1)}>
          Nowa odznaka · {TIER_LABEL[a.tier]}
        </motion.span>
        <motion.span className="toast__title" {...rise(0.16)}>{a.title}</motion.span>
        <motion.span className="toast__desc" {...rise(0.22)}>
          {a.desc}
          {toast.more > 0 && <span className="toast__more"> · +{toast.more} {plMoreBadges(toast.more)}</span>}
        </motion.span>
      </span>

      <svg className="toast__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </>
  )
}

function plMoreBadges(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (n === 1) return 'kolejna'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'kolejne'
  return 'kolejnych'
}
