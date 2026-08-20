import { createClient, User } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Used only server-side, never exposed to the client.
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Prefers the Authorization header; falls back to a ?token= query param for
// callers that can't set headers (e.g. <audio> elements loading via .src).
function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (match) return match[1]
  return new URL(request.url).searchParams.get('token')
}

export async function requireUser(request: Request): Promise<{ user: User } | { error: Response }> {
  const token = bearerToken(request)
  if (!token) return { error: new Response('Unauthorized', { status: 401 }) }

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return { error: new Response('Unauthorized', { status: 401 }) }

  return { user: data.user }
}

export async function requireEntitledUser(request: Request): Promise<{ user: User } | { error: Response }> {
  const result = await requireUser(request)
  if ('error' in result) return result

  const { data: entitlement } = await admin
    .from('entitlements')
    .select('status')
    .eq('user_id', result.user.id)
    .maybeSingle()

  if (entitlement?.status !== 'active') {
    return { error: new Response('Payment required', { status: 402 }) }
  }

  return { user: result.user }
}

export { admin }
