import { AutoplayMode } from '../types/progress'
import { Word } from '../types/vocabulary'

// Declarative timeline for the /pakiet/:id/autoplay listening sequence.
//
// Each mode is an ordered list of steps; the runner (useAutoplaySequence) walks
// the list, playing the clip and then holding silence for `gapMs`. Timing values
// are a 1:1 lift of the old inline `runSequence` in FlashcardPage — behaviour is
// unchanged, it's just data now, which is what makes the modes testable and lets
// them adapt to content without touching the runner.

export type AutoplayLine = 0 | 1 | 2 | 3 // PL word · EN word · PL sentence · EN sentence

export interface AutoplayStep {
  /** Which card line this step speaks — drives the highlight + the step strip. */
  line: AutoplayLine
  clip: 'wordPl' | 'word' | 'sentencePl' | 'sentenceEn'
  /** Times to play the clip back-to-back (default 1), with `repeatGapMs` between. */
  repeat?: number
  /** Silence between repeats of the same clip. Ignored when `repeat` <= 1. */
  repeatGapMs?: number
  /** Silence after the (last) play of this step. */
  gapMs: number
  /** Mark the terminal gap as a "say it aloud" beat — the runner shows the ring. */
  speak?: boolean
  /** Step is dropped when the word lacks this field — sentence-less packs today,
   *  full sequence once sentence content ships. No code change at that point. */
  needs?: 'sentencePl' | 'sentenceEn'
}

export interface AutoplayModeDef {
  /** Canonical Polish label — shared by the picker and the in-player pills. */
  label: string
  /** One-liner for the picker; sentence-aware copy lives in the picker itself. */
  blurb: string
  steps: AutoplayStep[]
}

export const AUTOPLAY_MODES: Record<AutoplayMode, AutoplayModeDef> = {
  fast: {
    label: 'Słowa',
    blurb: 'Sam rytm słów: polskie → angielskie, szybko.',
    steps: [
      { line: 0, clip: 'wordPl', gapMs: 500 },
      { line: 1, clip: 'word', gapMs: 900 },
    ],
  },
  standard: {
    label: 'Standard',
    blurb: 'Słowo z przerwą na przypomnienie i powtórką angielskiego.',
    steps: [
      { line: 0, clip: 'wordPl', gapMs: 1500 },
      { line: 1, clip: 'word', repeat: 2, repeatGapMs: 1400, gapMs: 1500 },
      { line: 2, clip: 'sentencePl', gapMs: 2500, needs: 'sentencePl' },
      { line: 3, clip: 'sentenceEn', gapMs: 1000, needs: 'sentenceEn' },
    ],
  },
  speaking: {
    label: 'Mówienie',
    blurb: 'Najpierw przypomnij i powiedz na głos, potem usłysz.',
    steps: [
      { line: 0, clip: 'wordPl', gapMs: 3000, speak: true },
      { line: 1, clip: 'word', repeat: 2, repeatGapMs: 1400, gapMs: 3000, speak: true },
      { line: 2, clip: 'sentencePl', gapMs: 8000, speak: true, needs: 'sentencePl' },
      { line: 3, clip: 'sentenceEn', gapMs: 3000, speak: true, needs: 'sentenceEn' },
    ],
  },
}

/**
 * The concrete step list for a mode + word: the mode's steps minus any whose
 * `needs` field is absent on the word. Pure — this is the unit-tested seam.
 */
export function planSequence(mode: AutoplayMode, word: Word): AutoplayStep[] {
  return AUTOPLAY_MODES[mode].steps.filter(s => !s.needs || word[s.needs] != null)
}

/** Rough seconds for one word in a mode: gaps (exact) + a flat guess per clip
 *  play (clip length isn't known until it loads). Used for the picker's "~N min". */
const CLIP_GUESS_MS = 1500

export function estimateWordMs(mode: AutoplayMode, word: Word): number {
  return planSequence(mode, word).reduce((sum, s) => {
    const plays = s.repeat ?? 1
    const repeatGaps = plays > 1 ? (plays - 1) * (s.repeatGapMs ?? 0) : 0
    return sum + plays * CLIP_GUESS_MS + repeatGaps + s.gapMs
  }, 0)
}
