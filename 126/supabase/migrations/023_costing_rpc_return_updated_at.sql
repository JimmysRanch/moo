-- Migration 023: Include updated_at in costing RPC return values
-- Fixes: After record_inventory_purchase updates an item, the client needs
-- the new updated_at for subsequent optimistic-concurrency updates (e.g.
-- setting retail pricing immediately after receiving stock).

-- ─────────────────────────────────────────────
-- 1. record_inventory_purchase — add updated_at to return JSONB
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
  v_updated_at    TIMESTAMPTZ;
BEGIN
  -- Enforce store membership so callers cannot target other tenants
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this store';
  END IF;

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
   WHERE id = p_item_id AND store_id = p_store_id
   RETURNING updated_at INTO v_updated_at;

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
    'ledger_id',       v_ledger_id,
    'updated_at',      v_updated_at
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 2. record_inventory_sale — add updated_at to return JSONB
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
  v_updated_at    TIMESTAMPTZ;
BEGIN
  -- Enforce store membership so callers cannot target other tenants
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this store';
  END IF;

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
   WHERE id = p_item_id AND store_id = p_store_id
   RETURNING updated_at INTO v_updated_at;

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
    'ledger_id',       v_ledger_id,
    'updated_at',      v_updated_at
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 3. record_inventory_adjustment — add updated_at to return JSONB
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
  v_updated_at    TIMESTAMPTZ;
BEGIN
  -- Enforce store membership so callers cannot target other tenants
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this store';
  END IF;

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
   WHERE id = p_item_id AND store_id = p_store_id
   RETURNING updated_at INTO v_updated_at;

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
    'ledger_id',       v_ledger_id,
    'updated_at',      v_updated_at
  );
END;
$$;
