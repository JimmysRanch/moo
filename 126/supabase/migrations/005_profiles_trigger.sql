-- ============================================================
-- Auto-create profile row when a new user signs up
-- ============================================================
-- Pulls first_name, last_name, phone from raw_user_meta_data
-- so the profile is populated even before the user confirms
-- their email (no active client session required).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'phone',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger first so re-running is safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
