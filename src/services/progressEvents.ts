/**
 * A micro event bus for "the user's progress just changed".
 *
 * Deliberately imports nothing: `db.ts` emits from inside its write functions,
 * and hooks that cache derived progress (the always-mounted TopBar/Sidebar
 * widget, `useProgressData`) subscribe. Importing either side from the other
 * would create a cycle, so both depend on this leaf module instead.
 *
 * The widget lives in AppShell — i.e. on every screen — so it caches its numbers
 * for a minute rather than re-reading all sessions and every wordProgress row on
 * each navigation. These events are what let it do that without going stale.
 */

export type ProgressEventKind = 'session' | 'word' | 'package' | 'dailyTime' | 'reviewLedger' | 'reset'

type Listener = (kind: ProgressEventKind) => void

const listeners = new Set<Listener>()

/** Subscribes to progress writes. Returns an unsubscribe function. */
export function subscribeProgress(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Notifies every subscriber. One throwing listener must not silence the rest. */
export function emitProgress(kind: ProgressEventKind): void {
  for (const fn of listeners) {
    try {
      fn(kind)
    } catch (err) {
      console.error('[progressEvents] listener failed:', err)
    }
  }
}
