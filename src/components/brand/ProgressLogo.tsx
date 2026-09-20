import { useId } from 'react'
import './ProgressLogo.css'
import {
  MARK_GEOMETRY as M,
  WORDMARK_BOX,
  WORDMARK_CAP_RATIO,
  WORDMARK_GLYPHS,
  WORDMARK_ORIGIN,
} from './wordmark.generated'

/**
 * PROGRESS — the brand.
 *
 * THE MARK is a geometric P built from one stroke weight: a capped stem and a
 * bowl arc of the same width, meeting on the stem's centre line so the join
 * disappears and the two read as a single letter. The weight is deliberately
 * heavier than the logotype's (22.5% of cap height against the font's 20.8%),
 * because a mark has to hold at 16px where a word never appears.
 *
 * THE LOGOTYPE is outlines, not text. Set as text it rendered in whatever the
 * device called system-ui — San Francisco here, Roboto there, Segoe somewhere
 * else — so the brand had a different shape on every phone. Drawing the curves
 * makes it one shape everywhere, with no webfont to wait for.
 *
 * Both are drawn rather than imported: they need no network, survive any
 * scale, and the geometry is shared with the install icons via
 * scripts/generate-brand.mjs — run `npm run generate-brand` after changing it.
 */

/* The mark keeps its own colours in both themes. A logo that restyles itself
   for dark mode is not a logo; only the logotype follows the text colour. */
const TILE_STOPS = ['#7c3aed', '#6d28d9', '#4c1d95']
const GLYPH_STOPS = ['#7c3aed', '#a78bfa']

const strokeProps = {
  strokeWidth: M.weight,
  strokeLinecap: 'round',
  fill: 'none',
} as const

interface MarkProps {
  size?: number
  /** Decorative when a wordmark sits next to it; labelled when standing alone. */
  title?: string
  className?: string
}

/** The mark on its tile — the app icon, and the mark's form when it stands alone. */
export function ProgressMark({ size = 32, title, className }: MarkProps) {
  const id = useId()
  const grad = `pm-g-${id}`
  const shine = `pm-s-${id}`

  return (
    <svg
      className={`plogo__mark${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {/* userSpaceOnUse: without it these coordinates are read as fractions
            of the bounding box, which flattens every stop to the first colour. */}
        <linearGradient id={grad} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={TILE_STOPS[0]} />
          {/* Three stops, not two: a two-stop ramp flattens out across a 32px
              tile, and the mid stop keeps the diagonal reading as light
              travelling over the shape rather than as one dull blend. */}
          <stop offset="0.55" stopColor={TILE_STOPS[1]} />
          <stop offset="1" stopColor={TILE_STOPS[2]} />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx={M.tileRadius} fill={`url(#${grad})`} />
      <rect width="64" height="64" rx={M.tileRadius} fill={`url(#${shine})`} />

      <path d={M.stem} stroke="#fff" {...strokeProps} />
      <path d={M.bowl} stroke="#fff" {...strokeProps} />
    </svg>
  )
}

interface GlyphProps extends MarkProps {
  /** Paint the letter flat in this colour instead of the brand gradient. */
  color?: string
}

/**
 * The bare letter, trimmed to its own ink — no tile. Sized by HEIGHT, since
 * the P is taller than it is wide and a caller almost always wants it to match
 * a line of text rather than fill a square.
 */
export function ProgressGlyph({ size = 32, color, title, className }: GlyphProps) {
  const id = useId()
  const grad = `pg-g-${id}`
  const paint = color ?? `url(#${grad})`

  return (
    <svg
      className={`plogo__glyph${className ? ` ${className}` : ''}`}
      height={size}
      width={(size * M.box.w) / M.box.h}
      viewBox={`0 0 ${M.box.w} ${M.box.h}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {!color && (
        <defs>
          {/* The ramp climbs bottom-left to top-right. That rise is the only
              place the "progress" idea lives at favicon size — and the only
              one that survives being 16 pixels wide. */}
          <linearGradient id={grad} x1="20" y1="52" x2="44" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={GLYPH_STOPS[0]} />
            <stop offset="1" stopColor={GLYPH_STOPS[1]} />
          </linearGradient>
        </defs>
      )}
      <g transform={`translate(${-M.box.x} ${-M.box.y})`}>
        <path d={M.stem} stroke={paint} {...strokeProps} />
        <path d={M.bowl} stroke={paint} {...strokeProps} />
      </g>
    </svg>
  )
}

interface WordmarkProps {
  /** Cap height in px — the measure a lockup is actually specified in. */
  cap?: number
  title?: string
  className?: string
}

/** "Progress" as outlines. Takes its colour from `currentColor`. */
export function ProgressWordmark({ cap = 16, title, className }: WordmarkProps) {
  const height = cap / WORDMARK_CAP_RATIO
  return (
    <svg
      className={`plogo__word${className ? ` ${className}` : ''}`}
      height={height}
      width={(height * WORDMARK_BOX.w) / WORDMARK_BOX.h}
      viewBox={`0 0 ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g transform={`translate(${WORDMARK_ORIGIN.x} ${WORDMARK_ORIGIN.y})`}>
        {WORDMARK_GLYPHS.map((g, i) => (
          <path key={i} transform={g.x ? `translate(${g.x} 0)` : undefined} d={g.d} />
        ))}
      </g>
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

/* Cap height of the logotype as a fraction of the mark's tile. Matches the
   ratio the CSS-set wordmark had (0.72em of type, whose caps are 0.745em), so
   swapping text for outlines changed the shape without moving the layout. */
const WORD_CAP = 0.535

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
        <ProgressWordmark cap={size * WORD_CAP} title="Progress" />
        {byline && <span className="plogo__byline">by Project English</span>}
      </span>
    </span>
  )
}
