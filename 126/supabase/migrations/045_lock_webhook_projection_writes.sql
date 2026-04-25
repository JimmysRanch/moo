-- Lock down webhook-owned projection tables in already-migrated environments.
-- Keep member read access, but restrict writes to service_role only.

drop policy if exists "members write stripe payouts" on public.stripe_payouts;
drop policy if exists "members write stripe disputes" on public.stripe_disputes;

drop policy if exists "service role manages stripe payouts" on public.stripe_payouts;
create policy "service role manages stripe payouts" on public.stripe_payouts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages stripe disputes" on public.stripe_disputes;
create policy "service role manages stripe disputes" on public.stripe_disputes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
