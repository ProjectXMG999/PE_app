export type Plan = 'landing_6mo' | 'landing_12mo'

/**
 * Starts an anonymous Stripe Checkout session (no Supabase account needed
 * yet — the main app's webhook reconciles the buyer's email into an
 * account afterward) and redirects the browser straight to it.
 */
export async function startCheckout(plan: Plan): Promise<void> {
  const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL
  if (!mainAppUrl) {
    throw new Error('VITE_MAIN_APP_URL is not set — cannot reach the checkout function.')
  }

  const response = await fetch(`${mainAppUrl}/.netlify/functions/create-anonymous-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })

  if (!response.ok) {
    throw new Error(`Checkout request failed: ${response.status}`)
  }

  const { url } = await response.json()
  window.location.href = url
}
