import Stripe from 'stripe'
import { requireUser } from './_lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS = {
  subscription: process.env.STRIPE_PRICE_ID_SUBSCRIPTION!,
  lifetime: process.env.STRIPE_PRICE_ID_LIFETIME!,
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const result = await requireUser(request)
  if ('error' in result) return result.error
  const { user } = result

  let plan: 'subscription' | 'lifetime'
  try {
    const body = await request.json()
    if (body.plan !== 'subscription' && body.plan !== 'lifetime') {
      return new Response('Invalid plan', { status: 400 })
    }
    plan = body.plan
  } catch {
    return new Response('Invalid body', { status: 400 })
  }

  const appUrl = process.env.APP_URL!
  const session = await stripe.checkout.sessions.create({
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${appUrl}/konto?checkout=success`,
    cancel_url: `${appUrl}/konto?checkout=cancelled`,
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
