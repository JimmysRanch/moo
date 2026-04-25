-- Store only a hashed version of the public checkout success token.
-- The raw token is returned to Stripe's success_url (and lives briefly in Stripe's
-- own redirect URL / browser history) but we never need to keep a reusable bearer
-- token at rest. Keep the raw column nullable for backfill and for compatibility
-- with rows from the previous migration, but prefer success_token_hash going forward.

alter table public.stripe_checkout_sessions
  add column if not exists success_token_hash text;

create index if not exists idx_stripe_checkout_sessions_success_token_hash
  on public.stripe_checkout_sessions (success_token_hash);

alter table public.stripe_checkout_sessions
  alter column success_token drop not null;
