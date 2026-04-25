-- ============================================================
-- Update provision_owner_store to properly update profile
-- ============================================================
-- The handle_new_user trigger creates a profile automatically
-- but it may have empty first_name/last_name if they weren't
-- in user metadata. This migration ensures that the profile
-- is updated with the correct values when the store is created.
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
  -- STEP 0: Ensure profile exists and is updated
  --------------------------------------------------
  insert into public.profiles (id, first_name, last_name)
  values (v_user_id, trim(p_first_name), trim(p_last_name))
  on conflict (id) do update set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name);

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
