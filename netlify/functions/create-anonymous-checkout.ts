import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Landing-only plans: fixed-length subscriptions (6 or 12 monthly
// payments), distinct from the main app's open-ended "subscription" and
// one-off "lifetime" plans — separate Price IDs so changing one pricing
// surface never touches the other.
const PRICE_IDS = {
  landing_6mo: process.env.STRIPE_PRICE_ID_LANDING_6MO!,
  landing_12mo: process.env.STRIPE_PRICE_ID_LANDING_12MO!,
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': process.env.LANDING_ORIGIN!,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// No requireUser() — this is the one checkout entry point that never gates
// on a Supabase session. The buyer doesn't have an account yet; Stripe
// Checkout collects their email, and the webhook reconciles it into one
// afterward (see _lib/reconcile.ts).
export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let plan: 'landing_6mo' | 'landing_12mo'
  try {
    const body = await request.json()
    if (body.plan !== 'landing_6mo' && body.plan !== 'landing_12mo') {
      return new Response('Invalid plan', { status: 400, headers: corsHeaders() })
    }
    plan = body.plan
  } catch {
    return new Response('Invalid body', { status: 400, headers: corsHeaders() })
  }

  const appUrl = process.env.APP_URL!
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${appUrl}/konto?checkout=success&anon=1`,
    cancel_url: `${appUrl}/konto?checkout=cancelled`,
    // landingPlan drives the fixed-term auto-cancel the webhook applies
    // once the subscription exists (Checkout Session has no field for
    // "stop after N cycles" — see stripe-webhook.ts).
    metadata: { source: 'landing-anonymous', landingPlan: plan },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
