import { describe, it, expect, vi } from 'vitest'
import { useSentenceCardProps } from './useSentenceCardProps'
import { Word } from '../types/vocabulary'

function word(overrides: Partial<Word> = {}): Word {
  return {
    id: 'w1', english: 'run', polish: 'biegać',
    sentenceEn: null, sentencePl: null, audioWord: '', audioSentence: '',
    ...overrides,
  }
}

/** Both sentences, both recorded against the current text. */
function recorded(overrides: Partial<Word> = {}): Word {
  return word({
    sentencePl: 'On biega.', sentenceEn: 'He runs.',
    audioSentence: 's.mp3', audioSentencePl: 'spl.mp3', sentenceAudio: true,
    ...overrides,
  })
}

function audio() {
  return {
    stop: vi.fn(),
    playSentence: vi.fn(),
    playSentencePl: vi.fn(),
    playWordPl: vi.fn(),
  }
}

describe('useSentenceCardProps', () => {
  it('returns all-undefined props for a null word', () => {
    const props = useSentenceCardProps(null, audio())
    expect(props.onPlayPolish).toBeUndefined()
    expect(props.frontExtra).toBeUndefined()
    expect(props.backExtra).toBeUndefined()
    expect(props.frontHint).toBeUndefined()
  })

  it('exposes onPlayPolish but no sentence extras for a word with no sentence data', () => {
    // onPlayPolish pronounces the Polish word itself, independent of whether
    // a context sentence exists — matches ActiveSentencePage's existing,
    // unconditional behavior (present for every word, sentence or not).
    const props = useSentenceCardProps(word(), audio())
    expect(props.onPlayPolish).toBeInstanceOf(Function)
    expect(props.frontExtra).toBeUndefined()
    expect(props.backExtra).toBeUndefined()
    expect(props.frontHint).toBeUndefined()
  })

  it('exposes frontExtra and frontHint, but not backExtra, for a word with only a Polish sentence', () => {
    const w = word({ sentencePl: 'On biega codziennie.', audioSentencePl: 'spl.mp3', sentenceAudio: true })
    const props = useSentenceCardProps(w, audio())
    expect(props.frontExtra).toBeDefined()
    expect((props.frontExtra as { props: { text: string } }).props.text).toBe('On biega codziennie.')
    expect(props.backExtra).toBeUndefined()
    expect(props.frontHint).toBe('Powiedz po angielsku całe zdanie. Potem odsłoń.')
  })

  it('exposes backExtra for a word with only an English sentence', () => {
    const w = word({ sentenceEn: 'He runs every day.', audioSentence: 's.mp3', sentenceAudio: true })
    const props = useSentenceCardProps(w, audio())
    expect(props.frontExtra).toBeUndefined()
    expect((props.backExtra as { props: { text: string } }).props.text).toBe('He runs every day.')
  })

  it('exposes both extras for a word with both sentences', () => {
    const w = recorded()
    const props = useSentenceCardProps(w, audio())
    expect(props.frontExtra).toBeDefined()
    expect(props.backExtra).toBeDefined()
  })

  it('shows the sentence text but no play button when the recording does not match it', () => {
    // sentenceAudio false = the mp3 was made for an earlier draft of this
    // sentence. A glyph that plays nothing reads as broken audio, not as
    // content still to come, so it stays off the card.
    const w = recorded({ sentenceAudio: false })
    const props = useSentenceCardProps(w, audio())
    expect((props.frontExtra as { props: { text: string } }).props.text).toBe('On biega.')
    expect((props.frontExtra as { props: { onPlay?: () => void } }).props.onPlay).toBeUndefined()
    expect((props.backExtra as { props: { onPlay?: () => void } }).props.onPlay).toBeUndefined()
  })

  it('keeps the play button on the side that is recorded', () => {
    const w = recorded({ audioSentencePl: undefined })
    const props = useSentenceCardProps(w, audio())
    expect((props.frontExtra as { props: { onPlay?: () => void } }).props.onPlay).toBeUndefined()
    expect((props.backExtra as { props: { onPlay?: () => void } }).props.onPlay).toBeInstanceOf(Function)
  })

  it('onPlayPolish stops current audio and plays the Polish word', () => {
    const a = audio()
    const w = word()
    const props = useSentenceCardProps(w, a)
    props.onPlayPolish!()
    expect(a.stop).toHaveBeenCalledTimes(1)
    expect(a.playWordPl).toHaveBeenCalledWith(w)
  })

  it('the front/back sentence buttons stop current audio and play the matching sentence', () => {
    const a = audio()
    const w = recorded()
    const props = useSentenceCardProps(w, a)

    ;(props.frontExtra as { props: { onPlay: () => void } }).props.onPlay()
    expect(a.stop).toHaveBeenCalledTimes(1)
    expect(a.playSentencePl).toHaveBeenCalledWith(w)

    ;(props.backExtra as { props: { onPlay: () => void } }).props.onPlay()
    expect(a.stop).toHaveBeenCalledTimes(2)
    expect(a.playSentence).toHaveBeenCalledWith(w)
  })
})
