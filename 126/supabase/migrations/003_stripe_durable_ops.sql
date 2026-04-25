-- Stripe durable operations + reconciliation tables

create table if not exists public.stripe_connections (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.stores(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id)
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  internal_transaction_id text,
  stripe_payment_intent_id text not null unique,
  stripe_charge_id text,
  status text not null,
  amount integer not null,
  currency text not null,
  payment_method text not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  appointment_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  stripe_refund_id text not null unique,
  stripe_payment_intent_id text,
  amount integer not null,
  reason text,
  actor_user_id uuid,
  actor_role text,
  status text not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.terminal_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade unique,
  stripe_location_id text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.terminal_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  terminal_location_id uuid references public.terminal_locations(id) on delete set null,
  stripe_reader_id text not null,
  label text,
  device_type text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, stripe_reader_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('pos', 'card')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, kind)
);

alter table public.stripe_connections enable row level security;
alter table public.payment_intents enable row level security;
alter table public.refunds enable row level security;
alter table public.terminal_locations enable row level security;
alter table public.terminal_devices enable row level security;
alter table public.webhook_events enable row level security;
alter table public.payment_settings enable row level security;

create policy "members view stripe connections" on public.stripe_connections for select using (public.is_store_member(salon_id));
create policy "owners manage stripe connections" on public.stripe_connections for all using (public.is_store_owner(salon_id)) with check (public.is_store_owner(salon_id));

create policy "members view payment intents" on public.payment_intents for select using (public.is_store_member(store_id));
create policy "members write payment intents" on public.payment_intents for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy "members view refunds" on public.refunds for select using (public.is_store_member(store_id));
create policy "members write refunds" on public.refunds for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy "members view terminal locations" on public.terminal_locations for select using (public.is_store_member(store_id));
create policy "members write terminal locations" on public.terminal_locations for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy "members view terminal devices" on public.terminal_devices for select using (public.is_store_member(store_id));
create policy "members write terminal devices" on public.terminal_devices for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy "service role manages webhook events" on public.webhook_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "members view payment settings" on public.payment_settings for select using (public.is_store_member(store_id));
create policy "members write payment settings" on public.payment_settings for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
