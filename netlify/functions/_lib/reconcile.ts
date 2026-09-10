import { admin } from './auth'

// Paginated fallback for the rare case an anonymous landing-page buyer
// already has an account — the admin SDK has no email filter, so this is
// the only officially documented way to resolve email -> user id.
async function findUserByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const match = data.users.find(u => u.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < 1000) return null
  }
  return null
}

/**
 * Turns an anonymous Stripe buyer's email into a Supabase user id, creating
 * the account (and sending Supabase's invite email so they can set a
 * password) if none exists yet. Idempotent — safe for webhook retries and
 * for a returning buyer who already claimed the invite.
 */
export async function findOrCreateUserByEmail(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.APP_URL}/konto?checkout=success&anon=1`,
  })
  if (!error) return data.user.id

  if (error.code === 'email_exists') {
    const existingId = await findUserByEmail(email)
    if (existingId) return existingId
    throw new Error(`inviteUserByEmail reported email_exists for ${email} but no matching user was found`)
  }

  throw error
}
