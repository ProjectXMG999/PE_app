import { useEffect } from 'react'
import { subscribeProgress } from '../../services/progressEvents'
import { showAchievementToast } from '../../services/toast'
import type { AchievementState } from '../../services/achievements'
import type { AchievementTier } from '../../data/achievements'

const TIER_RANK: Record<AchievementTier, number> = { bronze: 0, silver: 1, gold: 2, legend: 3 }

/** How soon after a progress write the badges are re-checked. The study clock
 *  writes its ledger every few seconds, so time-based writes get a longer
 *  fuse — nothing about a minutes badge is urgent to the second. */
const DELAY_MS = 900
const DAILY_TIME_DELAY_MS = 15_000

/**
 * A single rated card gets a much longer fuse than a session boundary does.
 *
 * `run()` is expensive — `evaluateAchievementsNow` is a cold
 * `loadProgressSnapshot` plus three more `getAll`s plus a pass over all 834
 * packs and every session. At 900ms it fired once per answered card, because a
 * learner rating a card every ~3s never lands two writes inside the fuse.
 *
 * Deferring costs nothing visible, and that is not a guess: `ToastHost` already
 * refuses to show an achievement toast while a session is running (it filters
 * on `inSession`, keeping everything but `kind: 'note'` queued). So a badge
 * evaluated on card 12 sits in the queue until the session ends anyway. The
 * expensive mid-session evaluation was buying a celebration nobody could see.
 *
 * What makes the long fuse safe is `schedule`'s earliest-deadline rule below:
 * finishing or abandoning a session emits `'session'` (via `saveSession`),
 * which pulls the timer back in to DELAY_MS. So the badge still lands about a
 * second after the session ends — exactly when the toast would have surfaced.
 */
const WORD_DELAY_MS = 20_000

/** Of several badges earned at once, the one to headline: highest tier, then
 *  the hardest threshold within it. */
function headline(fresh: AchievementState[]): AchievementState {
  return [...fresh].sort((a, b) =>
    TIER_RANK[b.achievement.tier] - TIER_RANK[a.achievement.tier]
    || b.achievement.threshold - a.achievement.threshold
  )[0]
}

/**
 * Notices badges the moment they're earned, anywhere in the app.
 *
 * Badges used to be evaluated only when the Postęp page was open, so earning
 * one was silent: it just appeared, dated, the next time you looked. This
 * re-evaluates after progress writes and announces what's new.
 *
 * "New" means new to this run of the app. The first pass at boot only records
 * — whatever is already earned by then (from before this feature, or merged in
 * from another device on sign-in) is marked in the cabinet, not trumpeted.
 * Several badges in one moment become one notice, not a queue of them.
 */
export function AchievementWatcher() {
  useEffect(() => {
    let alive = true
    let primed = false
    let running = false
    let again = false
    let timer: number | null = null
    let due = Infinity
    const announced = new Set<string>()

    async function run() {
      if (running) { again = true; return }
      running = true
      try {
        // Loaded on first use: badge evaluation (and everything it reads)
        // stays out of the startup bundle.
        const { evaluateAchievementsNow } = await import('../../hooks/useAchievements')
        const { states } = await evaluateAchievementsNow()
        if (!alive) return

        const fresh: AchievementState[] = []
        for (const s of states) {
          const id = s.achievement.id
          // A reset can lock a badge again; forget it so re-earning it counts.
          if (!s.unlocked) { announced.delete(id); continue }
          if (!announced.has(id)) {
            announced.add(id)
            if (primed) fresh.push(s)
          }
        }
        primed = true

        if (fresh.length > 0) {
          showAchievementToast(headline(fresh).achievement, fresh.length - 1)
        }
      } catch (err) {
        console.error('[achievements] watcher failed:', err)
      } finally {
        running = false
        if (again && alive) { again = false; void run() }
      }
    }

    // Keeps the earliest pending deadline: a word write after a clock write
    // should be checked soon, not pushed back to the clock's longer fuse.
    function schedule(delay: number) {
      const at = Date.now() + delay
      if (timer != null && at >= due) return
      if (timer != null) window.clearTimeout(timer)
      due = at
      timer = window.setTimeout(() => { timer = null; due = Infinity; void run() }, delay)
    }

    void run()
    const unsubscribe = subscribeProgress(kind => {
      // A reset is a bulk rewrite — a progress wipe, or a sign-in merging
      // another device's history. Re-baseline silently instead of announcing
      // every badge that history happens to contain.
      if (kind === 'reset') primed = false
      schedule(
        kind === 'word' ? WORD_DELAY_MS
        : kind === 'dailyTime' ? DAILY_TIME_DELAY_MS
        : DELAY_MS
      )
    })

    return () => {
      alive = false
      unsubscribe()
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  return null
}
