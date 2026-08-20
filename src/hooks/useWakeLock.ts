import { useEffect, useRef } from 'react'

// Keeps the screen awake while `active` — the autoplay sequence dies with the
// screen on iOS, and Android dims mid-pack otherwise. Silent no-op where
// unsupported (iOS < 16.4). No React state: nothing renders from this.
//
// Note: this only prevents the screen from dimming/locking on its own. It does
// NOT keep audio alive once the user manually presses the power button — the
// sentinel releases immediately in that case (see release listener below) and
// there is nothing JS can do to stop that. Background playback past a manual
// lock depends entirely on Media Session + the browser's own audio session,
// not on wake lock.
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
        console.log('[wakelock] acquired')
        sentinel.addEventListener('release', () => {
          console.log('[wakelock] released, visibility=', document.visibilityState)
        })
      } catch {
        // NotAllowedError on low battery / unsupported — screen just dims normally
        console.log('[wakelock] request denied or unsupported')
      }
    }

    // The sentinel auto-releases when the tab hides — re-acquire on return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinelRef.current?.release().catch(() => {})
      sentinelRef.current = null
    }
  }, [active])
}
