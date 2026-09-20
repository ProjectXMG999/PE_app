import { motion, useReducedMotion } from 'framer-motion'
import { EASE_SPRING, heroReveal, fadeUpReduced } from '../today/motion'
import './SmartInfoCard.css'

export type SmartInfoVariant = 'review-ahead' | 'stretch-ahead' | 'back-to-new'

/** Exported so the curtain can say the same thing in the same words when a run
 *  OPENS on a segment: `composeSmartSteps` no longer emits a hand-off card with
 *  nothing before it, so for a review-first session this copy is read by
 *  SmartSessionOpener instead. One table, one wording, either way. */
export const SMART_INFO_COPY: Record<SmartInfoVariant, { icon: string; title: string; sub: (count?: number) => string; tone: string }> = {
  'stretch-ahead': {
    icon: '🚀',
    title: 'Świetnie Ci idzie',
    sub: (n) => `Podnoszę poprzeczkę — ${n ?? 'kilka'} ${n === 1 ? 'słowo' : 'słów'} z wyższej półki.`,
    tone: 'stretch',
  },
  'review-ahead': {
    icon: '🔁',
    title: 'Szybka powtórka',
    sub: (n) => `${n ?? 'Kilka'} ${n === 1 ? 'słowo, które zaczyna' : 'słów, które zaczynają'} uciekać.`,
    tone: 'review',
  },
  'back-to-new': {
    icon: '✨',
    title: 'Wracamy do nowego materiału',
    sub: () => 'Kontynuujemy tam, gdzie skończyliśmy.',
    tone: 'learn',
  },
}

interface Props {
  variant: SmartInfoVariant
  count?: number
  onNext: () => void
}

/** Full-screen interstitial between segments of an Inteligentny session —
 *  explains the hand-off instead of silently changing what's being asked. */
export function SmartInfoCard({ variant, count, onNext }: Props) {
  const reduced = useReducedMotion()
  const copy = SMART_INFO_COPY[variant]

  return (
    <div className={`smartinfo smartinfo--${copy.tone}`} onClick={onNext} role="button" tabIndex={0}>
      <motion.div
        className="smartinfo__card u-surface--raised"
        variants={reduced ? fadeUpReduced : heroReveal}
        initial="hidden"
        animate="show"
      >
        <motion.span
          className="smartinfo__icon"
          aria-hidden="true"
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={reduced ? { duration: 0 } : EASE_SPRING}
        >
          {copy.icon}
        </motion.span>
        <h2 className="smartinfo__title u-display">{copy.title}</h2>
        <p className="smartinfo__sub">{copy.sub(count)}</p>
        <button className="smartinfo__next" onClick={(e) => { e.stopPropagation(); onNext() }}>
          Dalej
        </button>
      </motion.div>
    </div>
  )
}
