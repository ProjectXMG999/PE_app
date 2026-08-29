import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` (ease-out cubic).
 * Respects prefers-reduced-motion by jumping straight to the target.
 *
 * `delayMs` holds at the start value before the roll begins — useful so the
 * count-up doesn't burn through its whole duration behind a route/data load
 * and land before the page is even looked at.
 */
export function useCountUp(target: number, durationMs = 800, delayMs = 0): number {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prevRef.current = target
      setValue(target)
      return
    }
    const from = prevRef.current
    setValue(from)
    let raf = 0
    let startTimer = 0
    const run = () => {
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs)
        const eased = 1 - Math.pow(1 - t, 3)
        setValue(Math.round(from + (target - from) * eased))
        if (t < 1) {
          raf = requestAnimationFrame(step)
        } else {
          prevRef.current = target
        }
      }
      raf = requestAnimationFrame(step)
    }
    if (delayMs > 0) {
      startTimer = window.setTimeout(run, delayMs)
    } else {
      run()
    }
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(startTimer)
    }
  }, [target, durationMs, delayMs])

  return value
}
