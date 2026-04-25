-- Migration 009: Inventory management tables
-- Purpose: Add tables for inventory items, ledger, and snapshots

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sku TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC,
  cost NUMERIC,
  reorder_level NUMERIC DEFAULT 0,
  supplier TEXT,
  description TEXT,
  staff_compensation_type TEXT CHECK (staff_compensation_type IN ('none', 'percentage', 'fixed')),
  staff_compensation_value NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(store_id, sku)
);

-- Create inventory_ledger table (tracks all inventory changes)
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change NUMERIC NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('purchase', 'sale', 'adjustment', 'return', 'damage', 'transfer')),
  reference TEXT,
  user_id UUID REFERENCES auth.users(id),
  resulting_quantity NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create inventory_snapshots table (stores periodic inventory valuations)
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_value NUMERIC NOT NULL DEFAULT 0,
  retail_value NUMERIC NOT NULL DEFAULT 0,
  supply_value NUMERIC NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_store_id ON public.inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_store_id ON public.inventory_ledger(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item_id ON public.inventory_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_timestamp ON public.inventory_ledger(timestamp);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_store_id ON public.inventory_snapshots(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_timestamp ON public.inventory_snapshots(timestamp);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
CREATE POLICY "Members can view inventory items in their store"
  ON public.inventory_items FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert inventory items in their store"
  ON public.inventory_items FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update inventory items in their store"
  ON public.inventory_items FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete inventory items in their store"
  ON public.inventory_items FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for inventory_ledger
CREATE POLICY "Members can view inventory ledger in their store"
  ON public.inventory_ledger FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert inventory ledger entries in their store"
  ON public.inventory_ledger FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update inventory ledger in their store"
  ON public.inventory_ledger FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete inventory ledger in their store"
  ON public.inventory_ledger FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for inventory_snapshots
CREATE POLICY "Members can view inventory snapshots in their store"
  ON public.inventory_snapshots FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert inventory snapshots in their store"
  ON public.inventory_snapshots FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update inventory snapshots in their store"
  ON public.inventory_snapshots FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete inventory snapshots in their store"
  ON public.inventory_snapshots FOR DELETE
  USING (public.is_store_owner(store_id));

-- Add updated_at trigger
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
