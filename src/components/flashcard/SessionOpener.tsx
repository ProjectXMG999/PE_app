import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import { plWords } from '../../utils/plural'
import { routeNumber } from '../../utils/packRoute'
import { EASE_OUT_EXPO, ENTER_DELAY, ENTER_DURATION, ENTER_STEP } from '../today/motion'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import './SessionOpener.css'

const allPacks = packagesIndex as PackMeta[]

interface Props {
  /** The colour the curtain is washed in: the pack's level colour in a
   *  pack-scoped mode, the session tone's accent otherwise. */
  accent: string
  /** Small-caps line above the title — where you are, which mode this is. */
  kicker?: ReactNode
  /** The one big line: a pack name, or what this session is. */
  title: ReactNode
  /** Under it, the size of what you're about to do. A node, because in most
   *  modes half of it isn't known yet when the curtain goes up. */
  meta?: ReactNode
  /** Extra content under the rule — the Inteligentny mix. */
  children?: ReactNode
  /**
   * Is everything above final? The ground paints on the first frame; the
   * content waits for this and then plays ONE cascade.
   *
   * Not an optimisation — the whole point. Mounting the card with half its
   * data and letting the rest arrive meant a second entrance animation a
   * fraction of a second after the first, which reads as the screen restarting
   * itself. Whatever isn't ready when this flips simply isn't shown.
   */
  ready?: boolean
  onDone: () => void
}

/**
 * The title card before the first word — and the session's loading state.
 *
 * A study session that begins the instant a button is released reads as a form
 * submitting. The screen already drops all chrome and puts out the ambient
 * shader for a session — the stage is set and then nothing raises the curtain.
 * This is the curtain: where you are on the route, what you're about to do, and
 * then out of the way.
 *
 * It goes up on entry and the session builds underneath it, so there is no
 * spinner in front of it; `useSessionOpener` owns when it lifts. Tappable to
 * skip once there is something to skip to.
 */
export function SessionOpener({ accent, kicker, title, meta, children, ready = true, onDone }: Props) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="sessionopener"
      style={{ ['--so-accent' as string]: accent }}
      // No entrance of its own. The page transition already brings this screen
      // in (styles/animations.css: pe-page-in-fwd fades and slides the whole
      // root), and a second opacity ramp on top of it multiplied into a
      // curtain that hung back and then snapped. It only has to leave.
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      onClick={onDone}
      // Tappable to skip, so it answers to a keyboard too. Not a dialog: it
      // traps nothing, it IS the screen — and it leaves on its own whether or
      // not anyone touches it.
      role="button"
      tabIndex={ready ? 0 : -1}
      aria-label="Pomiń ekran startowy"
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault()
          onDone()
        }
      }}
    >
      {ready && (
        <>
          <motion.div
            className="sessionopener__inner"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            // ENTER_* rather than hand-picked delays, and the shared easing
            // constant rather than the same bezier retyped: this cascades on
            // the clock every other screen in the app cascades on.
            transition={{ duration: ENTER_DURATION, ease: EASE_OUT_EXPO, delay: reduced ? 0 : ENTER_DELAY }}
          >
            {kicker && <span className="sessionopener__num">{kicker}</span>}
            <h1 className="sessionopener__name">{title}</h1>
            {meta && <p className="sessionopener__meta">{meta}</p>}
          </motion.div>

          <motion.span
            className="sessionopener__rule"
            aria-hidden="true"
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            // Was 0.9s — the rule was still drawing when the curtain began to
            // leave, so the last thing you saw was an unfinished line. It now
            // lands with the rest of the cascade, well inside the hold.
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: reduced ? 0 : ENTER_DELAY + ENTER_STEP }}
          />

          {children}
        </>
      )}
    </motion.div>
  )
}

interface PackProps {
  packId: string
  /** Which session this is: "Word Flash", "Słuchaj · Standard". */
  mode?: ReactNode
  /** Cards in THIS session, or null when the session never got that far (a
   *  pack that failed to load). Not the pack's word count, which differs in
   *  Trenuj once some words are already known. */
  cards: number | null
  /** See SessionOpener's own `ready` — the content waits for it. */
  ready?: boolean
  onDone: () => void
}

/**
 * The curtain for a pack-scoped session.
 *
 * Name, level and route number come from `packages-index.json`, not from the
 * fetched pack content — the same source StageHeader already resolves them
 * from. Only the count waits for /pack-content plus the progress read, and the
 * whole card waits with it: the alternative was a title that appeared first and
 * a count that slid in after it, which is the second entrance `ready` exists to
 * prevent.
 */
export function PackSessionOpener({ packId, mode, cards, ready, onDone }: PackProps) {
  const pack = allPacks.find(p => p.id === packId)
  const level = pack?.level ?? 1
  const levelName = LEVEL_META.find(l => l.level === level)?.name ?? `Poziom ${level}`
  const num = routeNumber(packId)

  return (
    <SessionOpener
      accent={LEVEL_COLORS[level] ?? 'var(--accent)'}
      kicker={
        <>
          {num > 0 && `nr ${num}`}
          {num > 0 && mode && ' · '}
          {mode}
        </>
      }
      title={pack?.name ?? ''}
      meta={
        <>
          {levelName}
          {cards != null && <> · {cards} {plWords(cards)}</>}
        </>
      }
      ready={ready ?? cards != null}
      onDone={onDone}
    />
  )
}
