import Stripe from 'stripe'
import { admin } from './_lib/auth'
import { findOrCreateUserByEmail } from './_lib/reconcile'

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

// Unix seconds `months` from now, same day-of-month (clamped by JS Date
// for shorter months — e.g. Jan 31 + 1mo lands on Mar 3, not Feb 31).
function monthsFromNowUnix(months: number): number {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return Math.floor(d.getTime() / 1000)
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
      let userId = session.client_reference_id

      // Anonymous landing-page checkout: no Supabase user existed at
      // session-creation time, so reconcile by the email Stripe collected.
      if (!userId) {
        const email = session.customer_details?.email ?? session.customer_email
        if (!email) {
          console.error('Anonymous checkout completed with no email to reconcile:', session.id)
          break
        }
        try {
          userId = await findOrCreateUserByEmail(email)
        } catch (err) {
          console.error('findOrCreateUserByEmail failed for anonymous checkout:', session.id, err)
          return new Response('Reconciliation failed', { status: 500 })
        }
      }

      // entitlements.plan only ever stores 'subscription' | 'lifetime'
      // (DB check constraint) — the landing page's fixed-term plans are a
      // pricing detail, not a distinct entitlement type. Which one (if
      // any) is tracked via metadata.landingPlan below, for the cancel_at
      // step, not persisted to entitlements.
      const plan = session.mode === 'payment' ? 'lifetime' : 'subscription'
      await upsertByUserId(userId, {
        status: 'active',
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.mode === 'subscription' ? (session.subscription as string) : null,
        current_period_end: null,
      })

      // Landing-only fixed-term plans (6 or 12 monthly payments, no
      // auto-renewal): Checkout Session has no "stop after N cycles"
      // field, so apply it here, once, right after the subscription
      // exists.
      const landingPlan = session.metadata?.landingPlan
      if (landingPlan && session.subscription) {
        const months = landingPlan === 'landing_6mo' ? 6 : landingPlan === 'landing_12mo' ? 12 : null
        if (months) {
          try {
            await stripe.subscriptions.update(session.subscription as string, {
              cancel_at: monthsFromNowUnix(months),
            })
          } catch (err) {
            console.error('Failed to set fixed-term cancel_at for landing subscription:', session.id, err)
          }
        }
      }
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
