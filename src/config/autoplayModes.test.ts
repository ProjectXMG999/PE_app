import { describe, it, expect } from 'vitest'
import { AUTOPLAY_MODES, planSequence, estimateWordMs } from './autoplayModes'
import type { Word } from '../types/vocabulary'

const wordOnly: Word = {
  id: 'w1', english: 'Storm', polish: 'Burza',
  sentenceEn: null, sentencePl: null,
  audioWord: 'w.mp3', audioSentence: 's.mp3', audioWordPl: 'wpl.mp3',
}

const withSentences: Word = {
  ...wordOnly, id: 'w2',
  sentenceEn: 'A storm is coming.', sentencePl: 'Nadchodzi burza.',
  audioSentencePl: 'spl.mp3',
}

describe('planSequence', () => {
  it('fast mode: PL word then EN word, regardless of sentences', () => {
    expect(planSequence('fast', wordOnly).map(s => s.clip)).toEqual(['wordPl', 'word'])
    expect(planSequence('fast', withSentences).map(s => s.clip)).toEqual(['wordPl', 'word'])
  })

  it('drops sentence steps for a word without sentence text', () => {
    expect(planSequence('standard', wordOnly).map(s => s.clip)).toEqual(['wordPl', 'word'])
    expect(planSequence('speaking', wordOnly).map(s => s.clip)).toEqual(['wordPl', 'word'])
  })

  it('keeps sentence steps once the word carries them — no code change needed', () => {
    expect(planSequence('standard', withSentences).map(s => s.clip))
      .toEqual(['wordPl', 'word', 'sentencePl', 'sentenceEn'])
    expect(planSequence('speaking', withSentences).map(s => s.line))
      .toEqual([0, 1, 2, 3])
  })

  it('carries repeat / gap / speak metadata through untouched', () => {
    const enStep = planSequence('standard', wordOnly).find(s => s.clip === 'word')!
    expect(enStep.repeat).toBe(2)
    expect(enStep.repeatGapMs).toBe(1400)
    expect(enStep.gapMs).toBe(1500)

    const speakStep = planSequence('speaking', wordOnly)[0]
    expect(speakStep.speak).toBe(true)
  })

  it('every step line matches an on-card line 0..3 and clip pairs with it', () => {
    for (const mode of ['fast', 'standard', 'speaking'] as const) {
      for (const s of AUTOPLAY_MODES[mode].steps) {
        expect(s.line).toBeGreaterThanOrEqual(0)
        expect(s.line).toBeLessThanOrEqual(3)
        expect(s.gapMs).toBeGreaterThan(0)
      }
    }
  })
})

describe('estimateWordMs', () => {
  it('a sentence-bearing word takes longer than a word-only one in the same mode', () => {
    expect(estimateWordMs('standard', withSentences))
      .toBeGreaterThan(estimateWordMs('standard', wordOnly))
  })

  it('speaking (long think-gaps) takes longer than fast for the same word', () => {
    expect(estimateWordMs('speaking', wordOnly))
      .toBeGreaterThan(estimateWordMs('fast', wordOnly))
  })

  it('counts the repeat play + its inter-repeat gap', () => {
    // sentence-less standard = PL step (1×1500 clip + 1500 gap = 3000) +
    // EN step (2×1500 clip + 1×1400 repeat gap + 1500 gap = 5900) = 8900
    expect(estimateWordMs('standard', wordOnly)).toBe(8900)
  })
})
