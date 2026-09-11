/**
 * Polish typesetting helpers.
 *
 * The rule this exists for: in Polish, a one-letter word (a, i, o, u, w, z)
 * must never be left at the end of a line. Nothing in CSS does that — it needs
 * a non-breaking space in the string itself — and it is the single most
 * visible difference between text that was typeset and text that was pasted.
 */

const ORPHAN_RE = /(^|[\s(„”"'—–-])([aiouwzAIOUWZ])\s+/g

const NBSP = ' '

/** Glue single-letter Polish words to the word that follows them. */
export function noOrphans(text: string): string {
  return text.replace(ORPHAN_RE, `$1$2${NBSP}`)
}
