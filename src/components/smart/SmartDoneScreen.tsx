import { motion, useReducedMotion } from 'framer-motion'
import { Confetti } from '../shared/Confetti'
import { FlowNumber } from '../shared/FlowNumber'
import { heroCard, heroReveal, fadeUpReduced, staggerContainerWide } from '../today/motion'
import { SmartSegment } from '../../services/smartQueue'
import { comfortFit, COMFORT_FIT_ORDER, type ComfortFit } from '../../services/comfort'
import { MEMORY_LEVELS, judgesDifficulty, type SmartOutcome, type Transition } from '../../services/smartOutcome'
import { plural, plReviews } from '../../utils/plural'
import './SmartDoneScreen.css'

export interface SmartSegmentTally {
  rated: number
  known: number
}

interface Props {
  tally: Record<SmartSegment, SmartSegmentTally>
  /** What the sitting did to the schedule — see services/smartOutcome.ts. */
  outcome: SmartOutcome
  /** Reviews still owed today once this sitting is folded in, or null when the
   *  count could not be re-read (a sitting that rated nothing). */
  reviewsLeft: number | null
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
 * The top bands describe where the LEARNER stands, never what the queue will do
 * next. They used to promise the harder words ("niedługo dorzucę trudniejsze
 * słowa"), which was already conditional — selectSmart needs review health's
 * consent too — and is now simply untrue: LEVEL_STRETCH_ENABLED (comfort.ts) is
 * off, so no sitting reaches into a higher pack on its own. A reading of the
 * learner stays true either way, which is why the wording moved there rather
 * than being branched on the switch.
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
    line: 'Radzisz sobie bez trudu — ten materiał przestaje być wyzwaniem.',
  },
  stretching: {
    label: 'Podkręcamy tempo',
    line: 'Coraz mniej Cię to kosztuje — wyższy poziom jest coraz bliżej.',
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
/**
 * Each label is a caption under a numeral, so it has to survive Polish
 * agreement: "8 utrzymane" is not a sentence anyone would write. Two of them
 * inflect through `plural`; the other two are prepositional phrases, which take
 * any count unchanged and are the safer shape wherever one fits.
 *
 * Only `entered` names "słowa" — repeating the noun under all four numerals
 * reads like a form, not a result.
 */
const TRANSITION_COPY: Record<Transition, (n: number) => string> = {
  entered: n => plural(n, 'nowe słowo', 'nowe słowa', 'nowych słów'),
  held: n => plural(n, 'utrwalone', 'utrwalone', 'utrwalonych'),
  slipped: () => 'do powtórki',
  met: () => 'w nauce',
}

/** Order the tiles read in — the wins first, then what is still in flight. */
const TRANSITION_ORDER: Transition[] = ['entered', 'held', 'met', 'slipped']

/**
 * A review-only sitting gets no verdict band at all.
 *
 * There was one here briefly, built on review health, and it had to go: its top
 * band read "Pamiętasz aż za dobrze", which is not a thing. Health above target
 * is a statement about the SCHEDULER having room to stretch intervals, and
 * there is no way to say that about the learner without implying they did
 * something wrong by remembering. The screen states facts instead — which
 * memory tiers the sitting covered, and how many reviews are still owed.
 */

/**
 * Which memory tiers this sitting covered.
 *
 * A statement of fact, not an interpretation: these are the words that were
 * just answered, sorted by how strongly they are now held. Over weeks the mass
 * climbs out of the left-hand tiers, which is what progress in a spaced-
 * repetition app physically is — and the fixed scale (MEMORY_LEVELS) is what
 * makes that visible from one session to the next.
 *
 * Each column carries the tier's NAME and its day range, because the names are
 * relative: "mocne" means nothing until you can see it is months, not days.
 *
 * Bars carry a floor height on purpose: a tier holding one word has to be
 * visibly a bar, not a hairline that reads as an empty column.
 */
function MemoryLevels({ counts }: { counts: number[] }) {
  const peak = Math.max(...counts)
  const described = MEMORY_LEVELS
    .map((b, i) => (counts[i] > 0 ? `${b.label} (${b.range}): ${counts[i]}` : null))
    .filter(Boolean)
    .join(', ')

  return (
    <div className="smartdone__horizon">
      <span className="smartdone__horizon-head">Poziom pamięci</span>
      <div
        className="smartdone__horizon-chart"
        role="img"
        aria-label={`Poziom pamięci powtórzonych słów — ${described}.`}
      >
        {MEMORY_LEVELS.map((b, i) => (
          <div className="smartdone__horizon-col" key={b.label} aria-hidden="true">
            <span className="smartdone__horizon-count">{counts[i] || ''}</span>
            {/* No inline height for an empty tier: an inline 0 beat the
                `is-empty` track's own height and collapsed the column to
                nothing, so a gap in the distribution read as a rendering
                fault rather than as the information it is. */}
            <span
              className={`smartdone__horizon-bar${counts[i] === 0 ? ' is-empty' : ''}`}
              style={counts[i] === 0 ? undefined : { height: `${8 + (counts[i] / peak) * 36}px` }}
            />
            <span className="smartdone__horizon-label">{b.label}</span>
            <span className="smartdone__horizon-range">{b.range}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Premium completion screen for an Inteligentny session — what changed in the
 *  schedule, which words crossed over, and (if the mode moved) how the comfort
 *  level shifted. */
export function SmartDoneScreen({
  tally, outcome, reviewsLeft,
  comfortBefore, comfortAfter, level, onRepeat, onExit,
}: Props) {
  const reduced = useReducedMotion()
  const variants = reduced ? fadeUpReduced : heroReveal
  const cardVariants = reduced ? fadeUpReduced : heroCard

  // Whether the difficulty band gets to speak at all — see smartOutcome.ts.
  const showsFit = judgesDifficulty(tally.learn.rated + tally.stretch.rated)

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
              <span className="smartdone__stat-label">{TRANSITION_COPY[t](outcome.transitions[t])}</span>
            </motion.div>
          ))}
        </motion.div>

        {outcome.showLevels && (
          <motion.div variants={variants}>
            <MemoryLevels counts={outcome.levels} />
          </motion.div>
        )}

        {/* What is still owed today. The one number a learner can act on
            straight from this screen — and the reason "Gotowe" is or isn't the
            end of the day. Null when the sitting rated nothing, so there was no
            snapshot to re-read. */}
        {reviewsLeft != null && (
          <motion.p className="smartdone__shift" variants={variants}>
            {reviewsLeft > 0
              ? <>Zostało dziś <strong>{reviewsLeft}</strong> {plReviews(reviewsLeft)}.</>
              : <>Powtórki na dziś zrobione.</>}
          </motion.p>
        )}

        {/* Stretch is orthogonal to the crossings above (a stretch word can also
            be one that just entered), so it rides as a note rather than a
            seventh tile competing for the same glance. */}
        {tally.stretch.rated > 0 && (
          <motion.p className="smartdone__note" variants={variants}>
            Wśród nich {tally.stretch.rated} {plural(tally.stretch.rated, 'słowo', 'słowa', 'słów')} z wyższego poziomu.
          </motion.p>
        )}

        {showsFit && (
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
        )}

        <motion.div className="smartdone__actions" variants={variants}>
          <button className="smartdone__btn" onClick={onRepeat}>Jeszcze jedna seria</button>
          <button className="smartdone__btn smartdone__btn--primary" onClick={onExit}>Gotowe</button>
        </motion.div>
      </motion.div>
    </div>
  )
}
