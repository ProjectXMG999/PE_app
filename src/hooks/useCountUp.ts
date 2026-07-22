import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` (ease-out cubic).
 * Respects prefers-reduced-motion by jumping straight to the target.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prevRef.current = target
      setValue(target)
      return
    }
    const from = prevRef.current
    const start = performance.now()
    let raf = 0
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
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
