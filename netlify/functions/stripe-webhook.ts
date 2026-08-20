import Stripe from 'stripe'
import { admin } from './_lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Maps Stripe's subscription.status to our narrower entitlement status.
function mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): 'active' | 'past_due' | 'canceled' | 'none' {
  switch (stripeStatus) {
    case 'trialing':
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return 'none'
  }
}

async function upsertByUserId(userId: string, fields: Record<string, unknown>) {
  await admin.from('entitlements').upsert({ user_id: userId, updated_at: new Date().toISOString(), ...fields })
}

async function updateByCustomerId(customerId: string, fields: Record<string, unknown>) {
  await admin
    .from('entitlements')
    .update({ updated_at: new Date().toISOString(), ...fields })
    .eq('stripe_customer_id', customerId)
}

export default async (request: Request): Promise<Response> => {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // Signature verification needs the raw, unparsed body bytes.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      if (!userId) break
      const plan = session.mode === 'payment' ? 'lifetime' : 'subscription'
      await upsertByUserId(userId, {
        status: 'active',
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.mode === 'subscription' ? (session.subscription as string) : null,
        current_period_end: null,
      })
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      // Webhook payloads are rendered in the Stripe account's configured API
      // version, which can differ from the version this SDK's types assume —
      // current_period_end moved from the subscription to its items in newer
      // versions, so check both shapes rather than trusting one statically.
      const periodEnd =
        (subscription as unknown as { current_period_end?: number }).current_period_end ??
        subscription.items.data[0]?.current_period_end
      await updateByCustomerId(subscription.customer as string, {
        status: mapSubscriptionStatus(subscription.status),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await updateByCustomerId(subscription.customer as string, { status: 'canceled' })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer) {
        await updateByCustomerId(invoice.customer as string, { status: 'past_due' })
      }
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
