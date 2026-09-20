import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, supabaseEnabled } from '../services/supabaseClient'
import { EntitlementStatus } from '../types/entitlement'
import { pullAndMergeProgress } from '../services/progressSync'
import { showToast } from '../services/toast'
import { claimProgressFor } from '../services/db'

interface AuthStore {
  user: User | null
  accessToken: string | null
  authLoading: boolean
  entitlementStatus: EntitlementStatus
  setSession: (s: Session | null) => void
  setEntitlementStatus: (s: EntitlementStatus) => void
  hasAccess: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  authLoading: true,
  entitlementStatus: 'loading',
  setSession: (s) => set({ user: s?.user ?? null, accessToken: s?.access_token ?? null, authLoading: false }),
  setEntitlementStatus: (s) => set({ entitlementStatus: s }),
  hasAccess: () => get().entitlementStatus === 'active',
}))

/**
 * Last known entitlement, per user, so a failed check doesn't cost a subscriber
 * their access.
 *
 * Not a security boundary and not pretending to be one: the client was never
 * the gate. Pack content comes from an authenticated function that answers 402
 * on its own, so the worst this can do is show a paying user the app they've
 * paid for while their connection is down — and the worst *not* having it does
 * is bounce them to the upgrade page on a train.
 */
const LAST_STATUS_KEY = 'pe:entitlement'

function rememberStatus(userId: string, status: EntitlementStatus) {
  try { localStorage.setItem(LAST_STATUS_KEY, JSON.stringify({ userId, status })) } catch { /* private mode */ }
}

function recallStatus(userId: string): EntitlementStatus | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_STATUS_KEY) ?? 'null')
    return saved?.userId === userId ? (saved.status as EntitlementStatus) : null
  } catch { return null }
}

/**
 * How long to wait for Supabase before deciding without it.
 *
 * This is the load-bearing number, and the reason the try/catch around these
 * calls wasn't enough on its own: supabase-js **retries a failed request
 * instead of rejecting**. With the API unreachable — a phone on a dead
 * connection, a blocked request, an outage — `getSession()` and the entitlement
 * query never settle at all, so no `catch` ever runs, `authLoading` and
 * `entitlementStatus` both stay at their initial values, and RequireEntitlement
 * renders a bare spinner on an empty page. Forever. Every pack, every study
 * mode, the review and the smart session sit behind that gate, which is exactly
 * the "nothing loads" the app was reported with — and reproduced here: a stored
 * session plus an unreachable API gives a blank screen with a spinner and no
 * text on it at all.
 *
 * Five seconds is long enough that a slow-but-alive connection still answers
 * for real, and short enough that a dead one doesn't take the app with it.
 */
const SUPABASE_TIMEOUT_MS = 5000

// PromiseLike, not Promise: a PostgREST query builder is a thenable that only
// becomes a request when awaited, and it has no .catch of its own.
function withTimeout<T>(work: PromiseLike<T>, label: string): Promise<T> {
  let timer = 0
  return Promise.race([
    Promise.resolve(work),
    new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error(`${label} timed out after ${SUPABASE_TIMEOUT_MS}ms`)),
        SUPABASE_TIMEOUT_MS
      )
    }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * Resolve this user's entitlement — and resolve it to *something*, always.
 *
 * The status starts at 'loading', and RequireEntitlement renders a spinner for
 * exactly as long as it stays there. So every path out of this function has to
 * end in a terminal status: before, a Supabase client that failed to load
 * returned early, and a query that threw (offline, a 4xx, a blocked request)
 * rejected out of here — in both cases leaving 'loading' set forever. The
 * symptom is the whole product: every study mode, every pack, the review and
 * the smart session are all behind this gate, and all of them sit on a spinner
 * that never resolves. Nothing in the UI could recover from it, because nothing
 * ever ran again.
 */
export async function refreshEntitlement(userId: string) {
  const setStatus = useAuthStore.getState().setEntitlementStatus
  try {
    const sb = await withTimeout(getSupabase(), 'supabase client')
    if (!sb) {
      setStatus(recallStatus(userId) ?? 'none')
      return
    }
    const { data, error } = await withTimeout(
      sb.from('entitlements').select('status').eq('user_id', userId).maybeSingle(),
      'entitlement check'
    )
    if (error) throw error
    const status = (data?.status as EntitlementStatus) ?? 'none'
    rememberStatus(userId, status)
    setStatus(status)
  } catch (err) {
    // Couldn't ask. Fall back to what this account was last known to have
    // rather than to a spinner, and say so in the log — a silent downgrade to
    // the paywall is its own kind of bug report.
    console.error('[auth] entitlement check failed:', err)
    setStatus(recallStatus(userId) ?? 'none')
  }
}

// Only merge progress once per distinct user becoming known (boot restore or
// a real sign-in) — not on every TOKEN_REFRESHED event for the same user.
let lastSyncedUserId: string | null = null

function handleSession(session: Session | null) {
  useAuthStore.getState().setSession(session)
  const userId = session?.user?.id ?? null

  if (userId) {
    refreshEntitlement(userId)
    if (userId !== lastSyncedUserId) {
      lastSyncedUserId = userId
      // Hand the local stores to this account before merging: if they belong
      // to someone else who used this device, the merge would otherwise fold
      // their progress into this account.
      claimProgressFor(userId).then(() => pullAndMergeProgress(userId)).catch(err => {
        console.error('[progressSync] merge failed:', err)
        // A failed merge used to be a console line and nothing else, so a
        // device could go on studying against a half-synced account with no
        // sign anything was wrong. Retried on the next sign-in, which is why
        // lastSyncedUserId is released here.
        lastSyncedUserId = null
        showToast('Nie udało się zsynchronizować postępu. Twoje dane są bezpieczne na tym urządzeniu — spróbujemy ponownie później.', { icon: '☁️' })
      })
    }
  } else {
    useAuthStore.getState().setEntitlementStatus('none')
    lastSyncedUserId = null
  }
}

/**
 * Rehydrates auth/entitlement state on boot and keeps it in sync. Call once
 * from App.tsx.
 *
 * Stays synchronous on purpose: App.tsx calls it as `useEffect(() =>
 * initAuthListener(), [])`, and React needs the cleanup function back
 * immediately — an async function would hand it a promise instead.
 *
 * So the client is loaded inside, and `cancelled` is load-bearing rather than
 * defensive: under React.StrictMode this effect mounts, tears down and mounts
 * again, and the teardown happens while the import is still in flight. Without
 * the flag the first run would still go on to subscribe after being cancelled,
 * leaking a listener and running pullAndMergeProgress twice.
 */
export function initAuthListener(): () => void {
  if (!supabaseEnabled) {
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setEntitlementStatus('none')
    return () => {}
  }

  let cancelled = false
  let unsubscribe: (() => void) | null = null

  // Every failure path here ends in handleSession(null): `authLoading` is what
  // gates the whole app behind a spinner, and a client that can't load or a
  // session lookup that rejects must still resolve it. Signed out is the honest
  // answer when we can't tell — and it's recoverable, unlike waiting forever.
  const giveUp = (err: unknown) => {
    if (cancelled) return
    console.error('[auth] session lookup failed:', err)
    handleSession(null)
  }

  void withTimeout(getSupabase(), 'supabase client').then(sb => {
    if (cancelled) return
    if (!sb) { handleSession(null); return }
    withTimeout(sb.auth.getSession(), 'session lookup').then(({ data }) => {
      if (!cancelled) handleSession(data.session)
    }).catch(giveUp)
    const { data: subscription } = sb.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })
    unsubscribe = () => subscription.subscription.unsubscribe()
    // Lost the race: teardown ran while the client was still loading.
    if (cancelled) unsubscribe()
  }).catch(giveUp)

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
