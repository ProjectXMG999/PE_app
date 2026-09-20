import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import NumberFlow, { type Format, type NumberFlowElement } from '@number-flow/react'
import { observeOnce } from '../../utils/inView'

/**
 * The app's animated numeral.
 *
 * Replaces the hand-rolled `useCountUp`, and the win is not only that the
 * digits roll individually: useCountUp held its interpolation in React state,
 * so a counter on a page re-rendered that whole page ~48 times over its
 * 800 ms run. NumberFlow animates inside a web component, so React renders
 * once per real value change and the page's own work stops being tied to the
 * animation.
 *
 * Reduced motion needs no handling for the roll itself — NumberFlow's
 * `respectMotionPreference` defaults to true and snaps to the value — but the
 * holds below are ours, and they are skipped for it.
 */

interface Props {
  value: number
  /**
   * Hold at zero for this long before animating — the stagger the old hook took
   * as its third argument, kept so rows can still cascade. With `onView` the
   * hold starts when the figure appears rather than when it mounts.
   *
   * It is also what makes a figure roll on arrival at all: NumberFlow animates
   * value *changes*, so a number that is already final on its first render just
   * sits there. A delay renders 0 first and hands over the real value a moment
   * later, which is the change it animates.
   */
  delayMs?: number
  /**
   * Hold until the figure is scrolled into view.
   *
   * For anything below the fold this is the difference between an animation and
   * no animation: a page's counters all mount when the page does, so by the
   * time you have scrolled to the tenth section its figures finished rolling
   * several seconds ago, in private. Use it for every numeral that isn't on the
   * first screenful.
   */
  onView?: boolean
  className?: string
  /** Digit grouping etc. Locale defaults to Polish, which is what every call
   *  site wanted (`toLocaleString('pl-PL')`). NumberFlow's own `Format` is a
   *  deliberate subset of Intl's — it can't animate scientific notation. */
  format?: Format
  'aria-hidden'?: boolean
}

export function FlowNumber({ value, delayMs = 0, onView = false, className, format, ...rest }: Props) {
  // Reduced motion skips the hold as well as the roll. NumberFlow would snap to
  // the value anyway, so keeping the delay would only show a 0 for a moment and
  // then replace it — a flicker offered to the people who asked for less motion.
  const reduced = useReducedMotion()
  const [armed, setArmed] = useState((delayMs === 0 && !onView) || !!reduced)
  const ref = useRef<NumberFlowElement>(null)

  useEffect(() => {
    if (armed) return
    let timer = 0
    // setTimeout even at 0ms: the real value has to land in a later commit than
    // the zero, or React coalesces them and NumberFlow never sees a change.
    const hold = () => { timer = window.setTimeout(() => setArmed(true), delayMs) }

    if (!onView) {
      hold()
      return () => clearTimeout(timer)
    }
    const el = ref.current
    if (!el) return
    const stop = observeOnce(el, hold)
    return () => { stop(); clearTimeout(timer) }
  }, [armed, delayMs, onView])

  return (
    <NumberFlow
      ref={ref}
      value={armed ? value : 0}
      locales="pl-PL"
      format={format}
      className={className}
      {...rest}
    />
  )
}
