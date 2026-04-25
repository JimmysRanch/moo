-- Dispute workflow hardening:
--   1. Persist Stripe dispute metadata (jsonb) on stripe_disputes so downstream
--      tooling can read the full dispute context (e.g. salonId, custom tags).
--   2. Add an audit trail for in-app evidence submissions. Every time a user
--      pushes evidence to Stripe via /api/stripe/connect action
--      `disputes_submit_evidence`, we log who did it, when, and what they
--      submitted. This is also used to render a status history in the in-app
--      dispute dashboard.

alter table public.stripe_disputes
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.dispute_evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stripe_dispute_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  notes text,
  evidence jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_dispute_evidence_submissions_store
  on public.dispute_evidence_submissions (store_id, submitted_at desc);

create index if not exists idx_dispute_evidence_submissions_dispute
  on public.dispute_evidence_submissions (stripe_dispute_id, submitted_at desc);

alter table public.dispute_evidence_submissions enable row level security;

-- Store members may read the audit log for their own store. Only the service
-- role (from the API) writes rows — evidence submission is mediated by the
-- authenticated API endpoint which already enforces the owner/admin/manager
-- role check before invoking stripe.disputes.update.
drop policy if exists "members view dispute evidence" on public.dispute_evidence_submissions;
create policy "members view dispute evidence" on public.dispute_evidence_submissions
  for select using (public.is_store_member(store_id));

drop policy if exists "service role writes dispute evidence" on public.dispute_evidence_submissions;
create policy "service role writes dispute evidence" on public.dispute_evidence_submissions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
