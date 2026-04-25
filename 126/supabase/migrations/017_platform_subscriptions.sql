-- Platform subscriptions (monthly SaaS billing on the PLATFORM Stripe account)

create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_subscriptions enable row level security;

create policy "members view platform subscriptions"
  on public.platform_subscriptions for select
  using (public.is_store_member(store_id));

create policy "owners manage platform subscriptions"
  on public.platform_subscriptions for all
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));
