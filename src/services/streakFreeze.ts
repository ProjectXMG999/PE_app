import { getAllSessions } from './db'
import { useAppStore, STREAK_FREEZE_INTERVAL_DAYS } from '../store/useAppStore'
import { dayKey, daysBetween, shiftDay } from '../utils/day'

/**
 * Streak freezes.
 *
 * A streak is the single strongest reason people come back, and also the most
 * brittle: one busy day resets it to zero, and a surprising number of users
 * simply never return after that. A freeze absorbs exactly one missed day so a
 * long run survives real life.
 *
 * It stays honest about it — the frozen day is marked ❄ on the heatmap rather
 * than shown as study, and `getStreak` still only counts days actually worked.
 */

/** Only a run worth protecting gets protected. */
const MIN_STREAK_TO_PROTECT = 3

/** Tops the freeze back up once the interval has passed. Max one in reserve. */
export function maybeGrantFreeze(today = dayKey()): void {
  const { streakFreeze, grantStreakFreeze } = useAppStore.getState()

  if (streakFreeze.available >= 1) return
  if (streakFreeze.lastGrantedAt == null) {
    grantStreakFreeze(today)
    return
  }
  if (daysBetween(streakFreeze.lastGrantedAt, today) >= STREAK_FREEZE_INTERVAL_DAYS) {
    grantStreakFreeze(today)
  }
}

/**
 * Spends a freeze on yesterday if skipping it would break a streak worth
 * keeping. Runs on boot, so the save happens the next time the app is opened —
 * which is precisely the moment the user would otherwise see a zero.
 */
export async function maybeSpendFreeze(today = dayKey()): Promise<void> {
  const state = useAppStore.getState()
  const { streakFreeze, spendStreakFreeze } = state

  if (streakFreeze.available < 1) return

  const yesterday = shiftDay(-1, today)
  if (streakFreeze.usedOn.includes(yesterday)) return

  const sessions = await getAllSessions()
  if (sessions.length === 0) return

  const studied = new Set(sessions.map(s => s.date))
  // Nothing to rescue: either yesterday was worked, or today already restarted
  // the run and the gap no longer matters.
  if (studied.has(yesterday)) return

  // How long was the run that ended before yesterday? Only protect a real one.
  const frozen = new Set(streakFreeze.usedOn)
  let cursor = shiftDay(-1, yesterday)
  let run = 0
  while (studied.has(cursor) || frozen.has(cursor)) {
    if (studied.has(cursor)) run++
    cursor = shiftDay(-1, cursor)
  }

  if (run >= MIN_STREAK_TO_PROTECT) {
    spendStreakFreeze(yesterday)
  }
}

/** Boot-time upkeep: rescue a broken streak first, then replenish. */
export async function runStreakFreezeUpkeep(): Promise<void> {
  const today = dayKey()
  await maybeSpendFreeze(today)
  maybeGrantFreeze(today)
}
