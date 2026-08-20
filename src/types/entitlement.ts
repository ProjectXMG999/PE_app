export type EntitlementStatus = 'loading' | 'none' | 'active' | 'canceled' | 'past_due'
export type EntitlementPlan = 'subscription' | 'lifetime'

export interface Entitlement {
  userId: string
  status: EntitlementStatus
  plan: EntitlementPlan | null
  currentPeriodEnd: string | null
}
