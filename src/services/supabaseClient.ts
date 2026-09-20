import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Supabase, loaded on demand.
 *
 * The import above is type-only and erases at build time — nothing here pulls
 * `@supabase/supabase-js` into the module graph. That matters because the
 * library is ~227 kB raw (60 kB gzipped), it used to sit in the main bundle via
 * `App.tsx → initAuthListener → createClient` at module scope, and the start
 * screen (`/dzis`, TodayPage) renders entirely from IndexedDB — it needs no auth
 * to paint a single pixel. Parsing a quarter of a megabyte of auth, realtime and
 * storage code before first paint bought nothing.
 *
 * Three exports, three deliberately different contracts:
 *
 *  - `supabaseEnabled`  — synchronous. Is auth configured at all? This is the
 *    branch that resolves `authLoading` with no I/O, so it must not be a promise.
 *  - `getSupabase()`    — loads the client (once) and resolves it. The normal
 *    accessor for anything already async.
 *  - `supabaseIfLoaded()` — the client *if it is already there*, and never a
 *    trigger to fetch it. For synchronous fire-and-forget mirrors that must not
 *    drag the library back into the eager graph.
 */

/** Whether VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set at all. */
export const supabaseEnabled = Boolean(url && anonKey)

let client: SupabaseClient | null = null
let loading: Promise<SupabaseClient | null> | null = null

/** Loads the client on first call. Null when Supabase isn't configured. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled) return Promise.resolve(null)
  if (client) return Promise.resolve(client)
  loading ??= import('@supabase/supabase-js').then(({ createClient }) => {
    client = createClient(url!, anonKey!)
    return client
  })
  return loading
}

/**
 * The client only if it has already been loaded — never starts the download.
 *
 * Safe for the progress mirrors in db.ts by construction: they bail unless
 * `useAuthStore.user.id` is set, and the only thing that sets it is
 * `handleSession`, which cannot run before `getSupabase()` has resolved. So
 * `userId != null` implies the client is here.
 */
export function supabaseIfLoaded(): SupabaseClient | null {
  return client
}
