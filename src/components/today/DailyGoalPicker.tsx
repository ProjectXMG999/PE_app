import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from 'framer-motion'
import { DAILY_GOAL_OPTIONS, useAppStore } from '../../store/useAppStore'
import { useLearningRate } from '../../hooks/useLearningRate'
import { LEVEL_META } from '../../data/levels'
import { formatEta } from '../../utils/pace'
import { plWords } from '../../utils/plural'
import { playTick } from '../../services/sfx'
import './DailyGoalPicker.css'

interface Props {
  onClose: () => void
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 } as const

/** On a phone the sheet rises from the bottom edge; from 640px it's a centred
 *  card, which should settle into place rather than travel a whole screen. */
function isDocked(): boolean {
  return !window.matchMedia('(min-width: 640px)').matches
}

const stagger: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT_EXPO } },
}

/**
 * A value that rolls when it changes — up when the goal grows, down when it
 * shrinks — so a new number reads as the old one moving, not being replaced.
 */
function Roll({ value, dir }: { value: string; dir: 1 | -1 }) {
  const reduced = useReducedMotion()
  return (
    <span className="goalpicker__roll">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          variants={{
            enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: `${60 * d}%`, filter: 'blur(3px)' }),
            center: { opacity: 1, y: 0, filter: 'blur(0px)' },
            exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, y: `${-60 * d}%`, filter: 'blur(3px)' }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduced ? 0.12 : 0.3, ease: EASE_OUT_EXPO }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Daily goal, as six options rather than a slider — and, under them, what the
 * choice actually buys: when each remaining stage of the route comes into reach
 * at that many minutes a day.
 *
 * A slider asks the user to aim; six options ask them to choose. The projection
 * is what makes the choice honest. It runs on the user's own measured learning
 * rate (the same model as Postęp's simulator), so "20 minutes gets you to
 * Everyday English in 11 months" is a promise their history has already made,
 * not a figure from a brochure.
 */
export function DailyGoalPicker({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()
  const dailyGoalSec = useAppStore(s => s.dailyGoalSec)
  const setDailyGoalSec = useAppStore(s => s.setDailyGoalSec)
  const rate = useLearningRate()

  const minutes = Math.round(dailyGoalSec / 60)
  // The goal as it was when the sheet opened — what "sooner" and "later" mean.
  const [openedWith] = useState(minutes)
  const [dir, setDir] = useState<1 | -1>(1)
  const [closing, setClosing] = useState(false)
  const [docked] = useState(isDocked)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  function requestClose() {
    if (closing) return
    if (reduced) { ref.current?.close(); return }
    setClosing(true)
  }

  function choose(min: number, focus = false) {
    if (min === minutes) return
    setDir(min > minutes ? 1 : -1)
    setDailyGoalSec(min * 60)
    playTick()
    navigator.vibrate?.(6)
    if (focus) optionRefs.current[DAILY_GOAL_OPTIONS.indexOf(min as typeof DAILY_GOAL_OPTIONS[number])]?.focus()
  }

  // Radio-group keyboard model: arrows move the selection, not just focus.
  function onOptionsKey(e: KeyboardEvent) {
    const i = DAILY_GOAL_OPTIONS.indexOf(minutes as typeof DAILY_GOAL_OPTIONS[number])
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step || i < 0) return
    e.preventDefault()
    const next = DAILY_GOAL_OPTIONS[Math.min(DAILY_GOAL_OPTIONS.length - 1, Math.max(0, i + step))]
    choose(next, true)
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 600) requestClose()
  }

  const sheetVariants: Variants = reduced
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 }, closed: { opacity: 0, transition: { duration: 0.14 } } }
    : docked
      ? {
          hidden: { y: '100%' },
          shown: { y: 0, transition: SHEET_SPRING },
          closed: { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } },
        }
      : {
          hidden: { opacity: 0, y: 24, scale: 0.97 },
          shown: { opacity: 1, y: 0, scale: 1, transition: SHEET_SPRING },
          closed: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
        }

  // ── Projection ────────────────────────────────────────────────────────────
  const remaining = rate ? LEVEL_META.filter(l => l.threshold > rate.knownWords) : []
  const wpm = rate?.wordsPerMinute ?? 0
  const canProject = wpm > 0 && remaining.length > 0
  const daysTo = (threshold: number, min: number) => Math.ceil((threshold - (rate?.knownWords ?? 0)) / (wpm * min))
  // Bars share one scale: the farthest stage at the smallest goal. So a longer
  // goal visibly shortens every bar, rather than each bar rescaling to fill.
  const longest = canProject ? daysTo(remaining[remaining.length - 1].threshold, DAILY_GOAL_OPTIONS[0]) : 1
  const wordsPerDay = Math.round(wpm * minutes)

  return (
    <dialog
      ref={ref}
      className={`goalpicker${closing ? ' goalpicker--closing' : ''}`}
      onClose={onClose}
      onCancel={e => { e.preventDefault(); requestClose() }}
      onClick={e => { if (e.target === ref.current) requestClose() }}
    >
      <motion.div
        className="goalpicker__inner"
        variants={sheetVariants}
        initial="hidden"
        animate={closing ? 'closed' : 'shown'}
        onAnimationComplete={def => { if (def === 'closed') ref.current?.close() }}
        drag={reduced ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.55 }}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        <motion.div className="goalpicker__content" variants={stagger} initial="hidden" animate="shown">
          <span className="goalpicker__handle" aria-hidden="true" />

          <motion.h2 className="goalpicker__title" variants={rise}>Cel na dzień</motion.h2>
          <motion.p className="goalpicker__sub" variants={rise}>
            Ile minut dziennie chcesz trenować? Lepszy mniejszy cel, który utrzymasz.
          </motion.p>

          <motion.div
            className="goalpicker__options"
            role="radiogroup"
            aria-label="Cel na dzień"
            onKeyDown={onOptionsKey}
            variants={rise}
          >
            {DAILY_GOAL_OPTIONS.map((min, i) => {
              const active = min === minutes
              return (
                <button
                  key={min}
                  ref={el => { optionRefs.current[i] = el }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  className={`goalpicker__option${active ? ' goalpicker__option--active' : ''}`}
                  onClick={() => choose(min)}
                  onPointerDownCapture={e => e.stopPropagation()}
                >
                  {active && (
                    <motion.span
                      layoutId="goalpicker-thumb"
                      className="goalpicker__thumb"
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                    />
                  )}
                  <span className="goalpicker__option-value">{min}</span>
                  <span className="goalpicker__option-unit">min</span>
                </button>
              )
            })}
          </motion.div>

          <motion.section className="goalpicker__plan" variants={rise} aria-live="polite">
            {rate == null ? (
              <div className="goalpicker__plan-loading" aria-hidden="true" />
            ) : !canProject ? (
              <p className="goalpicker__plan-empty">
                {remaining.length === 0
                  ? 'Cała trasa za Tobą — cel trzyma teraz formę, nie odlicza dni.'
                  : 'Po kilku sesjach pokażemy tu, kiedy przy tym celu dojdziesz do kolejnych etapów.'}
              </p>
            ) : (
              <>
                <p className="goalpicker__plan-lead">
                  Z celem <strong><Roll value={String(minutes)} dir={dir} /> min</strong> dziennie dotrzesz do:
                </p>

                <ul className="goalpicker__stages">
                  {remaining.map((l, idx) => {
                    const days = daysTo(l.threshold, minutes)
                    const delta = daysTo(l.threshold, openedWith) - days
                    return (
                      <li key={l.level} className={`goalpicker__stage${idx === 0 ? ' goalpicker__stage--next' : ''}`}>
                        <span className="goalpicker__stage-head">
                          <span className="goalpicker__stage-name">{l.name}</span>
                          {/* Inline, not a line of its own: the card keeps
                              its height as the goal changes, so nothing
                              below it jumps. */}
                          <AnimatePresence initial={false} mode="popLayout">
                            {Math.abs(delta) > 6 && (
                              <motion.span
                                key={`${delta > 0 ? 's' : 'l'}${formatEta(Math.abs(delta))}`}
                                className={`goalpicker__stage-delta goalpicker__stage-delta--${delta > 0 ? 'sooner' : 'later'}`}
                                initial={{ opacity: 0, y: reduced ? 0 : 4 * dir }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: reduced ? 0 : -4 * dir }}
                                transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                              >
                                {delta > 0 ? '−' : '+'}{formatEta(Math.abs(delta))}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span className="goalpicker__stage-eta">
                            <Roll value={formatEta(days)} dir={dir} />
                          </span>
                        </span>
                        <span className="goalpicker__stage-track" aria-hidden="true">
                          <motion.span
                            className="goalpicker__stage-bar"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: Math.max(0.03, Math.min(1, days / longest)) }}
                            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 26, delay: 0.1 + idx * 0.05 }}
                          />
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <p className="goalpicker__plan-foot">
                  Twoje tempo: ok. {wordsPerDay} {plWords(wordsPerDay)} dziennie przy {minutes} min nauki.
                  {minutes !== openedWith && <> Różnica w porównaniu z poprzednim celem ({openedWith} min).</>}
                </p>
              </>
            )}
          </motion.section>

          <motion.button
            type="button"
            className="goalpicker__done u-cta"
            variants={rise}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={requestClose}
          >
            Gotowe
          </motion.button>
        </motion.div>
      </motion.div>
    </dialog>
  )
}
