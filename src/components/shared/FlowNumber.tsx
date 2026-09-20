import { useEffect, useState } from 'react'
import NumberFlow, { type Format } from '@number-flow/react'

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
 * Reduced motion needs no handling here — NumberFlow's `respectMotionPreference`
 * defaults to true and snaps to the value instead of rolling.
 */

interface Props {
  value: number
  /** Hold at zero for this long before animating — the stagger the old hook
   *  took as its third argument, kept so rows can still cascade. */
  delayMs?: number
  className?: string
  /** Digit grouping etc. Locale defaults to Polish, which is what every call
   *  site wanted (`toLocaleString('pl-PL')`). NumberFlow's own `Format` is a
   *  deliberate subset of Intl's — it can't animate scientific notation. */
  format?: Format
  'aria-hidden'?: boolean
}

export function FlowNumber({ value, delayMs = 0, className, format, ...rest }: Props) {
  const [armed, setArmed] = useState(delayMs === 0)

  useEffect(() => {
    if (armed) return
    const t = window.setTimeout(() => setArmed(true), delayMs)
    return () => clearTimeout(t)
  }, [armed, delayMs])

  return (
    <NumberFlow
      value={armed ? value : 0}
      locales="pl-PL"
      format={format}
      className={className}
      {...rest}
    />
  )
}
