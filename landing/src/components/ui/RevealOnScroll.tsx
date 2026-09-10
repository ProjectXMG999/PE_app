import { useEffect, useRef, ReactNode } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'

interface Props {
  children: ReactNode
  /** Vertical travel distance in px before settling, negative = rises up. */
  y?: number
  /** Stagger delay in seconds for this element relative to siblings sharing a trigger. */
  delay?: number
  duration?: number
  className?: string
  /** Element tag to render — defaults to a plain div. */
  as?: 'div' | 'section'
}

/**
 * Thin, reusable scroll-reveal wrapper: fades + rises into place once the
 * element enters the viewport. Every "scroll-reveal" section on the page uses
 * this identically; the two pinned/scrubbed sections (map + progress-proof)
 * are bespoke since their mechanics don't fit a generic on/off reveal.
 */
export function RevealOnScroll({ children, y = 32, delay = 0, duration = 0.7, className, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }

    gsap.set(el, { opacity: 0, y })
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }),
      onEnterBack: () => gsap.to(el, { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }),
      onLeaveBack: () => gsap.to(el, { opacity: 0, y, duration: duration * 0.6, ease: 'power2.in' }),
    })

    return () => trigger.kill()
  }, [y, delay, duration])

  const Tag = as
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
