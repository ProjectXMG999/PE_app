import { daysBetween, dayKey } from '../utils/day'

/**
 * Adaptive difficulty — the "comfort level".
 *
 * A single scalar (1.0–4.9) that tracks how hard the material *should* feel for
 * this learner right now. It moves proportionally with how a rated Trenuj
 * session went: lots of "Znam" nudges it up, lots of "Nie znam" nudges it down.
 * The Inteligentny mode reads it to decide whether to weave in "stretch" words
 * from a harder pack, and a sustained run of strong sessions triggers the
 * "raise your default level?" prompt.
 *
 * Everything tunable lives in COMFORT so there's one place to adjust the feel.
 */
export const COMFORT = {
  /** Success ratio the loop aims to keep the learner at (0..1). */
  TARGET: 0.8,
  /** How hard a single session pulls comfort toward its own ratio. */
  GAIN: 1.0,
  /** Cap on how far one session can move comfort. */
  MAX_STEP: 0.3,
  /** Sessions shorter than this don't carry enough signal to count. */
  MIN_RATED: 5,
  /** Ratio at/above which a session counts as "strong" for the streak. */
  STRONG_RATIO: 0.85,
  /** Comfort must lead the current pack level by this much to add stretch. */
  STRETCH_MARGIN: 0.6,
  MIN: 1.0,
  MAX: 4.9,
  /** Consecutive strong sessions before the level-up prompt may fire. */
  STRONG_STREAK_FOR_PROMPT: 3,
  /** Wait this long before re-asking after a "Jeszcze nie". */
  PROMPT_COOLDOWN_DAYS: 14,
  /** Packs already mastered at the current floor level before we suggest moving. */
  MASTERED_PACKS_FOR_PROMPT: 2,
} as const

/* ── Moving up a level: two switches ─────────────────────────────────────────
 *
 * The app raises difficulty by itself in exactly two ways, and these turn them
 * off independently. Both are OFF for now, by request: the level moves only
 * when the learner moves it, with the pill on Dzisiaj.
 *
 * LEVEL_UP_PROMPT_ENABLED   the "Podnieść poziom?" sheet — the only thing that
 *                           ever writes todayLevel without a tap on the pill.
 *                           Read by shouldPromptLevelUp below, so both of its
 *                           call sites (Dzisiaj and the end of an Inteligentny
 *                           sitting) are covered by the one switch.
 * LEVEL_STRETCH_ENABLED     the stretch stream inside a sitting (selectSmart,
 *                           smartQueue.ts): ~20% of the cards drawn from a pack
 *                           one level up. It never touches todayLevel, but it
 *                           is the one a learner actually feels.
 *
 * Neither touches updateComfort or strongStreakNext — comfort and the streak go
 * on being measured, so the fit meter on the done screen still tells the truth,
 * and flipping a switch back on takes effect against real history instead of
 * starting from zero. Both gates are parameters with these as their defaults,
 * so flipping a switch needs no change to the tests that cover the rules.
 */
export const LEVEL_UP_PROMPT_ENABLED = false
export const LEVEL_STRETCH_ENABLED = false

export interface LevelUpPromptState {
  dismissedForLevel: number | null
  /** Local-calendar day key (see utils/day.ts `dayKey`) — the cooldown check
   *  below does day arithmetic on it, not a full ISO timestamp. */
  lastShownAt: string | null
}

export interface SessionOutcome {
  ratedCount: number
  knownHitCount: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Ratio of a session, or null when it's too short to read anything into. */
export function sessionRatio(s: SessionOutcome): number | null {
  if (s.ratedCount < COMFORT.MIN_RATED) return null
  return s.knownHitCount / s.ratedCount
}

/**
 * New comfort level after a rated session. Sessions below MIN_RATED leave it
 * untouched — a two-card session says nothing about difficulty fit.
 */
export function updateComfort(prev: number, s: SessionOutcome): number {
  const ratio = sessionRatio(s)
  if (ratio == null) return prev
  const delta = clamp((ratio - COMFORT.TARGET) * COMFORT.GAIN, -COMFORT.MAX_STEP, COMFORT.MAX_STEP)
  return clamp(prev + delta, COMFORT.MIN, COMFORT.MAX)
}

/**
 * Next value of the consecutive-strong-sessions counter. A short session is
 * neutral (streak unchanged); a rated-but-weak session resets it to 0.
 */
export function strongStreakNext(prevStreak: number, s: SessionOutcome): number {
  const ratio = sessionRatio(s)
  if (ratio == null) return prevStreak
  return ratio >= COMFORT.STRONG_RATIO ? prevStreak + 1 : 0
}

export interface LevelUpArgs {
  comfortLevel: number
  strongStreak: number
  todayLevel: number | null
  levelUpPrompt: LevelUpPromptState
  /** Packs with masteredAt whose pack level equals the current floor level. */
  masteredPacksAtFloor: number
  /** Defaults to today; injectable for tests. */
  now?: Date
  /** Defaults to LEVEL_UP_PROMPT_ENABLED. Passed explicitly by the tests that
   *  cover the rule itself, so the switch can be flipped without touching them. */
  enabled?: boolean
}

/**
 * Whether to show the "you're doing great — raise your default level?" prompt,
 * and to which level. Deliberately cautious: needs a real streak, comfort a
 * full level above the floor, some proof of mastery at the current floor, and
 * respects a "Jeszcze nie" for a cooldown window.
 *
 * Returns null outright while the LEVEL_UP_PROMPT_ENABLED switch is off, which
 * is the state it ships in today — the rules below are kept whole for the day
 * it goes back on.
 */
export function shouldPromptLevelUp(args: LevelUpArgs): { target: number } | null {
  const {
    comfortLevel, strongStreak, todayLevel, levelUpPrompt, masteredPacksAtFloor,
    enabled = LEVEL_UP_PROMPT_ENABLED,
  } = args
  const floor = todayLevel ?? 1
  const target = Math.min(4, Math.round(comfortLevel))

  if (!enabled) return null
  if (target <= floor) return null
  if (strongStreak < COMFORT.STRONG_STREAK_FOR_PROMPT) return null
  if (comfortLevel < floor + 1) return null
  if (masteredPacksAtFloor < COMFORT.MASTERED_PACKS_FOR_PROMPT) return null

  if (levelUpPrompt.dismissedForLevel === target) {
    if (levelUpPrompt.lastShownAt == null) return null
    const nowKey = dayKey(args.now ?? new Date())
    if (daysBetween(levelUpPrompt.lastShownAt, nowKey) < COMFORT.PROMPT_COOLDOWN_DAYS) return null
  }

  return { target }
}

/* ── Fit: comfort as something a learner can read ───────────────────────────
 *
 * `comfortLevel` is the setpoint of a feedback loop, not a score. Shown raw it
 * was a number on an unexplained 1.0–4.9 scale that could go DOWN after a hard
 * session — which reads as a demotion, collides with the app's own "poziom"
 * 1–4, and carries a decimal place the signal doesn't support (a session of
 * MIN_RATED cards moves its ratio in steps of 0.2).
 *
 * What is actually legible is the DISTANCE between comfort and the level being
 * studied, because that distance is what the engine acts on. Every boundary
 * below is a real threshold, not a round number picked for the UI:
 *
 *   level − MAX_STEP   one session's worth of movement below the material
 *   level + MAX_STEP   …and above it: inside this band nothing changes
 *   level + STRETCH_MARGIN   selectSmart starts weaving in harder words
 *   level + 1          shouldPromptLevelUp's own floor for offering a move up
 */

export type ComfortFit = 'demanding' | 'matched' | 'easy' | 'stretching' | 'ready'

/** Ordered easiest-fit-last, so a meter can render position directly. */
export const COMFORT_FIT_ORDER: ComfortFit[] = [
  'demanding', 'matched', 'easy', 'stretching', 'ready',
]

/**
 * Where the learner sits relative to the level they're working at.
 *
 * `level` is the floor they chose (todayLevel), which is the same anchor
 * shouldPromptLevelUp uses — so "ready" here and the prompt firing cannot
 * disagree about which level is in question.
 */
export function comfortFit(comfort: number, level: number): ComfortFit {
  const d = comfort - level
  if (d < -COMFORT.MAX_STEP) return 'demanding'
  if (d < COMFORT.MAX_STEP) return 'matched'
  if (d < COMFORT.STRETCH_MARGIN) return 'easy'
  if (d < 1) return 'stretching'
  return 'ready'
}
