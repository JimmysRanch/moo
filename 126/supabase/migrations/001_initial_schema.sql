-- ============================================================
-- 1. public.profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ============================================================
-- 2. public.stores
-- ============================================================
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;

-- ============================================================
-- 3. public.store_memberships
-- ============================================================
create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'groomer', 'front_desk', 'bather')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

alter table public.store_memberships enable row level security;

-- ============================================================
-- 4. public.staff
-- ============================================================
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  role text not null default 'groomer',
  is_owner boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

alter table public.staff enable row level security;
