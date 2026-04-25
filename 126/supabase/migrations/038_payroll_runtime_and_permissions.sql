-- Migration 038: Persist runtime payroll settings, snapshots, and authorization helpers

ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS anchor_start_date DATE,
  ADD COLUMN IF NOT EXISTS anchor_end_date DATE,
  ADD COLUMN IF NOT EXISTS anchor_pay_date DATE;

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS pay_date DATE,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payroll_periods
SET pay_date = COALESCE(pay_date, period_end + 5)
WHERE pay_date IS NULL;

CREATE OR REPLACE FUNCTION public.is_store_manager_or_owner(_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_memberships
    WHERE store_id = _store_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_store_manager_or_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can view payroll settings in their store" ON public.payroll_settings;
DROP POLICY IF EXISTS "Members can view payroll periods in their store" ON public.payroll_periods;

CREATE POLICY "Managers can view payroll settings in their store"
  ON public.payroll_settings FOR SELECT
  USING (public.is_store_manager_or_owner(store_id));

CREATE POLICY "Managers can view payroll periods in their store"
  ON public.payroll_periods FOR SELECT
  USING (public.is_store_manager_or_owner(store_id));

CREATE OR REPLACE FUNCTION public.enforce_payroll_period_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'paid' AND NEW.finalized_at IS NULL THEN
      NEW.finalized_at = NOW();
    END IF;

    IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
      NEW.paid_at = NOW();
    END IF;

    IF NEW.status = 'finalized' AND NEW.finalized_at IS NULL THEN
      NEW.finalized_at = NOW();
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' AND OLD.status = 'draft' THEN
    RAISE EXCEPTION 'Payroll can only transition to paid from finalized';
  END IF;

  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Paid payroll cannot transition to another status';
  END IF;

  IF OLD.status = 'finalized' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Finalized payroll cannot return to draft';
  END IF;

  IF OLD.status IN ('finalized', 'paid') THEN
    IF NEW.staff_id <> OLD.staff_id
      OR NEW.period_start <> OLD.period_start
      OR NEW.period_end <> OLD.period_end
      OR NEW.pay_date IS DISTINCT FROM OLD.pay_date
      OR COALESCE(NEW.total_hours, 0) <> COALESCE(OLD.total_hours, 0)
      OR COALESCE(NEW.total_revenue, 0) <> COALESCE(OLD.total_revenue, 0)
      OR COALESCE(NEW.commission, 0) <> COALESCE(OLD.commission, 0)
      OR COALESCE(NEW.tips, 0) <> COALESCE(OLD.tips, 0)
      OR COALESCE(NEW.total_pay, 0) <> COALESCE(OLD.total_pay, 0)
      OR COALESCE(NEW.snapshot, '{}'::jsonb) <> COALESCE(OLD.snapshot, '{}'::jsonb)
    THEN
      RAISE EXCEPTION 'Finalized payroll snapshots are immutable';
    END IF;
  END IF;

  IF NEW.status = 'paid' AND OLD.status <> 'paid' AND NEW.finalized_at IS NULL THEN
    NEW.finalized_at = COALESCE(OLD.finalized_at, NOW());
  END IF;

  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = NOW();
  END IF;

  IF NEW.status = 'finalized' AND OLD.status = 'draft' AND NEW.finalized_at IS NULL THEN
    NEW.finalized_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payroll_period_transition ON public.payroll_periods;
CREATE TRIGGER enforce_payroll_period_transition
  BEFORE INSERT OR UPDATE ON public.payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payroll_period_transition();
