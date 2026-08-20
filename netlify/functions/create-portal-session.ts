import Stripe from 'stripe'
import { requireUser, admin } from './_lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const result = await requireUser(request)
  if ('error' in result) return result.error
  const { user } = result

  const { data: entitlement } = await admin
    .from('entitlements')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!entitlement?.stripe_customer_id) {
    return new Response('No billing account found', { status: 404 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: entitlement.stripe_customer_id,
    return_url: `${process.env.APP_URL}/konto`,
  })

  return new Response(JSON.stringify({ url: portalSession.url }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
