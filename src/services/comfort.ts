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
}

/**
 * Whether to show the "you're doing great — raise your default level?" prompt,
 * and to which level. Deliberately cautious: needs a real streak, comfort a
 * full level above the floor, some proof of mastery at the current floor, and
 * respects a "Jeszcze nie" for a cooldown window.
 */
export function shouldPromptLevelUp(args: LevelUpArgs): { target: number } | null {
  const { comfortLevel, strongStreak, todayLevel, levelUpPrompt, masteredPacksAtFloor } = args
  const floor = todayLevel ?? 1
  const target = Math.min(4, Math.round(comfortLevel))

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
