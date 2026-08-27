import { supabase } from '../services/supabaseClient'

/**
 * Development-only auto sign-in.
 *
 * Signs into the local test account (VITE_DEV_TEST_EMAIL / VITE_DEV_TEST_PASSWORD)
 * on boot when no session exists yet, so `npm run dev` starts already logged in
 * instead of requiring a manual visit to /logowanie every time.
 */
export async function devAutoLogin(): Promise<void> {
  if (!supabase) return

  const email = import.meta.env.VITE_DEV_TEST_EMAIL
  const password = import.meta.env.VITE_DEV_TEST_PASSWORD
  if (!email || !password) return

  const { data } = await supabase.auth.getSession()
  if (data.session) return

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) console.warn('[devAutoLogin] sign-in failed:', error.message)
  else console.info('[devAutoLogin] signed in as', email)
}

if (import.meta.env.DEV) {
  devAutoLogin()
}
