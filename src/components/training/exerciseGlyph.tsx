import { ReactNode } from 'react'
import { GlobeGlyph, LadderGlyph, SpeechGlyph, TargetGlyph } from '../mode/glyphs'

/**
 * Line icon for each exercise, keyed by id. The data file still carries its
 * emoji (the audio modal and anything else reading it are untouched); the
 * Trening screens draw these instead, in the app's own symbol style.
 */
export function exerciseGlyph(id: string, size: number): ReactNode {
  switch (id) {
    case 'word-in-action': return <TargetGlyph size={size} weight={1.9} />
    case 'personal-sentence': return <SpeechGlyph size={size} weight={1.9} />
    case 'three-domains': return <GlobeGlyph size={size} weight={1.9} />
    case 'sentence-ladder': return <LadderGlyph size={size} weight={1.9} />
    default: return null
  }
}
