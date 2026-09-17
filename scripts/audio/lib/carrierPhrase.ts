import { Alignment } from './elevenLabsClient.js'

export const CARRIER_TEMPLATES = {
  en: (word: string) => `The word is ${word}.`,
  pl: (word: string) => `Słowo: ${word}.`,
}

/** Locates `word`'s character span within `fullText` (the exact carrier
 * string sent to the API) and maps it onto the per-character alignment
 * arrays /with-timestamps returns, so the caller can cut just that word out
 * of the generated audio. Pure string/array logic — deterministic, testable
 * without any network or audio dependency. Handles multi-word phrases
 * ("Prison break") as one contiguous span.
 *
 * Margins are asymmetric and larger than a first guess: real-listener
 * feedback on the first round (12-word sample) was that the cut started
 * slightly late (clipping the word's onset) and ended too abruptly. The
 * alignment's own start/end timestamps run a little tight against the
 * actual audible sound, so we pull the start back further than the end is
 * pushed forward, and lean on a longer fade-out (ffmpegPost.ts) rather than
 * a huge end margin, which would risk bleeding into the carrier's period. */
export function extractWordSpan(fullText: string, word: string, alignment: Alignment, startMarginSec = 0.07, endMarginSec = 0.09): { startSec: number; endSec: number } {
  const idx = fullText.indexOf(word)
  if (idx === -1) throw new Error(`extractWordSpan: "${word}" not found in carrier text "${fullText}"`)
  const startChar = idx
  const endChar = idx + word.length - 1
  if (endChar >= alignment.character_start_times_seconds.length) {
    throw new Error(`extractWordSpan: char index ${endChar} out of range for alignment of length ${alignment.characters.length}`)
  }
  const startSec = Math.max(0, alignment.character_start_times_seconds[startChar] - startMarginSec)
  const endSec = alignment.character_end_times_seconds[endChar] + endMarginSec
  return { startSec, endSec }
}
