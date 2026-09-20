import { WordProgress } from '../types/progress'
import { SmartSegment } from './smartQueue'
import { dayKey, daysBetween } from '../utils/day'

/**
 * What a sitting actually CHANGED, as opposed to what it consisted of.
 *
 * The done screen used to report the session's composition — cards answered,
 * times "Znam" was tapped — which describes the last ten minutes, not any
 * progress. `applyKnown`/`applyUnknown` compute the real change on every card
 * (memory strength and the next date) and the runner dropped it on the floor,
 * keeping two integers per segment.
 *
 * Pure and synchronous: `record` folds one before/after pair into a
 * `CardOutcome`, `summarize` turns the run's outcomes into the two facts the
 * screen states. Nothing here is persisted — it describes one sitting, and the
 * durable record is the WordProgress rows themselves.
 *
 * What this module deliberately does NOT do is compare a word's old interval to
 * its new one and call the difference a cadence. FSRS intervals expand after
 * every successful review, so a word was never "on a 15-day cycle" — it had a
 * 15-day gap behind it and a 104-day one ahead. Phrasing that as "trzeba było
 * powtarzać co 15 dni — teraz wystarczy raz na 104 dni" described a schedule
 * the scheduler does not run.
 */

/**
 * What happened to one word, in the only terms that mean anything to a learner.
 *
 * Deliberately not "correct/incorrect". `status: 'known'` is permanent (see the
 * note in types/progress.ts), so the interesting event is a CROSSING — a word
 * entering circulation, or an already-learned one being confirmed or slipping
 * back into the queue. A new word that didn't stick yet is its own, entirely
 * ordinary outcome: it was met, and it will be back.
 */
export type Transition = 'entered' | 'held' | 'slipped' | 'met'

export interface CardOutcome {
  segment: SmartSegment
  transition: Transition
  /**
   * Memory strength after the answer, in days — FSRS `stability`, i.e. how long
   * the word can now go before recall drops to the target. Null when the word
   * carries no reading (a pre-FSRS row the scheduler hasn't migrated).
   *
   * Stability rather than "days until the next review": the two are within ~10%
   * of each other, but only one of them is a property of the MEMORY. The screen
   * reports levels, so it reads the level.
   */
  memoryDays: number | null
}

/**
 * Folds one answered card into an outcome.
 *
 * `before` is the WordProgress as it stood when the card was drawn, `after` is
 * what `applyKnown`/`applyUnknown` returned. Both are already in hand at the
 * call site; nothing is re-read or recomputed.
 */
export function record(args: {
  segment: SmartSegment
  before: WordProgress | undefined
  after: WordProgress
  recalled: boolean
  today?: string
}): CardOutcome {
  const { segment, before, after, recalled } = args
  const today = args.today ?? dayKey()
  const wasKnown = before?.status === 'known'

  const transition: Transition = wasKnown
    ? recalled ? 'held' : 'slipped'
    : after.status === 'known' ? 'entered' : 'met'

  // Falls back to the scheduled gap for a row with no stability: the legacy
  // interval ladder is a decent proxy, and a word with neither is simply
  // unplaceable and says so with null.
  const memoryDays = after.stability
    ?? (after.nextReviewAt ? Math.max(0, daysBetween(today, after.nextReviewAt)) : null)

  return { segment, transition, memoryDays }
}

/**
 * The memory-strength tiers the screen reports, weakest first.
 *
 * Fixed boundaries, never rescaled to the sitting: the whole value of this
 * breakdown is watching words climb out of the left-hand tiers over weeks, and
 * a scale that redrew itself each session would hide exactly that.
 *
 * `range` is shown under the name because the names alone are relative —
 * "mocne" means nothing until you know it is months rather than days.
 */
export const MEMORY_LEVELS: { maxDays: number; label: string; range: string }[] = [
  { maxDays: 2, label: 'świeże', range: 'do 2 dni' },
  { maxDays: 7, label: 'młode', range: '3–7 dni' },
  { maxDays: 30, label: 'okrzepłe', range: '1–4 tyg.' },
  { maxDays: 180, label: 'mocne', range: '1–6 mies.' },
  { maxDays: Infinity, label: 'trwałe', range: 'pół roku+' },
]

/** Placed words needed before the breakdown says anything worth drawing. */
const MIN_PLACED_CARDS = 4

const EMPTY_TRANSITIONS = (): Record<Transition, number> =>
  ({ entered: 0, held: 0, slipped: 0, met: 0 })

export interface SmartOutcome {
  /** Cards answered — the run's size, transitions and all. */
  total: number
  transitions: Record<Transition, number>
  /** One count per MEMORY_LEVELS entry, same order. */
  levels: number[]
  /**
   * Whether the breakdown is worth drawing. A sitting of nothing but first-time
   * words lands them all in one tier, so the "distribution" is a single bar —
   * a chart of a fact the tiles above already stated.
   */
  showLevels: boolean
}

function levelOf(days: number): number {
  const i = MEMORY_LEVELS.findIndex(b => days <= b.maxDays)
  return i === -1 ? MEMORY_LEVELS.length - 1 : i
}

export function summarize(outcomes: CardOutcome[]): SmartOutcome {
  const transitions = EMPTY_TRANSITIONS()
  const levels = MEMORY_LEVELS.map(() => 0)
  let placed = 0

  for (const o of outcomes) {
    transitions[o.transition]++
    if (o.memoryDays == null) continue
    levels[levelOf(o.memoryDays)]++
    placed++
  }

  return {
    total: outcomes.length,
    transitions,
    levels,
    showLevels: placed >= MIN_PLACED_CARDS && levels.filter(n => n > 0).length >= 2,
  }
}

/**
 * Does this sitting get to pass judgement on DIFFICULTY?
 *
 * The mode keeps two adaptive signals (see `foldSignals` in SmartSessionPage)
 * and comfort — the one the done screen's band reports — is folded from
 * learn + stretch alone. After a review-only sitting it has not moved, so
 * showing its band prints a reading taken on some earlier day directly beneath
 * this sitting's results, where it is read as a verdict on them. That is how a
 * session of eight words held came to be captioned "Ten materiał daje Ci w
 * kość", about material the sitting never touched.
 *
 * No verdict costs the learner nothing; a stale one contradicts the numbers
 * above it.
 */
export function judgesDifficulty(newRated: number): boolean {
  return newRated > 0
}
