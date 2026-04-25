begin;

-- Align RLS helper functions with the client-side staff fallback used by StoreContext.
-- Some legacy stores can still have a valid owner/manager staff row even when the
-- matching store_memberships row is missing or delayed. Payroll settings writes use
-- public.is_store_owner(...) and reads use public.is_store_manager_or_owner(...),
-- so the helpers must recognize the same recovered roles that the app does.

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
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
  ) or exists (
    select 1
    from public.staff s
    where s.store_id = p_store_id
      and s.user_id = auth.uid()
      and (
        s.is_owner = true
        or lower(trim(coalesce(s.role, ''))) = 'owner'
      )
  ) into ok;

  return ok;
end;
$$;

create or replace function public.is_store_manager_or_owner(p_store_id uuid)
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
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'manager')
  ) or exists (
    select 1
    from public.staff s
    where s.store_id = p_store_id
      and s.user_id = auth.uid()
      and (
        s.is_owner = true
        or lower(trim(coalesce(s.role, ''))) in ('owner', 'manager')
      )
  ) into ok;

  return ok;
end;
$$;

revoke all on function public.is_store_owner(uuid) from public;
grant execute on function public.is_store_owner(uuid) to authenticated;

revoke all on function public.is_store_manager_or_owner(uuid) from public;
grant execute on function public.is_store_manager_or_owner(uuid) to authenticated;

commit;
