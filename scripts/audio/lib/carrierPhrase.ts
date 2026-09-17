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
 * ("Prison break") as one contiguous span. */
export function extractWordSpan(fullText: string, word: string, alignment: Alignment, marginSec = 0.03): { startSec: number; endSec: number } {
  const idx = fullText.indexOf(word)
  if (idx === -1) throw new Error(`extractWordSpan: "${word}" not found in carrier text "${fullText}"`)
  const startChar = idx
  const endChar = idx + word.length - 1
  if (endChar >= alignment.character_start_times_seconds.length) {
    throw new Error(`extractWordSpan: char index ${endChar} out of range for alignment of length ${alignment.characters.length}`)
  }
  const startSec = Math.max(0, alignment.character_start_times_seconds[startChar] - marginSec)
  const endSec = alignment.character_end_times_seconds[endChar] + marginSec
  return { startSec, endSec }
}
