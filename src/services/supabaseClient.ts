import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (e.g. before
// the Supabase project is provisioned) — callers must handle the null case
// rather than assuming auth is available.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
