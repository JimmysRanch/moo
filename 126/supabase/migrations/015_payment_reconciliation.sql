-- Migration 015: Payment reconciliation tables
-- Purpose: Track Stripe ↔ local payment discrepancies and reconciliation run metadata

-- ── reconciliation_runs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_run_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages reconciliation runs"
  ON public.reconciliation_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── payment_reconciliation_log ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT NOT NULL,
  local_payment_intent_id UUID,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
    'missing_locally',
    'missing_in_stripe',
    'amount_mismatch',
    'status_mismatch',
    'amount_and_status_mismatch'
  )),
  stripe_amount INTEGER,
  local_amount INTEGER,
  stripe_status TEXT,
  local_status TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_stripe_pi
  ON public.payment_reconciliation_log (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_detected_at
  ON public.payment_reconciliation_log (detected_at DESC);

ALTER TABLE public.payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages reconciliation log"
  ON public.payment_reconciliation_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
