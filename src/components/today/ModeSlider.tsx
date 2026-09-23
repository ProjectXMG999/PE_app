import { ReactNode, useRef } from 'react'
import { AnimatePresence, motion, PanInfo, useReducedMotion } from 'framer-motion'
import { BoltGlyph, HeadphonesGlyph } from '../mode/glyphs'
import { EASE_OUT_EXPO, SPRING_SNAPPY, staggerContainer } from './motion'
import './ModeSlider.css'

export type StudyPath = 'listen' | 'train'

interface Props {
  active: StudyPath
  onChange: (mode: StudyPath) => void
  listenContent: ReactNode
  trainContent: ReactNode
}

/** How far a horizontal drag has to travel before it switches the path. */
const SWIPE_THRESHOLD = 60

/**
 * An iOS segmented control over one sliding page — Słuchaj (left), Trenuj
 * (right), each a single recommendation card. Content enters from the side
 * you tapped; a horizontal swipe on the card does the same.
 */
export function ModeSlider({ active, onChange, listenContent, trainContent }: Props) {
  const reduced = useReducedMotion()
  const directionRef = useRef(0)
  // A swipe that ends over the card must not also count as a tap on it.
  const draggedRef = useRef(false)

  function select(mode: StudyPath) {
    if (mode === active) return
    directionRef.current = mode === 'train' ? 1 : -1
    onChange(mode)
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    draggedRef.current = Math.abs(info.offset.x) > 6
    if (info.offset.x < -SWIPE_THRESHOLD) select('train')
    else if (info.offset.x > SWIPE_THRESHOLD) select('listen')
  }

  /**
   * The INCOMING page has no opacity channel: it holds glass (`.today__pick`
   * and `.pathstrip` are `.u-liquid`), and a group below full alpha composites
   * its blurred backdrop over the unblurred real one — so the panel arrived
   * looking almost sharp and frosted over across the next quarter second. It is
   * the same defect the page entrances carry, and the same answer: arrive at
   * one fog level and travel on the transform channel alone (`glassReveal` in
   * ./motion.ts, already shipped on Dzisiaj and Trening).
   *
   * The OUTGOING page keeps its fade. `mode="wait"` means the two never
   * overlap, so without it the old panel would simply vanish at the swap; and
   * fog thinning as something leaves is not what reads as wrong — the eye
   * follows the arrival.
   */
  const variants = {
    enter: (dir: number) => ({ x: reduced ? 0 : dir > 0 ? 32 : -32 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: reduced ? 0 : dir > 0 ? -32 : 32, opacity: 0 }),
  }

  const tabs: { mode: StudyPath; label: string; glyph: ReactNode }[] = [
    { mode: 'listen', label: 'Słuchaj', glyph: <HeadphonesGlyph size={15} weight={2} /> },
    { mode: 'train', label: 'Trenuj', glyph: <BoltGlyph size={15} weight={2} /> },
  ]

  return (
    <div className={`modeslider modeslider--${active}`}>
      <div className="modeslider__tabs u-liquid" role="tablist" aria-label="Ścieżka nauki">
        {tabs.map(tab => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={active === tab.mode}
            className={`modeslider__tab${active === tab.mode ? ' modeslider__tab--active' : ''}`}
            onClick={() => select(tab.mode)}
          >
            {active === tab.mode && (
              <motion.span
                layoutId="today-mode-indicator"
                className="modeslider__indicator"
                transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
              />
            )}
            <span className="modeslider__tab-label">
              <span aria-hidden="true">{tab.glyph}</span>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <div className="modeslider__viewport">
        <AnimatePresence mode="wait" custom={directionRef.current} initial={false}>
          <motion.div
            key={active}
            custom={directionRef.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.24, ease: EASE_OUT_EXPO }}
            className="modeslider__page"
            drag={reduced ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragDirectionLock
            onDragEnd={onDragEnd}
            onPointerDownCapture={() => { draggedRef.current = false }}
            onClickCapture={e => {
              if (draggedRef.current) { e.preventDefault(); e.stopPropagation() }
            }}
          >
            <motion.div
              className="modeslider__stack"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {active === 'listen' ? listenContent : trainContent}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
