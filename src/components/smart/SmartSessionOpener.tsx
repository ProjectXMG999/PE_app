import { motion, useReducedMotion } from 'framer-motion'
import { SessionOpener } from '../flashcard/SessionOpener'
import { SmartPreview, SmartSegment, smartReason } from '../../services/smartQueue'
import { SMART_INFO_COPY, SmartInfoVariant } from './SmartInfoCard'
import { plural, plMinutes, plReviews } from '../../utils/plural'
import { ENTER_DELAY, ENTER_STEP, EASE_OUT_EXPO } from '../today/motion'
import './SmartSessionOpener.css'

type Segment = 'learn' | 'review' | 'stretch'

const SEGMENTS: Segment[] = ['learn', 'review', 'stretch']

/**
 * What to say when the run opens on something other than new words.
 *
 * `composeSmartSteps` used to put a full-screen "Szybka powtórka" hand-off card
 * at step 0 for these runs — over the curtain, through its own translucent
 * scrim, on a timer that started in the same commit. The curtain says it now,
 * and the hand-off card is back to being what it is: a mid-session explanation.
 *
 * The lead is the curtain's own phrasing ("we're starting with…"); the line
 * under it is SmartInfoCard's, so the two never drift apart.
 */
const OPENS_WITH: Partial<Record<SmartSegment, { lead: string; variant: SmartInfoVariant }>> = {
  review: { lead: 'Zaczynamy od powtórki', variant: 'review-ahead' },
  stretch: { lead: 'Zaczynamy z wyższej półki', variant: 'stretch-ahead' },
}

const LABEL: Record<Segment, (n: number) => string> = {
  learn: n => `${n} ${plural(n, 'nowe słowo', 'nowe słowa', 'nowych słów')}`,
  review: n => `${n} ${plReviews(n)}`,
  // A prepositional phrase, so it agrees with any count — and it's the wording
  // SmartInfoCard already uses for the same stream.
  stretch: n => `${n} z wyższej półki`,
}

interface Props {
  preview: SmartPreview | null
  /** What the composed run opens with — null until the steps exist. */
  opensWith: { segment: SmartSegment; count: number } | null
  /** The session is built. The curtain shows its content on this rather than on
   *  `preview` arriving: see the note on the `ready` prop below. */
  ready: boolean
  onDone: () => void
}

/**
 * The Inteligentny curtain.
 *
 * Its own component because this session is not a place. "nr 137 · Zakupy i
 * pieniądze" answers "where am I on the route"; there is no answer to that
 * here, where one sitting draws on several packs at once. What this mode can
 * honestly open on is what the next twelve minutes are made of — and, when the
 * split moved away from the baseline, why.
 *
 * The three chips carry the progress rail's own colours, so the curtain opens
 * in the three colours the rail underneath is about to use.
 */
export function SmartSessionOpener({ preview, opensWith, ready, onDone }: Props) {
  const reduced = useReducedMotion()
  const segments = preview ? SEGMENTS.filter(s => preview[s] > 0) : []
  const reason = preview ? smartReason(preview) : null
  // Nothing to do today: the minutes are still a number (previewOf falls back
  // to the target count) but they'd be a promise the next screen breaks.
  const hasMix = segments.length > 0
  const lead = opensWith ? OPENS_WITH[opensWith.segment] : undefined

  // One clock for the whole cascade, on the app's entrance rhythm rather than
  // four hand-picked delays. The last line lands at ~0.68s against the 1200ms
  // hold, so the screen is STILL for a beat before it leaves — which is the
  // difference between the curtain giving way and the curtain running off.
  const step = (i: number) => ({
    duration: 0.4,
    ease: EASE_OUT_EXPO,
    delay: reduced ? 0 : ENTER_DELAY + ENTER_STEP * i,
  })

  return (
    <SessionOpener
      accent="var(--accent)"
      kicker="Inteligentnie"
      title="Twoja sesja na dziś"
      meta={hasMix ? <>≈ {preview!.minutes} {plMinutes(preview!.minutes)}</> : undefined}
      // `ready` is the built session, NOT the arrival of `preview`.
      //
      // The preview is published one IndexedDB read in, before any pack is
      // fetched, and revealing on it meant the curtain opened on the quota's
      // INTENTION: `preview.learn` is a target, so a sitting whose learn
      // candidates all turn out already-known promised new words and then
      // opened on a review. It also left `opensWith` — which only exists once
      // the steps are composed — with no way into the same cascade, and a line
      // arriving on its own a beat later is the second entrance this component
      // exists to avoid. One cascade, built from what the session actually is.
      ready={ready}
      onDone={onDone}
    >
      {lead && (
        <motion.p
          className={`smartopener__lead smartopener__lead--${opensWith!.segment}`}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={step(2)}
        >
          <span className="smartopener__lead-title">{lead.lead}</span>
          <span className="smartopener__lead-sub">
            {SMART_INFO_COPY[lead.variant].sub(opensWith!.count)}
          </span>
        </motion.p>
      )}

      {hasMix && (
        <motion.ul
          className="smartopener__mix"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={step(3)}
        >
          {segments.map(s => (
            <li key={s} className={`smartopener__chip smartopener__chip--${s}`}>
              {LABEL[s](preview![s])}
            </li>
          ))}
        </motion.ul>
      )}

      {reason && (
        <motion.p
          className="smartopener__reason"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={step(4)}
        >
          {reason}
        </motion.p>
      )}
    </SessionOpener>
  )
}
