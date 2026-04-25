-- Migration 012: Payroll tables
-- Purpose: Add tables for payroll settings and payroll periods

-- Create payroll_settings table
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  pay_period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (pay_period_type IN ('weekly', 'biweekly', 'monthly')),
  pay_period_start_day INTEGER CHECK (pay_period_start_day >= 0 AND pay_period_start_day <= 6),
  default_commission_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create payroll_periods table
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  tips NUMERIC DEFAULT 0,
  total_pay NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(store_id, staff_id, period_start, period_end)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payroll_settings_store_id ON public.payroll_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_store_id ON public.payroll_periods(store_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_staff_id ON public.payroll_periods(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_period_start ON public.payroll_periods(period_start);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);

-- Enable RLS
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_settings
CREATE POLICY "Members can view payroll settings in their store"
  ON public.payroll_settings FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Owners can insert payroll settings in their store"
  ON public.payroll_settings FOR INSERT
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can update payroll settings in their store"
  ON public.payroll_settings FOR UPDATE
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can delete payroll settings in their store"
  ON public.payroll_settings FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for payroll_periods
CREATE POLICY "Members can view payroll periods in their store"
  ON public.payroll_periods FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Owners can insert payroll periods in their store"
  ON public.payroll_periods FOR INSERT
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can update payroll periods in their store"
  ON public.payroll_periods FOR UPDATE
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can delete payroll periods in their store"
  ON public.payroll_periods FOR DELETE
  USING (public.is_store_owner(store_id));

-- Add updated_at triggers
CREATE TRIGGER update_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
