import { motion, useReducedMotion } from 'framer-motion'
import { Confetti } from '../shared/Confetti'
import { FlowNumber } from '../shared/FlowNumber'
import { heroCard, heroReveal, fadeUpReduced, staggerContainerWide } from '../today/motion'
import { SmartSegment } from '../../services/smartQueue'
import { comfortFit, COMFORT_FIT_ORDER, type ComfortFit } from '../../services/comfort'
import { HORIZON_BUCKETS, type SmartOutcome, type Transition } from '../../services/smartOutcome'
import { plural } from '../../utils/plural'
import './SmartDoneScreen.css'

export interface SmartSegmentTally {
  rated: number
  known: number
}

interface Props {
  tally: Record<SmartSegment, SmartSegmentTally>
  /** What the sitting did to the schedule — see services/smartOutcome.ts. */
  outcome: SmartOutcome
  comfortBefore: number
  comfortAfter: number
  /** The level the learner is working at — the anchor comfort is read against.
   *  Same one shouldPromptLevelUp uses, so "gotowy na wyżej" here and the
   *  prompt actually firing can't disagree. */
  level: number
  onRepeat: () => void
  onExit: () => void
}

/**
 * How the fit is put into words.
 *
 * One entry per band, and each says what happens NEXT rather than scoring what
 * just happened — the loop aims at an 80% success rate, so drifting downwards
 * means the material ran harder than the sweet spot, not that the learner did
 * badly. Reading it as a demotion is exactly what the raw number invited, and
 * what docs/strona-pakiety.md §8 ("bez karzącej grywalizacji") rules out.
 *
 * The two top bands describe what comfort PERMITS, not what the queue did:
 * selectSmart also needs review health's consent before it actually reaches for
 * a harder pack, so a promise here would sometimes be false.
 *
 * Two things the wording has to keep doing: no adjective that agrees with the
 * learner's gender ("gotowy/gotowa" — we don't know which), and no engine words
 * ("komfort", "poziom trudności") leaking out of the model into the copy.
 */
const FIT_COPY: Record<ComfortFit, { label: string; line: string }> = {
  demanding: {
    label: 'Pod górkę',
    line: 'Ten materiał daje Ci w kość — na razie trochę odpuszczę.',
  },
  matched: {
    label: 'W sam raz',
    line: 'Ani za łatwo, ani za trudno. Tak trzymaj!',
  },
  easy: {
    label: 'Z górki',
    line: 'Radzisz sobie bez trudu — niedługo dorzucę trudniejsze słowa.',
  },
  stretching: {
    label: 'Podkręcamy tempo',
    line: 'Mogę już dorzucać słowa z wyższego poziomu.',
  },
  ready: {
    label: 'Stać Cię na więcej',
    line: 'Wyższy poziom jest już w Twoim zasięgu.',
  },
}

/**
 * The counters, in the only terms that describe a CHANGE.
 *
 * What stood here before counted taps: `tally.learn.known` is "times Znam was
 * pressed on a learn card", which a learner reasonably reads as "words I now
 * know" — and it isn't, because a learn card can be a word already answered
 * earlier in the same run's straggler sweep. These count crossings instead
 * (services/smartOutcome.ts), so each tile is an event that happened to the
 * vocabulary rather than to the session.
 *
 * `slipped` and `met` are stated as what comes NEXT, never as a score. A word
 * that slipped is not a failure and must not be dressed as one — docs/
 * strona-pakiety.md §8, the same rule FIT_COPY above follows.
 */
const TRANSITION_COPY: Record<Transition, string> = {
  entered: 'nowe opanowane',
  held: 'utrzymane',
  slipped: 'do odświeżenia',
  met: 'w trakcie',
}

/** Order the tiles read in — the wins first, then what is still in flight. */
const TRANSITION_ORDER: Transition[] = ['entered', 'held', 'met', 'slipped']

/**
 * When the session's words come back, as a distribution.
 *
 * This is the one thing on the screen that says the sitting BOUGHT something.
 * Everything else describes what was done; the strip shows the schedule that
 * was rewritten — mass moving rightward, session after session, is what
 * progress in a spaced-repetition app physically is.
 *
 * Bars carry a floor height on purpose: a bucket holding one word has to be
 * visibly a bar, not a hairline that reads as an empty column.
 */
function Horizon({ counts }: { counts: number[] }) {
  const peak = Math.max(...counts)
  const described = HORIZON_BUCKETS
    .map((b, i) => (counts[i] > 0 ? `${b.label}: ${counts[i]}` : null))
    .filter(Boolean)
    .join(', ')

  return (
    <div className="smartdone__horizon">
      <span className="smartdone__horizon-head">Kiedy wrócą</span>
      <div className="smartdone__horizon-chart" role="img" aria-label={`Kiedy wrócą — ${described}.`}>
        {HORIZON_BUCKETS.map((b, i) => (
          <div className="smartdone__horizon-col" key={b.label} aria-hidden="true">
            <span className="smartdone__horizon-count">{counts[i] || ''}</span>
            <span
              className={`smartdone__horizon-bar${counts[i] === 0 ? ' is-empty' : ''}`}
              style={{ height: `${counts[i] === 0 ? 0 : 8 + (counts[i] / peak) * 36}px` }}
            />
            <span className="smartdone__horizon-label">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const days = (n: number) => `${n} ${plural(n, 'dzień', 'dni', 'dni')}`

/** Premium completion screen for an Inteligentny session — what changed in the
 *  schedule, which words crossed over, and (if the mode moved) how the comfort
 *  level shifted. */
export function SmartDoneScreen({ tally, outcome, comfortBefore, comfortAfter, level, onRepeat, onExit }: Props) {
  const reduced = useReducedMotion()
  const variants = reduced ? fadeUpReduced : heroReveal
  const cardVariants = reduced ? fadeUpReduced : heroCard


  // The meter is a status and shows every time — it is the answer to "is this
  // the right difficulty for me", which is worth a glance after any session.
  // The sentence is an event and only appears when the BAND actually changed:
  // a 0.1 drift that alters nothing about the next session is not news, and
  // "trudność jest dobrana pod Ciebie" repeated nightly becomes wallpaper.
  const fit = comfortFit(comfortAfter, level)
  const moved = fit !== comfortFit(comfortBefore, level)
  const step = COMFORT_FIT_ORDER.indexOf(fit)

  // Confetti for words that actually crossed over, not for taps. A run of
  // "Znam" on stragglers already answered earlier in the same sitting used to
  // clear this bar without a single word changing state.
  const won = outcome.transitions.entered + outcome.transitions.held

  return (
    <div className="smartdone">
      {won >= 6 && <Confetti />}
      <motion.div className="smartdone__content u-liquid" variants={staggerContainerWide} initial="hidden" animate="show">
        <motion.span className="smartdone__icon" variants={variants} aria-hidden="true">✓</motion.span>
        <motion.h1 className="smartdone__title u-display" variants={variants}>Sesja skończona</motion.h1>

        <motion.div className="smartdone__stats" variants={cardVariants}>
          {TRANSITION_ORDER.map((t, i) => outcome.transitions[t] > 0 && (
            <motion.div className="smartdone__stat" variants={variants} key={t}>
              <span className="smartdone__stat-value">
                <FlowNumber value={outcome.transitions[t]} delayMs={150 + i * 120} />
              </span>
              <span className="smartdone__stat-label">{TRANSITION_COPY[t]}</span>
            </motion.div>
          ))}
        </motion.div>

        {outcome.showHorizon && (
          <motion.div variants={variants}>
            <Horizon counts={outcome.horizon} />
          </motion.div>
        )}

        {/* The comparison is what turns a number into progress — and it compares
            the same words to themselves, so it is a statement about this
            learner's memory rather than about the catalogue. Absent whenever
            too few words carried a previous schedule to say it honestly. */}
        {outcome.shift && (
          <motion.p className="smartdone__shift" variants={variants}>
            Wracały zwykle za {days(outcome.shift.before)} — teraz za{' '}
            <strong>{days(outcome.shift.after)}</strong>.
          </motion.p>
        )}

        {/* Stretch is orthogonal to the crossings above (a stretch word can also
            be one that just entered), so it rides as a note rather than a
            seventh tile competing for the same glance. */}
        {tally.stretch.rated > 0 && (
          <motion.p className="smartdone__note" variants={variants}>
            W tym {tally.stretch.rated} {plural(tally.stretch.rated, 'słowo', 'słowa', 'słów')} z wyższego poziomu.
          </motion.p>
        )}

        <motion.div className="smartdone__fit" variants={variants}>
            <span className="smartdone__fit-head">
              <span className="smartdone__fit-label">{FIT_COPY[fit].label}</span>
              <span className="smartdone__fit-meter" aria-hidden="true">
                {COMFORT_FIT_ORDER.map((_, i) => (
                  <span
                    key={i}
                    className={`smartdone__fit-dot${i === step ? ' is-on' : ''}`}
                  />
                ))}
              </span>
            </span>
            {moved && <p className="smartdone__fit-line">{FIT_COPY[fit].line}</p>}
        </motion.div>

        <motion.div className="smartdone__actions" variants={variants}>
          <button className="smartdone__btn" onClick={onRepeat}>Jeszcze jedna seria</button>
          <button className="smartdone__btn smartdone__btn--primary" onClick={onExit}>Gotowe</button>
        </motion.div>
      </motion.div>
    </div>
  )
}
