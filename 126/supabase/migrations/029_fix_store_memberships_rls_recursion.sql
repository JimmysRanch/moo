begin;

-- ============================================================
-- 1) Helper: membership + owner checks WITHOUT RLS recursion
-- ============================================================

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare ok boolean;
begin
  -- bypass RLS inside this function (prevents recursion)
  perform set_config('row_security', 'off', true);

  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = p_store_id
      and sm.user_id  = auth.uid()
  ) into ok;

  return ok;
end;
$$;

create or replace function public.is_store_owner(p_store_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare ok boolean;
begin
  perform set_config('row_security', 'off', true);

  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = p_store_id
      and sm.user_id  = auth.uid()
      and sm.role     = 'owner'::text
  ) into ok;

  return ok;
end;
$$;

revoke all on function public.is_store_member(uuid) from public;
revoke all on function public.is_store_owner(uuid) from public;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function public.is_store_owner(uuid) to authenticated;

-- ============================================================
-- 2) Reset store_memberships policies (removes recursion)
-- ============================================================

alter table public.store_memberships enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='store_memberships'
  loop
    execute format('drop policy if exists %I on public.store_memberships;', p.policyname);
  end loop;
end $$;

-- Users can always see their own membership rows
create policy "store_memberships_select_self"
on public.store_memberships
for select
to authenticated
using (user_id = auth.uid());

-- Owners can see all memberships for stores they own (no recursion because helper bypasses RLS)
create policy "store_memberships_select_owner_store"
on public.store_memberships
for select
to authenticated
using (public.is_store_owner(store_id));

-- Only allow inserting your OWN owner membership row (bootstrapping a new store)
create policy "store_memberships_insert_self_owner_only"
on public.store_memberships
for insert
to authenticated
with check (user_id = auth.uid() and role = 'owner'::text);

-- Owners can delete memberships in stores they own
create policy "store_memberships_delete_owner"
on public.store_memberships
for delete
to authenticated
using (public.is_store_owner(store_id));

-- (Optional but recommended) Owners can update memberships in stores they own
-- Uncomment if your app needs it.
-- create policy "store_memberships_update_owner"
-- on public.store_memberships
-- for update
-- to authenticated
-- using (public.is_store_owner(store_id))
-- with check (public.is_store_owner(store_id));

-- ============================================================
-- 3) Fix staff SELECT policies that directly query store_memberships
--    (not strictly required once store_memberships stops recursing,
--     but this removes redundant/duplicated policies you currently have)
-- ============================================================

-- You have multiple overlapping staff SELECT policies. Keep ONE clean one.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='staff' and cmd='SELECT'
  loop
    execute format('drop policy if exists %I on public.staff;', p.policyname);
  end loop;
end $$;

create policy "staff_select_store_member_or_self"
on public.staff
for select
to authenticated
using (public.is_store_member(store_id) or user_id = auth.uid());

commit;
