import { Word } from '../types/vocabulary'

/**
 * Czy dla tego słowa da się odtworzyć zdanie — jedno źródło prawdy dla całej
 * aplikacji.
 *
 * Sam tekst zdania to za mało. Zdania bywają przepisywane niezależnie od
 * nagrań, a pliki zachowują nazwy, więc dopiero `sentenceAudio` mówi, że mp3
 * pasuje do AKTUALNEJ treści (patrz Word.sentenceAudio). Dziś to dotyczy
 * większości bazy: poziom 1 ma nagrania odflagowane jako nieaktualne, poziomy
 * 3-4 nie mają ich wcale — a tekst zdania jest wszędzie.
 *
 * Bez tego testu UI obiecywał dźwięk, którego nie ma: przycisk głośnika nic nie
 * robił, a autoodtwarzanie trzymało kilkusekundową ciszę w miejscu zdania.
 */
export function hasSentenceAudioEn(word: Word | null | undefined): boolean {
  return !!(word?.sentenceEn && word.audioSentence && word.sentenceAudio)
}

export function hasSentenceAudioPl(word: Word | null | undefined): boolean {
  return !!(word?.sentencePl && word.audioSentencePl && word.sentenceAudio)
}

/** Dowolne zdanie (PL lub EN) z ważnym nagraniem. */
export function hasAnySentenceAudio(word: Word | null | undefined): boolean {
  return hasSentenceAudioEn(word) || hasSentenceAudioPl(word)
}
