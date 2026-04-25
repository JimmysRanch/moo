-- ============================================================
-- Owner Onboarding Provisioning System
-- ============================================================

-- Enable pgcrypto extension for secure operations
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Add can_take_appointments column to staff table
-- ============================================================
alter table public.staff
add column if not exists can_take_appointments boolean not null default false;

-- ============================================================
-- 2. RPC Function: provision_owner_store
-- ============================================================
create or replace function public.provision_owner_store(
  p_store_name text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_store_id uuid;
  v_existing_store uuid;
  v_is_staff_elsewhere boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  --------------------------------------------------
  -- STEP 0: Ensure profile exists
  --------------------------------------------------
  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  --------------------------------------------------
  -- Idempotency: If user already owns a store, return it
  --------------------------------------------------
  select store_id into v_existing_store
  from public.store_memberships
  where user_id = v_user_id
  and role = 'owner'
  limit 1;

  if v_existing_store is not null then
    return v_existing_store;
  end if;

  --------------------------------------------------
  -- Check if user is staff elsewhere but not owner
  --------------------------------------------------
  select exists (
    select 1 from public.store_memberships
    where user_id = v_user_id
    and role != 'owner'
  ) into v_is_staff_elsewhere;

  if v_is_staff_elsewhere then
    raise exception 'NEEDS_OWNER_INVITE';
  end if;

  --------------------------------------------------
  -- Validate store name
  --------------------------------------------------
  if p_store_name is null or length(trim(p_store_name)) = 0 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_first_name is null or length(trim(p_first_name)) = 0 then
    raise exception 'VALIDATION_ERROR: first_name is required';
  end if;
  if p_last_name is null or length(trim(p_last_name)) = 0 then
    raise exception 'VALIDATION_ERROR: last_name is required';
  end if;
  if p_email is null or length(trim(p_email)) = 0 or trim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'VALIDATION_ERROR: email is required';
  end if;

  --------------------------------------------------
  -- STEP 1: Create store
  --------------------------------------------------
  insert into public.stores (name)
  values (trim(p_store_name))
  returning id into v_store_id;

  --------------------------------------------------
  -- STEP 2: Create owner membership
  -- (Unique constraint ensures single owner per store)
  --------------------------------------------------
  insert into public.store_memberships (
    store_id,
    user_id,
    role
  ) values (
    v_store_id,
    v_user_id,
    'owner'
  );

  --------------------------------------------------
  -- STEP 3: Create owner staff profile
  -- Note: Owners can_take_appointments defaults to false
  -- (can be enabled later via staff settings)
  --------------------------------------------------
  insert into public.staff (
    store_id,
    user_id,
    first_name,
    last_name,
    email,
    role,
    is_owner,
    is_active,
    can_take_appointments
  )
  values (
    v_store_id,
    v_user_id,
    trim(p_first_name),
    trim(p_last_name),
    trim(p_email),
    'owner',
    true,
    true,
    false
  )
  on conflict (store_id, user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    role = 'owner',
    is_owner = true,
    is_active = true;
    -- Note: can_take_appointments is NOT updated on conflict.
    -- This preserves the owner's appointment scheduling preference
    -- if they previously enabled it via staff settings.

  --------------------------------------------------
  -- STEP 4: Seed payment settings (baseline only)
  --------------------------------------------------
  insert into public.payment_settings (
    store_id,
    kind,
    settings
  )
  values
    (v_store_id, 'pos', '{}'::jsonb),
    (v_store_id, 'card', '{}'::jsonb)
  on conflict (store_id, kind) do nothing;

  return v_store_id;
end;
$$;

grant execute on function public.provision_owner_store(text, text, text, text)
to authenticated;

-- ============================================================
-- 3. Hard Guarantee — One Owner Per Store
-- ============================================================

create unique index if not exists one_owner_per_store
on public.store_memberships (store_id)
where role = 'owner';

create unique index if not exists one_owner_staff_per_store
on public.staff (store_id)
where is_owner = true;

-- ============================================================
-- 4. Invariant Trigger — Auto-ensure staff row for owners
-- ============================================================

create or replace function public.ensure_owner_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role = 'owner' then
    insert into public.staff (
      store_id,
      user_id,
      role,
      is_owner,
      is_active,
      can_take_appointments
    )
    values (
      NEW.store_id,
      NEW.user_id,
      'owner',
      true,
      true,
      false
    )
    on conflict (store_id, user_id) do update set
      role = 'owner',
      is_owner = true,
      is_active = true;
      -- Note: can_take_appointments is NOT updated on conflict
      -- This preserves the owner's choice if they enabled it
  end if;
  
  return NEW;
end;
$$;

create trigger trigger_ensure_owner_staff
after insert on public.store_memberships
for each row
execute function public.ensure_owner_staff();
