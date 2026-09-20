import { WordProgress } from '../types/progress'
import { SmartSegment } from './smartQueue'
import { dayKey, daysBetween } from '../utils/day'

/**
 * What a sitting actually CHANGED, as opposed to what it consisted of.
 *
 * The done screen used to report the session's composition — cards answered,
 * times "Znam" was tapped — which is a description of the last ten minutes, not
 * of any progress. In a spaced-repetition app the thing that moves is the
 * SCHEDULE: every answer rewrites when the word comes back and how strongly it
 * is held. `applyKnown`/`applyUnknown` compute exactly that on every card and
 * the runner then dropped it on the floor, keeping two integers per segment.
 *
 * This module is the memory of it. Pure and synchronous: `record` folds one
 * before/after pair into a `CardOutcome`, `summarize` turns the run's outcomes
 * into the numbers the screen draws. Nothing here is persisted — it describes
 * one sitting, and the durable record is the WordProgress rows themselves.
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
  /** How many days the word was LAST scheduled across — the interval it had
   *  been holding for. Null when it had no schedule to compare against (a word
   *  being met for the first time, or a pre-FSRS row with no date). */
  intervalBefore: number | null
  /** Days until it is due again after this answer. Null when it is no longer
   *  scheduled at all. */
  intervalAfter: number | null
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

  // The interval it HAD been holding: scheduled date minus the day it was last
  // answered. Measuring from today instead would report how overdue the word
  // was, which is a fact about the queue rather than about the memory.
  const intervalBefore =
    before?.nextReviewAt && before.lastSeen
      ? Math.max(0, daysBetween(dayKey(new Date(before.lastSeen)), before.nextReviewAt))
      : null

  const intervalAfter = after.nextReviewAt
    ? Math.max(0, daysBetween(today, after.nextReviewAt))
    : null

  return { segment, transition, intervalBefore, intervalAfter }
}

/** Where a next-review distance falls on the strip. Open-ended at the top:
 *  a durable word in deep maintenance is a year out and must not widen the
 *  scale for everything else. */
export const HORIZON_BUCKETS: { maxDays: number; label: string }[] = [
  { maxDays: 2, label: '1–2 dni' },
  { maxDays: 7, label: '3–7 dni' },
  { maxDays: 30, label: '2–4 tyg.' },
  { maxDays: 180, label: '1–6 mies.' },
  { maxDays: Infinity, label: 'dłużej' },
]

/** Scheduled words needed before the strip says anything worth drawing. */
const MIN_HORIZON_CARDS = 4
/** Words carrying a previous schedule needed before the shift line is honest. */
const MIN_SHIFT_SAMPLES = 3

export interface SmartOutcome {
  /** Cards answered — the run's size, transitions and all. */
  total: number
  transitions: Record<Transition, number>
  /** One count per HORIZON_BUCKETS entry, same order. */
  horizon: number[]
  /**
   * Typical days-to-return before this sitting and after it, or null when too
   * few words carried a previous schedule to compare honestly.
   *
   * Median, not mean: one word graduating into deep maintenance sits a year
   * out and would drag an average somewhere no actual word is.
   */
  shift: { before: number; after: number } | null
  /**
   * Whether the strip is worth drawing. A sitting of nothing but first-time
   * words schedules them all at nearly the same distance, so the "distribution"
   * is one tall bar — a chart of a fact the sentence above it already stated.
   */
  showHorizon: boolean
}

const EMPTY_TRANSITIONS = (): Record<Transition, number> =>
  ({ entered: 0, held: 0, slipped: 0, met: 0 })

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function bucketOf(days: number): number {
  const i = HORIZON_BUCKETS.findIndex(b => days <= b.maxDays)
  return i === -1 ? HORIZON_BUCKETS.length - 1 : i
}

export function summarize(outcomes: CardOutcome[]): SmartOutcome {
  const transitions = EMPTY_TRANSITIONS()
  const horizon = HORIZON_BUCKETS.map(() => 0)
  const before: number[] = []
  const after: number[] = []

  for (const o of outcomes) {
    transitions[o.transition]++
    if (o.intervalAfter == null) continue
    horizon[bucketOf(o.intervalAfter)]++
    // Paired on purpose: the sentence compares the SAME words to themselves, so
    // a word with no previous schedule contributes to neither side of it.
    if (o.intervalBefore != null) {
      before.push(o.intervalBefore)
      after.push(o.intervalAfter)
    }
  }

  const scheduled = horizon.reduce((a, b) => a + b, 0)
  const occupied = horizon.filter(n => n > 0).length
  const shift = before.length >= MIN_SHIFT_SAMPLES
    ? { before: median(before), after: median(after) }
    : null

  return {
    total: outcomes.length,
    transitions,
    horizon,
    // A shift of "8 → 8" is a sentence saying nothing; drop it rather than
    // dress it up.
    shift: shift && shift.before !== shift.after ? shift : null,
    showHorizon: scheduled >= MIN_HORIZON_CARDS && occupied >= 2,
  }
}
