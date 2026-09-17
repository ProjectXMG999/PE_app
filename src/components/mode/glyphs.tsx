/**
 * Line glyphs for the mode chooser.
 *
 * Deliberately *not* emoji: emoji render differently on every platform, sit at
 * a fixed weight, and can't take the mode's accent colour — which is exactly
 * why the route map dropped them for numbers. These inherit `currentColor` and
 * the tile's size, so a card can be recoloured by changing one variable.
 */

import { ReactNode } from 'react'

interface GlyphProps {
  size?: number
  /** Stroke weight in viewBox units — raise it for glyphs set small inline. */
  weight?: number
}

function Svg({ size = 20, weight = 1.8, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Szybko — a bolt. */
export function BoltGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M13 2.5 4.8 13.2a.6.6 0 0 0 .48.96H11l-.9 7.34 8.1-10.7a.6.6 0 0 0-.48-.96H13z" />
    </Svg>
  )
}

/** Standard — a levels/equalizer mark: the steady rhythm of a session. */
export function LevelsGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M5 9.5v5M9.7 5.5v13M14.3 8v8M19 10.5v3" />
    </Svg>
  )
}

/** Mówienie — a microphone. */
export function MicGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5M8.5 21.5h7" />
    </Svg>
  )
}

/** Word Flash — a card being turned over. */
export function CardsGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6.5" width="13" height="13" rx="2.6" />
      <path d="M8 4.5h11a2.5 2.5 0 0 1 2.5 2.5v11" />
      <path d="M6.5 13h5" />
    </Svg>
  )
}

/** Active Sentence — a spoken line. */
export function SpeechGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 13.5a3 3 0 0 1-3 3H10l-4.5 3.5v-3.5H5a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h12.5a3 3 0 0 1 3 3z" />
      <path d="M6.5 8.5h9M6.5 12h5.5" />
    </Svg>
  )
}

/* ── Interface symbols ────────────────────────────────────────────────────────
   The SF-Symbols-style set Dzisiaj uses in place of emoji (✨ ⚡ 🎧 🔁 ⓘ). */

/** Inteligentny — sparkles. */
export function SparklesGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M10 3.5c.5 3.7 2.3 5.5 6 6-3.7.5-5.5 2.3-6 6-.5-3.7-2.3-5.5-6-6 3.7-.5 5.5-2.3 6-6z" />
      <path d="M18 14.5c.25 1.8 1.2 2.75 3 3-1.8.25-2.75 1.2-3 3-.25-1.8-1.2-2.75-3-3 1.8-.25 2.75-1.2 3-3z" />
    </Svg>
  )
}

/** Słuchaj — headphones. */
export function HeadphonesGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 17v-4.5a8 8 0 0 1 16 0V17" />
      <rect x="3.5" y="14" width="4.5" height="7" rx="2" />
      <rect x="16" y="14" width="4.5" height="7" rx="2" />
    </Svg>
  )
}

/** Powtórka — a clockwise loop. */
export function RepeatGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4.5h-4.5" />
    </Svg>
  )
}

/** Explanations — info in a circle. */
export function InfoGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.01" />
    </Svg>
  )
}

/** Row disclosure. */
export function ChevronRightGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  )
}

/** Done. */
export function CheckGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}

/* ── Explanation symbols ──────────────────────────────────────────────────────
   Used by the "Jak działa Dzisiaj" sheet, one per point. */

/** A goal — concentric target. */
export function TargetGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </Svg>
  )
}

/** Responds live — a pulse line. */
export function PulseGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
    </Svg>
  )
}

/** Raising the bar — a rising trend. */
export function TrendUpGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 17 6-6 4 4 7-7.5" />
      <path d="M15 7.5h5.5V13" />
    </Svg>
  )
}

/** A daily portion — calendar. */
export function CalendarGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  )
}

/** Priority — a flag. */
export function FlagGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 21V4" />
      <path d="M5.5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0" />
    </Svg>
  )
}

/** Learned for good — a check in a circle. */
export function CheckCircleGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.5" />
    </Svg>
  )
}

/** Starting at your level — steps. */
export function StepsGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 19.5h5v-5h5v-5h5v-5h2" />
    </Svg>
  )
}

/** Two roads — a fork. */
export function RoutesGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 21v-7.5c0-2-1.5-3-3.5-4L5 7.5" />
      <path d="M12 13.5c0-2 1.5-3 3.5-4L19 7.5" />
      <path d="M5 11V7.5h3.5M19 11V7.5h-3.5" />
    </Svg>
  )
}

/* ── Training symbols ─────────────────────────────────────────────────────────
   Trening's exercise icons, in place of the 🎯 💬 🌐 🪜 emoji. */

/** Jedno Słowo, Trzy Dziedziny — a globe. */
export function GlobeGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </Svg>
  )
}

/** Drabina Zdania — a ladder. */
export function LadderGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 3v18M16.5 3v18" />
      <path d="M7.5 7h9M7.5 12h9M7.5 17h9" />
    </Svg>
  )
}

/** Audio length — a speaker. */
export function SpeakerGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </Svg>
  )
}

/** Play — filled, so it reads at small sizes. */
export function PlayGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.2v13.6a1 1 0 0 0 1.52.85l10.9-6.8a1 1 0 0 0 0-1.7L9.52 4.35A1 1 0 0 0 8 5.2z" />
    </svg>
  )
}

/** Back. */
export function ChevronLeftGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </Svg>
  )
}

/** Light theme — a sun. */
export function SunGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </Svg>
  )
}

/** Dark theme — a crescent moon. */
export function MoonGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 13.2A8.6 8.6 0 1 1 10.8 3.5a6.9 6.9 0 0 0 9.7 9.7z" />
    </Svg>
  )
}
