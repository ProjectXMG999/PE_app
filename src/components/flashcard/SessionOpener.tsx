import { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  /** Small-caps line above the title — where you are, which mode this is.
   *  Known at mount in every mode, and shown then. */
  kicker?: ReactNode
  /** The one big line: a pack name, or what this session is. Also known at
   *  mount — a pack's name comes from the index, not from its content. */
  title: ReactNode
  /** Under it, the size of what you're about to do. A node, because in every
   *  mode this is the half that isn't known yet when the curtain goes up. */
  meta?: ReactNode
  /**
   * What the session is doing while `meta` doesn't exist yet — "Dobieram słowa
   * i powtórki…". Sits in the line `meta` will take and hands it over there, so
   * the wait is stated rather than merely endured.
   *
   * Present tense and specific per mode: this is the one moment the app is
   * visibly working for a second or two, and "Ładowanie…" would waste it.
   */
  waiting?: ReactNode
  /** Extra content under the rule — the Inteligentny mix. Waits with `meta`. */
  children?: ReactNode
  /**
   * Are the session's FACTS final — the counts, the mix, the minutes?
   *
   * It gates those and nothing else. Mounting them half-built and letting the
   * rest arrive would be a second entrance animation a fraction of a second
   * after the first, which reads as the screen restarting itself; so whatever
   * isn't ready when this flips simply isn't shown, and they play one cascade.
   *
   * What it used to gate was the whole card, title included — and since a
   * session can take a couple of seconds to build (a progress snapshot plus a
   * pack fetch each), the curtain spent that time as an empty coloured screen.
   * It is the loading state: a loading state with nothing on it is the blank
   * screen it was meant to replace. The identity is free — every mode has it
   * synchronously — so it goes up immediately, and the facts land into it.
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
 *
 * Two tiers, and the split is the difference between a curtain and a blank
 * screen: the identity — mode, pack, the rule under them — is known
 * synchronously and cascades in on mount, while the facts the session has to
 * be built to know wait for `ready` and land as one later cascade.
 */
export function SessionOpener({ accent, kicker, title, meta, waiting, children, ready = true, onDone }: Props) {
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
      {/* Bottom-anchored (see the CSS): the facts below grow downward into
          space that is already allocated, so nothing here moves when they
          arrive. A title that jumps as the counts land would undo the point of
          showing it early. */}
      <div className="sessionopener__head">
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
          {/* Always rendered, so the line it will occupy is reserved from the
              first frame — `meta` is the one thing here that arrives late.
              The status line and the counts cross-fade INSIDE it (both are
              absolute, see the CSS): one line that changes what it says, not
              a line replaced by another line, which is the second entrance
              this card is built to avoid.
              A polite live region, so the hand-over is announced once rather
              than the title being re-read. */}
          <p className="sessionopener__meta" aria-live="polite">
            {/* Keyed on `ready`, not on whether there is a `meta` to show: a
                session can settle with nothing to say on this line (an empty
                review queue, a mix that came back all zeros), and falling back
                to the status line there would leave the curtain claiming to be
                working on a session it had already finished building. */}
            <AnimatePresence initial={false}>
              {ready ? meta && (
                <motion.span
                  key="meta"
                  className="sessionopener__meta-line"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.35, ease: EASE_OUT_EXPO }}
                >
                  {meta}
                </motion.span>
              ) : waiting && (
                <motion.span
                  key="waiting"
                  className="sessionopener__meta-line"
                  // No entrance: it arrives inside the identity block's own
                  // cascade, which is already fading this whole column in.
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.25, ease: EASE_OUT_EXPO }}
                >
                  {/* Its own element: the breath is a CSS animation on
                      opacity, and the motion span above is already writing an
                      inline opacity of its own. Nested, the two multiply
                      instead of fighting. */}
                  <span className="sessionopener__working">{waiting}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </p>
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
      </div>

      {children && <div className="sessionopener__facts">{ready && children}</div>}
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
      // What these modes are actually waiting on: /pack-content, then the
      // progress rows that decide which of its words this sitting will use.
      // Named rather than described as loading — the pack is the thing on the
      // line above, so the learner can see what is being fetched.
      waiting="Wczytuję pakiet…"
      ready={ready ?? cards != null}
      onDone={onDone}
    />
  )
}
