-- ============================================================
-- Alias RPC: create_store_for_user(p_name, p_first_name, p_last_name, p_email)
-- Wraps the existing provision_owner_store RPC
-- so the client can call supabase.rpc('create_store_for_user', { ... })
-- ============================================================

create or replace function public.create_store_for_user(
  p_name text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.provision_owner_store(
    p_name,
    p_first_name,
    p_last_name,
    p_email
  );
$$;

grant execute on function public.create_store_for_user(text, text, text, text)
to authenticated;
