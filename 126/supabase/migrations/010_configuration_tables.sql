-- Migration 010: Configuration tables
-- Purpose: Add tables for business settings and configuration options

-- Create business_settings table
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'America/New_York',
  tax_rate NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create payment_method_config table
CREATE TABLE IF NOT EXISTS public.payment_method_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  method_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, method_name)
);

-- Create staff_positions table
CREATE TABLE IF NOT EXISTS public.staff_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, position_name)
);

-- Create temperament_options table
CREATE TABLE IF NOT EXISTS public.temperament_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, option_name)
);

-- Create weight_ranges table
CREATE TABLE IF NOT EXISTS public.weight_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  min_weight NUMERIC NOT NULL,
  max_weight NUMERIC NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, category)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_settings_store_id ON public.business_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_config_store_id ON public.payment_method_config(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_positions_store_id ON public.staff_positions(store_id);
CREATE INDEX IF NOT EXISTS idx_temperament_options_store_id ON public.temperament_options(store_id);
CREATE INDEX IF NOT EXISTS idx_weight_ranges_store_id ON public.weight_ranges(store_id);

-- Enable RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperament_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_ranges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_settings
CREATE POLICY "Members can view business settings in their store"
  ON public.business_settings FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert business settings in their store"
  ON public.business_settings FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update business settings in their store"
  ON public.business_settings FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete business settings in their store"
  ON public.business_settings FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for payment_method_config
CREATE POLICY "Members can view payment methods in their store"
  ON public.payment_method_config FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert payment methods in their store"
  ON public.payment_method_config FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update payment methods in their store"
  ON public.payment_method_config FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete payment methods in their store"
  ON public.payment_method_config FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for staff_positions
CREATE POLICY "Members can view staff positions in their store"
  ON public.staff_positions FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert staff positions in their store"
  ON public.staff_positions FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update staff positions in their store"
  ON public.staff_positions FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete staff positions in their store"
  ON public.staff_positions FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for temperament_options
CREATE POLICY "Members can view temperament options in their store"
  ON public.temperament_options FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert temperament options in their store"
  ON public.temperament_options FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update temperament options in their store"
  ON public.temperament_options FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete temperament options in their store"
  ON public.temperament_options FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for weight_ranges
CREATE POLICY "Members can view weight ranges in their store"
  ON public.weight_ranges FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert weight ranges in their store"
  ON public.weight_ranges FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update weight ranges in their store"
  ON public.weight_ranges FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete weight ranges in their store"
  ON public.weight_ranges FOR DELETE
  USING (public.is_store_owner(store_id));

-- Add updated_at triggers
CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_payment_method_config_updated_at
  BEFORE UPDATE ON public.payment_method_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
