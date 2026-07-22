import { useEffect, useRef } from 'react'

// Keeps the screen awake while `active` — the autoplay sequence dies with the
// screen on iOS, and Android dims mid-pack otherwise. Silent no-op where
// unsupported (iOS < 16.4). No React state: nothing renders from this.
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
