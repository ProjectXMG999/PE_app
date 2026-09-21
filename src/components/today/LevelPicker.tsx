import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sheet, sheetRise, sheetRiseReduced, type SheetHandle } from '../shared/Sheet'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import { playTick } from '../../services/sfx'
import { SPRING_SNAPPY } from './motion'
import './LevelPicker.css'

interface Props {
  current: number | null
  /** Fired ONCE, after the sheet has closed — see `choose` below. */
  onSelect: (level: number) => void
  onClose: () => void
}

/**
 * Where to start the route from — a one-time choice for anyone who isn't a
 * true beginner. Sets the floor the Dziś recommendation searches from, so a
 * returning learner isn't offered Level 1, word 1.
 *
 * Motion matches the goal picker, because it is the same kind of decision: the
 * sheet springs in and its rows cascade, and the selected row is marked by one
 * highlight that TRAVELS between rows (a shared layoutId) rather than six
 * independent borders switching colour. Picking a level should read as moving
 * the marker, not as repainting the list.
 */
export function LevelPicker({ current, onSelect, onClose }: Props) {
  const sheet = useRef<SheetHandle>(null)
  const timer = useRef<number>()
  const reduced = useReducedMotion()
  const rise = reduced ? sheetRiseReduced : sheetRise
  /** What the marker is on. Local, so the tap moves it and nothing else. */
  const [picked, setPicked] = useState(current)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /**
   * Choosing is also the way out of this sheet — but not in the same frame.
   * It used to unmount the dialog on the click, so the choice you just made
   * was never on screen: the sheet blinked out and you were back on Dzisiaj,
   * trusting that the tap landed. Now the marker travels to the row, and the
   * sheet leaves on its own animation a beat later, having shown its answer.
   *
   * And the choice is COMMITTED on the way out, not on the tap.
   *
   * Dzisiaj's floor is `todayLevel`: changing it re-scopes the catalogue and
   * re-derives every recommendation on the page — the route slice, the
   * frontier, both next-pack picks, the backlog count, the session preview.
   * Measured on a phone-class CPU that landed as a 58 ms frame on the second
   * frame of the marker's spring, which is the stutter: the marker is a
   * JS-driven animation, so it simply stops for the length of that render.
   * (The goal picker sets one number nothing re-scopes — hence 34 ms, hence
   * smooth. The difference was never the motion; it was the work behind it.)
   *
   * The marker runs off local state, so the tap re-renders this sheet and
   * nothing else, and the page recomputes once the sheet has gone.
   */
  function choose(level: number) {
    if (level === picked) return
    setPicked(level)
    playTick()
    navigator.vibrate?.(6)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => sheet.current?.close(), reduced ? 0 : 320)
  }

  return (
    <Sheet
      ref={sheet}
      onClose={() => {
        // Covers every way out — the auto-close above, Escape, the backdrop,
        // a flick — so a choice can't be lost by leaving the sheet quickly.
        if (picked != null && picked !== current) onSelect(picked)
        onClose()
      }}
      className="levelpicker__inner"
    >
      <motion.h2 className="levelpicker__title" variants={rise}>
        Od którego poziomu zacząć?
      </motion.h2>
      <motion.p className="levelpicker__sub" variants={rise}>
        Progress zacznie proponować paczki od tego miejsca w trasie.
      </motion.p>

      <motion.div
        className="levelpicker__options"
        role="radiogroup"
        aria-label="Poziom startowy"
        variants={rise}
      >
        {LEVEL_META.map(l => {
          const active = l.level === picked
          return (
            <button
              key={l.level}
              type="button"
              role="radio"
              aria-checked={active}
              className={`levelpicker__option${active ? ' levelpicker__option--active' : ''}`}
              onClick={() => choose(l.level)}
            >
              {active && (
                <motion.span
                  layoutId="levelpicker-marker"
                  className="levelpicker__marker"
                  aria-hidden="true"
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <span
                className="levelpicker__option-dot"
                style={{ background: LEVEL_COLORS[l.level] }}
                aria-hidden="true"
              />
              <span className="levelpicker__option-text">
                <span className="levelpicker__option-name">{l.name}</span>
                <span className="levelpicker__option-promise">{l.promise}</span>
              </span>
            </button>
          )
        })}
      </motion.div>

      <motion.button
        type="button"
        className="levelpicker__done"
        variants={rise}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={() => sheet.current?.close()}
      >
        Gotowe
      </motion.button>
    </Sheet>
  )
}
