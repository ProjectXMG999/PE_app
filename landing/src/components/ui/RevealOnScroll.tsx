import { useEffect, useRef, ReactNode } from 'react'
import './RevealOnScroll.css'

interface Props {
  children: ReactNode
  /** Vertical travel distance in px before settling. */
  y?: number
  /** Stagger delay in seconds relative to siblings. */
  delay?: number
  duration?: number
  className?: string
  as?: 'div' | 'section'
}

/**
 * Fades + rises into place the first time the element enters the viewport.
 *
 * This used to drive GSAP + ScrollTrigger. Every reveal on the page is the same
 * "play once on enter" — an IntersectionObserver and a CSS transition do it
 * identically, and dropping GSAP took ~110 KB off a page whose whole job is to
 * load fast enough to feel expensive. The one thing GSAP was genuinely good for
 * here (the scrubbed, pinned counter) is now `position: sticky` plus a scroll
 * handler in SeeYourProgressSection.
 *
 * Note there is no `onLeaveBack`: the previous version faded content back OUT
 * when you scrolled up past it, so re-reading the page made sections blank
 * themselves. An entrance happens once.
 */
export function RevealOnScroll({
  children,
  y = 32,
  delay = 0,
  duration = 0.7,
  className,
  as: Tag = 'div',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal--shown')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.classList.add('reveal--shown')
        observer.disconnect()
      },
      // Matches GSAP's old `start: 'top 85%'` — fire once the element's top has
      // risen 15% into the viewport.
      { rootMargin: '0px 0px -15% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal${className ? ` ${className}` : ''}`}
      style={
        {
          '--reveal-y': `${y}px`,
          '--reveal-delay': `${delay}s`,
          '--reveal-duration': `${duration}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  )
}
