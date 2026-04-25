-- Atomic fulfillment claim columns on payment_intents.
-- finalizePaymentIntentSale runs from the webhook, the POS client, and the
-- public checkout success resolver concurrently. To avoid races where two
-- callers each insert transaction items / appointment pickups / inventory
-- deductions, we use an atomic UPDATE against these columns as a claim.
--
-- fulfillment_status values:
--   NULL / 'pending'   – nothing has run yet
--   'finalizing'       – a caller is currently running side effects (guarded by fulfillment_claimed_at)
--   'finalized'        – side effects completed; idempotent short-circuit for later callers
--   'failed'           – side effects errored; a later retry may re-claim

alter table public.payment_intents
  add column if not exists fulfillment_status text,
  add column if not exists fulfillment_claim_id uuid,
  add column if not exists fulfillment_claimed_at timestamptz,
  add column if not exists fulfillment_finalized_at timestamptz;

create index if not exists idx_payment_intents_fulfillment_status
  on public.payment_intents (fulfillment_status);
