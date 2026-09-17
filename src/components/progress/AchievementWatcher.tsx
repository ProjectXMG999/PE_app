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
      schedule(kind === 'dailyTime' ? DAILY_TIME_DELAY_MS : DELAY_MS)
    })

    return () => {
      alive = false
      unsubscribe()
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  return null
}
