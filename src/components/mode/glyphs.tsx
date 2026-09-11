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
}

function Svg({ size = 20, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
