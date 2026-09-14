import { useId } from 'react'
import './ProgressLogo.css'

/**
 * PROGRESS — the app's brand mark (temporary, but built to hold up).
 *
 * The mark is the product's own metaphor rather than a generic swoosh: the
 * route to 10 000 words. A path climbs from the bottom-left corner, passes two
 * stations, and ends in a solid pip — where you are, and where you're going.
 * One stroke and one dot survive at 16px; the stations fade out politely.
 *
 * It's drawn, not imported, so it takes the theme's colours, scales without
 * artefacts, and needs no PNG round-trip when the real identity lands.
 */

interface MarkProps {
  size?: number
  /** Decorative when a wordmark sits next to it; labelled when standing alone. */
  title?: string
  className?: string
}

export function ProgressMark({ size = 32, title, className }: MarkProps) {
  const id = useId()
  const grad = `pm-grad-${id}`
  const shine = `pm-shine-${id}`

  return (
    <svg
      className={`plogo__mark${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {/* userSpaceOnUse: without it these coordinates are read as fractions
            of the bounding box, which flattens every stop to the first colour. */}
        <linearGradient id={grad} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-purple)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="9.5" fill={`url(#${grad})`} />
      <rect width="32" height="32" rx="9.5" fill={`url(#${shine})`} />

      {/* A geometric P: a rounded stem plus a true circle for the bowl, one
          filled shape with a circular counter punched out (nonzero winding —
          the stem and bowl wind the same way and union, the counter winds the
          other way and subtracts). Solid mass rather than thin strokes is what
          keeps it legible at favicon size. */}
      <path
        fill="#fff"
        d="M9.5 8.8A2.3 2.3 0 0 1 14.1 8.8L14.1 23.2A2.3 2.3 0 0 1 9.5 23.2Z
           M10 12.6A6 6 0 1 1 22 12.6A6 6 0 1 1 10 12.6Z
           M13.1 12.6A2.9 2.9 0 1 0 18.9 12.6A2.9 2.9 0 1 0 13.1 12.6Z"
      />
    </svg>
  )
}

interface LogoProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number
  /** Stacked lockup (mark above wordmark) instead of side by side. */
  stacked?: boolean
  /** "by Project English" under the wordmark — the provenance line. */
  byline?: boolean
  /**
   * Draw the square mark next to the word. Off in the top bar, where the
   * wordmark alone carries the brand and the tile only competed with the
   * streak pill for a strip 60px tall. The mark still stands on its own
   * elsewhere (favicon, install icon) via ProgressMark.
   */
  mark?: boolean
  className?: string
}

export function ProgressLogo({
  size = 32, stacked = false, byline = false, mark = true, className,
}: LogoProps) {
  return (
    <span
      className={[
        'plogo',
        stacked ? 'plogo--stacked' : '',
        mark ? '' : 'plogo--wordmark',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={{ '--plogo-size': `${size}px` } as React.CSSProperties}
    >
      {mark && <ProgressMark size={size} />}
      <span className="plogo__text">
        <span className="plogo__word">Progress</span>
        {byline && <span className="plogo__byline">by Project English</span>}
      </span>
    </span>
  )
}
