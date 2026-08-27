import { ReactNode, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { NavIndicator } from '../layout/NavIndicator'
import { EASE_OUT_EXPO } from './motion'
import './ModeSlider.css'

export type StudyPath = 'listen' | 'train'

interface Props {
  active: StudyPath
  onChange: (mode: StudyPath) => void
  listenContent: ReactNode
  trainContent: ReactNode
  onInfoClick: () => void
}

// Same copy as QuickStartCards' MODE_INFO on Pakiety — one description per
// mode, kept identical across both places rather than reworded twice.
const MODE_DESCRIPTION: Record<StudyPath, string> = {
  listen: 'Trening audio bez patrzenia w ekran. Słuchasz, przypominasz sobie i powtarzasz słowa oraz zdania. Idealny na spacer, trening, sprzątanie lub podróż.',
  train: 'Aktywny trening z ekranem. Przypominasz sobie angielskie słowa, mówisz je na głos i budujesz z nimi zdania. Dzięki temu przechodzisz od rozpoznawania słów do ich aktywnego używania.',
}

const WAVE = (
  <span className="modeslider__tab-wave" aria-hidden="true">
    <span /><span /><span />
  </span>
)

/**
 * Two tabs, one sliding "page" between them — Słuchaj (left) and Trenuj
 * (right), each carrying its own progress strip + recommendation card as one
 * unit. Switching feels like turning a page, not swapping a div: content
 * enters from the side you tapped and the old page exits the other way,
 * matching the direction of travel rather than always fading in place.
 */
export function ModeSlider({ active, onChange, listenContent, trainContent, onInfoClick }: Props) {
  const reduced = useReducedMotion()
  const directionRef = useRef(0)

  function select(mode: StudyPath) {
    if (mode === active) return
    directionRef.current = mode === 'train' ? 1 : -1
    onChange(mode)
  }

  const variants = {
    enter: (dir: number) => ({ x: reduced ? 0 : dir > 0 ? 32 : -32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: reduced ? 0 : dir > 0 ? -32 : 32, opacity: 0 }),
  }

  return (
    <div className="modeslider">
      <div className="modeslider__tabs">
        <button
          className={`modeslider__tab modeslider__tab--listen${active === 'listen' ? ' modeslider__tab--active' : ''}`}
          onClick={() => select('listen')}
        >
          {active === 'listen' && (
            <NavIndicator layoutId="today-mode-indicator" className="modeslider__indicator" />
          )}
          <span className="modeslider__tab-label">
            ‹ {WAVE} Słuchaj
          </span>
        </button>
        <button
          className={`modeslider__tab modeslider__tab--train${active === 'train' ? ' modeslider__tab--active' : ''}`}
          onClick={() => select('train')}
        >
          {active === 'train' && (
            <NavIndicator layoutId="today-mode-indicator" className="modeslider__indicator" />
          )}
          <span className="modeslider__tab-label">
            <span className="modeslider__tab-bolt" aria-hidden="true">⚡</span> Trenuj ›
          </span>
        </button>
        <button
          type="button"
          className="modeslider__info-btn"
          onClick={onInfoClick}
          aria-label="Jak dobieramy te propozycje"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16" />
            <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={active}
          className={`modeslider__desc modeslider__desc--${active}`}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -4 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: EASE_OUT_EXPO }}
        >
          {MODE_DESCRIPTION[active]}
        </motion.p>
      </AnimatePresence>

      <div className="modeslider__viewport">
        <AnimatePresence mode="wait" custom={directionRef.current} initial={false}>
          <motion.div
            key={active}
            custom={directionRef.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT_EXPO }}
            className="modeslider__page"
          >
            {active === 'listen' ? listenContent : trainContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
