import { useCallback, useEffect, useRef } from 'react'
import { addStudyTime, flush, milestoneMessage, todayProgress, Milestone } from '../services/dailyTime'
import { showToast } from '../services/toast'

async function announce(m: Milestone | null): Promise<void> {
  if (m == null) return
  const { secondsStudied, goalSec } = await todayProgress()
  const { text, icon, celebrate } = milestoneMessage(m, secondsStudied, goalSec)
  showToast(text, { icon, celebrate })
}

/**
 * Measures wall-clock time spent on a study page.
 *
 * Serves two purposes at once:
 *  - `elapsedSec()` gives the session its `durationSec`, replacing the
 *    words × 8 s guess the app used to display as "minutes studied";
 *  - each tick feeds the daily ledger, so time survives a session the user
 *    abandons halfway (sessions themselves only persist when a pack ends).
 *
 * The clock pauses when the tab is hidden — a phone in a pocket with the screen
 * off shouldn't quietly accrue an hour of "study". Autoplay that keeps running
 * under a locked screen is the deliberate exception, hence `countWhileHidden`.
 */
export function useStudyClock(options: {
  /** Keep counting while the tab is hidden (audio-only listening modes). */
  countWhileHidden?: boolean
} = {}) {
  const { countWhileHidden = false } = options

  const elapsedRef = useRef(0)
  const hiddenRef = useRef(countWhileHidden)
  hiddenRef.current = countWhileHidden

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!hiddenRef.current && document.visibilityState === 'hidden') return
      elapsedRef.current += 1
      addStudyTime(1).then(announce)
    }, 1000)

    // A backgrounded tab can be frozen or killed without unmounting, so write
    // what we have the moment the page goes away.
    const onHide = () => { void flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      void flush()
    }
  }, [])

  /** Seconds counted so far in this session. */
  const elapsedSec = useCallback(() => elapsedRef.current, [])

  return { elapsedSec }
}
