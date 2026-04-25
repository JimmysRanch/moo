-- Migration 021: Weighted Average Cost (moving average) for retail inventory
-- Adds costing columns to inventory_items and inventory_ledger, plus atomic RPC functions.

-- ─────────────────────────────────────────────
-- 1. New columns on inventory_items
-- ─────────────────────────────────────────────
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS avg_unit_cost   NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS inventory_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_unit_cost  NUMERIC(12,4);

-- ─────────────────────────────────────────────
-- 2. New columns on inventory_ledger
-- ─────────────────────────────────────────────
ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS unit_cost_used  NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS total_cost      NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS reference_type  TEXT,
  ADD COLUMN IF NOT EXISTS reference_id    TEXT;

-- ─────────────────────────────────────────────
-- 3. record_inventory_purchase RPC
--    Weighted-average purchase: recalculates avg from old value + new value.
--    Returns JSON: { item_id, on_hand_qty, avg_unit_cost, inventory_value,
--                    last_unit_cost, ledger_id }
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_inventory_purchase(
  p_store_id      UUID,
  p_item_id       UUID,
  p_qty           INTEGER,
  p_unit_cost     NUMERIC,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_user_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty       NUMERIC;
  v_old_avg       NUMERIC;
  v_old_value     NUMERIC;
  v_new_qty       NUMERIC;
  v_new_avg       NUMERIC;
  v_new_value     NUMERIC;
  v_ledger_id     UUID;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Purchase qty must be positive';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  -- Lock the item row to prevent concurrent mutations
  SELECT quantity, avg_unit_cost, inventory_value
    INTO v_old_qty, v_old_avg, v_old_value
    FROM public.inventory_items
   WHERE id = p_item_id AND store_id = p_store_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  -- Treat NULL avg as 0 only when qty is also 0
  IF v_old_qty = 0 THEN
    v_old_avg   := 0;
    v_old_value := 0;
  END IF;

  v_new_qty   := v_old_qty + p_qty;
  v_new_value := v_old_value + (p_qty * p_unit_cost);
  v_new_avg   := v_new_value / v_new_qty;

  -- Update item
  UPDATE public.inventory_items
     SET quantity        = v_new_qty,
         avg_unit_cost   = v_new_avg,
         inventory_value = v_new_value,
         last_unit_cost  = p_unit_cost,
         cost            = v_new_avg   -- keep legacy `cost` in sync for existing UI
   WHERE id = p_item_id AND store_id = p_store_id;

  -- Write ledger row
  INSERT INTO public.inventory_ledger
    (store_id, item_id, timestamp, change, reason,
     reference, reference_type, reference_id,
     user_id, resulting_quantity,
     unit_cost_used, total_cost, notes)
  VALUES
    (p_store_id, p_item_id, NOW(), p_qty, 'purchase',
     p_reference_id, p_reference_type, p_reference_id,
     p_user_id, v_new_qty,
     p_unit_cost, p_qty * p_unit_cost, p_notes)
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'item_id',         p_item_id,
    'on_hand_qty',     v_new_qty,
    'avg_unit_cost',   v_new_avg,
    'inventory_value', v_new_value,
    'last_unit_cost',  p_unit_cost,
    'ledger_id',       v_ledger_id
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 4. record_inventory_sale RPC
--    Uses current avg_unit_cost as COGS; resets avg to NULL when qty hits 0.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_inventory_sale(
  p_store_id      UUID,
  p_item_id       UUID,
  p_qty           INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_user_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty       NUMERIC;
  v_old_avg       NUMERIC;
  v_old_value     NUMERIC;
  v_new_qty       NUMERIC;
  v_new_avg       NUMERIC;
  v_new_value     NUMERIC;
  v_cogs          NUMERIC;
  v_ledger_id     UUID;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Sale qty must be positive';
  END IF;

  -- Lock the item row
  SELECT quantity, avg_unit_cost, inventory_value
    INTO v_old_qty, v_old_avg, v_old_value
    FROM public.inventory_items
   WHERE id = p_item_id AND store_id = p_store_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF v_old_qty < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_old_qty, p_qty;
  END IF;

  IF v_old_avg IS NULL THEN
    RAISE EXCEPTION 'avg_unit_cost is NULL with qty > 0 — data inconsistency';
  END IF;

  v_cogs      := p_qty * v_old_avg;
  v_new_qty   := v_old_qty - p_qty;
  v_new_value := GREATEST(0, v_old_value - v_cogs);

  -- Reset on zero rule
  IF v_new_qty = 0 THEN
    v_new_avg   := NULL;
    v_new_value := 0;
  ELSE
    v_new_avg := v_old_avg;  -- avg stays the same on a sale
  END IF;

  -- Update item
  UPDATE public.inventory_items
     SET quantity        = v_new_qty,
         avg_unit_cost   = v_new_avg,
         inventory_value = v_new_value,
         cost            = COALESCE(v_new_avg, cost)  -- keep legacy cost until next purchase
   WHERE id = p_item_id AND store_id = p_store_id;

  -- Write ledger row
  INSERT INTO public.inventory_ledger
    (store_id, item_id, timestamp, change, reason,
     reference, reference_type, reference_id,
     user_id, resulting_quantity,
     unit_cost_used, total_cost, notes)
  VALUES
    (p_store_id, p_item_id, NOW(), -p_qty, 'sale',
     p_reference_id, p_reference_type, p_reference_id,
     p_user_id, v_new_qty,
     v_old_avg, v_cogs, p_notes)
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'item_id',         p_item_id,
    'on_hand_qty',     v_new_qty,
    'avg_unit_cost',   v_new_avg,
    'inventory_value', v_new_value,
    'cogs_total',      v_cogs,
    'ledger_id',       v_ledger_id
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 5. record_inventory_adjustment RPC
--    Positive delta → treated as purchase (requires unit_cost).
--    Negative delta → uses current avg as shrink cost.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_inventory_adjustment(
  p_store_id      UUID,
  p_item_id       UUID,
  p_qty_delta     INTEGER,
  p_unit_cost     NUMERIC DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_user_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty       NUMERIC;
  v_old_avg       NUMERIC;
  v_old_value     NUMERIC;
  v_new_qty       NUMERIC;
  v_new_avg       NUMERIC;
  v_new_value     NUMERIC;
  v_unit_cost     NUMERIC;
  v_total_cost    NUMERIC;
  v_ledger_id     UUID;
BEGIN
  IF p_qty_delta = 0 THEN
    RAISE EXCEPTION 'Adjustment qty_delta cannot be zero';
  END IF;

  -- Lock the item row
  SELECT quantity, avg_unit_cost, inventory_value
    INTO v_old_qty, v_old_avg, v_old_value
    FROM public.inventory_items
   WHERE id = p_item_id AND store_id = p_store_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF p_qty_delta > 0 THEN
    -- Positive adjustment: treat like a purchase (weighted avg)
    IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
      RAISE EXCEPTION 'unit_cost is required and must be >= 0 for positive adjustments';
    END IF;

    IF v_old_qty = 0 THEN
      v_old_avg   := 0;
      v_old_value := 0;
    END IF;

    v_new_qty    := v_old_qty + p_qty_delta;
    v_new_value  := v_old_value + (p_qty_delta * p_unit_cost);
    v_new_avg    := v_new_value / v_new_qty;
    v_unit_cost  := p_unit_cost;
    v_total_cost := p_qty_delta * p_unit_cost;

  ELSE
    -- Negative adjustment (shrink): use current avg
    IF v_old_qty < ABS(p_qty_delta) THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_old_qty, ABS(p_qty_delta);
    END IF;

    IF v_old_avg IS NULL THEN
      RAISE EXCEPTION 'avg_unit_cost is NULL with qty > 0 — data inconsistency';
    END IF;

    v_unit_cost  := v_old_avg;
    v_total_cost := ABS(p_qty_delta) * v_old_avg;
    v_new_qty    := v_old_qty + p_qty_delta;  -- p_qty_delta is negative
    v_new_value  := GREATEST(0, v_old_value - v_total_cost);

    IF v_new_qty = 0 THEN
      v_new_avg   := NULL;
      v_new_value := 0;
    ELSE
      v_new_avg := v_old_avg;
    END IF;
  END IF;

  -- Update item
  UPDATE public.inventory_items
     SET quantity        = v_new_qty,
         avg_unit_cost   = v_new_avg,
         inventory_value = v_new_value,
         last_unit_cost  = CASE WHEN p_qty_delta > 0 THEN p_unit_cost ELSE last_unit_cost END,
         cost            = COALESCE(v_new_avg, cost)
   WHERE id = p_item_id AND store_id = p_store_id;

  -- Write ledger row
  INSERT INTO public.inventory_ledger
    (store_id, item_id, timestamp, change, reason,
     reference, reference_type, reference_id,
     user_id, resulting_quantity,
     unit_cost_used, total_cost, notes)
  VALUES
    (p_store_id, p_item_id, NOW(), p_qty_delta, 'adjustment',
     p_reference_id, p_reference_type, p_reference_id,
     p_user_id, v_new_qty,
     v_unit_cost, v_total_cost, p_notes)
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'item_id',         p_item_id,
    'on_hand_qty',     v_new_qty,
    'avg_unit_cost',   v_new_avg,
    'inventory_value', v_new_value,
    'ledger_id',       v_ledger_id
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 6. Grant execute to authenticated users
-- ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.record_inventory_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_sale TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_adjustment TO authenticated;
