-- Stripe Connect card setup state and durable payout/dispute projections.

alter table public.stripe_connections
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_card_setup_status text not null default 'not_set_up',
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_requirements_due jsonb not null default '[]'::jsonb,
  add column if not exists stripe_disabled_reason text;

update public.stripe_connections
set
  stripe_connected_account_id = coalesce(stripe_connected_account_id, stripe_account_id),
  stripe_charges_enabled = coalesce(stripe_charges_enabled, charges_enabled),
  stripe_payouts_enabled = coalesce(stripe_payouts_enabled, payouts_enabled),
  stripe_details_submitted = coalesce(stripe_details_submitted, details_submitted),
  stripe_card_setup_status = case
    when coalesce(charges_enabled, false) then 'active'
    when coalesce(details_submitted, false) then 'pending'
    else 'not_set_up'
  end
where true;

create table if not exists public.stripe_payouts (
  id uuid primary key default gen_random_uuid(),
  stripe_payout_id text not null unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  amount integer not null,
  currency text not null,
  status text not null,
  arrival_date timestamptz,
  failure_code text,
  failure_message text,
  method text,
  type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  store_id uuid not null references public.stores(id) on delete cascade,
  amount integer not null,
  currency text not null,
  reason text,
  status text not null,
  due_by timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_payouts enable row level security;
alter table public.stripe_disputes enable row level security;

create policy "members view stripe payouts" on public.stripe_payouts
  for select using (public.is_store_member(store_id));
drop policy if exists "members write stripe payouts" on public.stripe_payouts;
create policy "service role manages stripe payouts" on public.stripe_payouts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "members view stripe disputes" on public.stripe_disputes
  for select using (public.is_store_member(store_id));
drop policy if exists "members write stripe disputes" on public.stripe_disputes;
create policy "service role manages stripe disputes" on public.stripe_disputes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
