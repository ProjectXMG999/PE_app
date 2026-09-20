import { motion, useReducedMotion } from 'framer-motion'
import { Confetti } from '../shared/Confetti'
import { FlowNumber } from '../shared/FlowNumber'
import { heroCard, heroReveal, fadeUpReduced, staggerContainerWide } from '../today/motion'
import { SmartSegment } from '../../services/smartQueue'
import { comfortFit, COMFORT_FIT_ORDER, type ComfortFit } from '../../services/comfort'
import './SmartDoneScreen.css'

export interface SmartSegmentTally {
  rated: number
  known: number
}

interface Props {
  tally: Record<SmartSegment, SmartSegmentTally>
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
 */
const FIT_COPY: Record<ComfortFit, { label: string; line: string }> = {
  demanding: {
    label: 'Wymagająco',
    line: 'Ten materiał jeszcze Ci się stawia — kolejne sesje będą łatwiejsze.',
  },
  matched: {
    label: 'W sam raz',
    line: 'Trudność jest dobrana pod Ciebie. Tak trzymamy.',
  },
  easy: {
    label: 'Swobodnie',
    line: 'Idzie gładko. Jeszcze trochę i zacznę dokładać trudniejsze słowa.',
  },
  stretching: {
    label: 'Podkręcamy',
    line: 'Komfort pozwala już dokładać słowa z wyższego poziomu.',
  },
  ready: {
    label: 'Gotowy na wyżej',
    line: 'Wyższy poziom jest w Twoim zasięgu.',
  },
}

/** Premium completion screen for an Inteligentny session — what got learned,
 *  what got protected, and (if the mode moved) how the comfort level shifted. */
export function SmartDoneScreen({ tally, comfortBefore, comfortAfter, level, onRepeat, onExit }: Props) {
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
  const totalKnown = tally.learn.known + tally.review.known + tally.stretch.known

  return (
    <div className="smartdone">
      {totalKnown >= 6 && <Confetti />}
      <motion.div className="smartdone__content u-liquid" variants={staggerContainerWide} initial="hidden" animate="show">
        <motion.span className="smartdone__icon" variants={variants} aria-hidden="true">✓</motion.span>
        <motion.h1 className="smartdone__title u-display" variants={variants}>Sesja skończona</motion.h1>

        <motion.div className="smartdone__stats" variants={cardVariants}>
          {tally.learn.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value"><FlowNumber value={tally.learn.known} delayMs={150} /></span>
              <span className="smartdone__stat-label">nowe opanowane</span>
            </motion.div>
          )}
          {tally.review.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value"><FlowNumber value={tally.review.known} delayMs={300} />/{tally.review.rated}</span>
              <span className="smartdone__stat-label">powtórki utrzymane</span>
            </motion.div>
          )}
          {tally.stretch.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value"><FlowNumber value={tally.stretch.known} delayMs={450} />/{tally.stretch.rated}</span>
              <span className="smartdone__stat-label">z wyższej półki</span>
            </motion.div>
          )}
        </motion.div>

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
