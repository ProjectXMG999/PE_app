import { motion, useReducedMotion } from 'framer-motion'
import { Confetti } from '../shared/Confetti'
import { useCountUp } from '../../hooks/useCountUp'
import { heroCard, heroReveal, fadeUpReduced, staggerContainerWide } from '../today/motion'
import { SmartSegment } from '../../services/smartQueue'
import './SmartDoneScreen.css'

export interface SmartSegmentTally {
  rated: number
  known: number
}

interface Props {
  tally: Record<SmartSegment, SmartSegmentTally>
  comfortBefore: number
  comfortAfter: number
  onRepeat: () => void
  onExit: () => void
}

/** Premium completion screen for an Inteligentny session — what got learned,
 *  what got protected, and (if the mode moved) how the comfort level shifted. */
export function SmartDoneScreen({ tally, comfortBefore, comfortAfter, onRepeat, onExit }: Props) {
  const reduced = useReducedMotion()
  const variants = reduced ? fadeUpReduced : heroReveal
  const cardVariants = reduced ? fadeUpReduced : heroCard

  const learned = useCountUp(tally.learn.known, 900, 150)
  const kept = useCountUp(tally.review.known, 900, 300)
  const stretched = useCountUp(tally.stretch.known, 900, 450)
  const shownComfort = useCountUp(Math.round(comfortAfter * 10), 1000, 600) / 10

  const moved = Math.round(comfortAfter * 10) !== Math.round(comfortBefore * 10)
  const totalKnown = tally.learn.known + tally.review.known + tally.stretch.known

  return (
    <div className="smartdone">
      {totalKnown >= 6 && <Confetti />}
      <motion.div className="smartdone__content" variants={staggerContainerWide} initial="hidden" animate="show">
        <motion.span className="smartdone__icon" variants={variants} aria-hidden="true">✓</motion.span>
        <motion.h1 className="smartdone__title u-display" variants={variants}>Sesja skończona</motion.h1>

        <motion.div className="smartdone__stats" variants={cardVariants}>
          {tally.learn.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value">{learned}</span>
              <span className="smartdone__stat-label">nowe opanowane</span>
            </motion.div>
          )}
          {tally.review.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value">{kept}/{tally.review.rated}</span>
              <span className="smartdone__stat-label">powtórki utrzymane</span>
            </motion.div>
          )}
          {tally.stretch.rated > 0 && (
            <motion.div className="smartdone__stat" variants={variants}>
              <span className="smartdone__stat-value">{stretched}/{tally.stretch.rated}</span>
              <span className="smartdone__stat-label">z wyższej półki</span>
            </motion.div>
          )}
        </motion.div>

        {moved && (
          <motion.p className="smartdone__comfort" variants={variants}>
            Poziom komfortu: {comfortBefore.toFixed(1)} → <strong>{shownComfort.toFixed(1)}</strong>
          </motion.p>
        )}

        <motion.div className="smartdone__actions" variants={variants}>
          <button className="smartdone__btn" onClick={onRepeat}>Jeszcze jedna seria</button>
          <button className="smartdone__btn smartdone__btn--primary" onClick={onExit}>Gotowe</button>
        </motion.div>
      </motion.div>
    </div>
  )
}
