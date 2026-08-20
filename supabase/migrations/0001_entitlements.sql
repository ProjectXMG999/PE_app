-- Phase 1: account foundation. Entitlement rows are written only by the
-- Stripe webhook function (service-role key, bypasses RLS) — the client
-- can read its own row but never write here directly.

create table entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'none' check (status in ('active', 'canceled', 'past_due', 'none')),
  plan text check (plan in ('subscription', 'lifetime')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table entitlements enable row level security;

create policy "users read own entitlement"
  on entitlements for select
  using (auth.uid() = user_id);
