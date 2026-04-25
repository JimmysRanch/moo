-- Durable Stripe checkout sessions + fulfillment linkage.

create table if not exists public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stripe_account_id text not null,
  stripe_checkout_session_id text not null unique,
  internal_transaction_id text not null unique,
  success_token text not null,
  payment_intent_id text,
  appointment_id uuid references public.appointments(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'open', 'paid', 'expired', 'complete', 'canceled')),
  metadata jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  last_checked_at timestamptz,
  fulfillment_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_checkout_sessions_store_id
  on public.stripe_checkout_sessions (store_id, created_at desc);

create index if not exists idx_stripe_checkout_sessions_payment_intent_id
  on public.stripe_checkout_sessions (payment_intent_id);

alter table public.stripe_checkout_sessions enable row level security;

create policy "members view stripe checkout sessions"
  on public.stripe_checkout_sessions for select
  using (public.is_store_member(store_id));

create policy "service role manages stripe checkout sessions"
  on public.stripe_checkout_sessions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create unique index if not exists idx_transactions_stripe_payment_intent_id_unique
  on public.transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.payment_reconciliation_log
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

create index if not exists idx_payment_reconciliation_log_store_id
  on public.payment_reconciliation_log (store_id, detected_at desc);
