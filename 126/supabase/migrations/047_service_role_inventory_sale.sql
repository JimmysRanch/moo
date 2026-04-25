-- Allow service_role-driven Stripe fulfillment to record inventory sales.

create or replace function public.record_inventory_sale(
  p_store_id      UUID,
  p_item_id       UUID,
  p_qty           INTEGER,
  p_reference_type TEXT default null,
  p_reference_id  TEXT default null,
  p_notes         TEXT default null,
  p_user_id       UUID default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty       numeric;
  v_old_avg       numeric;
  v_old_value     numeric;
  v_new_qty       numeric;
  v_new_avg       numeric;
  v_new_value     numeric;
  v_cogs          numeric;
  v_ledger_id     uuid;
  v_updated_at    timestamptz;
begin
  if auth.role() <> 'service_role' and not public.is_store_member(p_store_id) then
    raise exception 'Access denied: not a member of this store';
  end if;

  if p_qty <= 0 then
    raise exception 'Sale qty must be positive';
  end if;

  select quantity, avg_unit_cost, inventory_value
    into v_old_qty, v_old_avg, v_old_value
    from public.inventory_items
   where id = p_item_id and store_id = p_store_id
     for update;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  if v_old_qty < p_qty then
    raise exception 'Insufficient stock: available %, requested %', v_old_qty, p_qty;
  end if;

  if v_old_avg is null then
    raise exception 'avg_unit_cost is NULL with qty > 0 — data inconsistency';
  end if;

  v_cogs      := p_qty * v_old_avg;
  v_new_qty   := v_old_qty - p_qty;
  v_new_value := greatest(0, v_old_value - v_cogs);

  if v_new_qty = 0 then
    v_new_avg   := null;
    v_new_value := 0;
  else
    v_new_avg := v_old_avg;
  end if;

  update public.inventory_items
     set quantity        = v_new_qty,
         avg_unit_cost   = v_new_avg,
         inventory_value = v_new_value,
         cost            = coalesce(v_new_avg, cost)
   where id = p_item_id and store_id = p_store_id
   returning updated_at into v_updated_at;

  insert into public.inventory_ledger
    (store_id, item_id, timestamp, change, reason,
     reference, reference_type, reference_id,
     user_id, resulting_quantity,
     unit_cost_used, total_cost, notes)
  values
    (p_store_id, p_item_id, now(), -p_qty, 'sale',
     p_reference_id, p_reference_type, p_reference_id,
     p_user_id, v_new_qty,
     v_old_avg, v_cogs, p_notes)
  returning id into v_ledger_id;

  return jsonb_build_object(
    'item_id',         p_item_id,
    'on_hand_qty',     v_new_qty,
    'avg_unit_cost',   v_new_avg,
    'inventory_value', v_new_value,
    'cogs_total',      v_cogs,
    'ledger_id',       v_ledger_id,
    'updated_at',      v_updated_at
  );
end;
$$;
