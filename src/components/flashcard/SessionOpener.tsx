import { motion, useReducedMotion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import { plWords } from '../../utils/plural'
import './SessionOpener.css'

interface Props {
  packName: string
  level: number
  /** Cards in this session — not the pack's word count, which differs in
   *  Trenuj once some words are already known. */
  cards: number
  /** Route number of the pack, the product's "which of 864 is this". */
  routeNumber: number | null
  onDone: () => void
}

/**
 * The 1.2 s title card before the first word.
 *
 * A study session that begins the instant a button is released reads as a form
 * submitting. The screen already drops all chrome and puts out the ambient
 * shader for a session — the stage is set and then nothing raises the curtain.
 * This is the curtain: where you are on the route, what you're about to do, and
 * then out of the way.
 *
 * Tappable to skip, and skipped outright under reduced motion — a curtain is
 * exactly the kind of decorative delay that setting is asking not to have.
 */
export function SessionOpener({ packName, level, cards, routeNumber, onDone }: Props) {
  const reduced = useReducedMotion()
  const levelName = LEVEL_META.find(l => l.level === level)?.name ?? `Poziom ${level}`

  return (
    <motion.div
      className="sessionopener"
      style={{ ['--lvl' as string]: LEVEL_COLORS[level] ?? 'var(--accent)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      onClick={onDone}
      role="presentation"
    >
      <motion.div
        className="sessionopener__inner"
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        {routeNumber != null && (
          <span className="sessionopener__num">nr {routeNumber}</span>
        )}
        <h1 className="sessionopener__name">{packName}</h1>
        <p className="sessionopener__meta">
          {levelName} · {cards} {plWords(cards)}
        </p>
      </motion.div>

      <motion.span
        className="sessionopener__rule"
        aria-hidden="true"
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </motion.div>
  )
}
