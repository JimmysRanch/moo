import type { InventoryItem as UIInventoryItem } from '@/lib/types'
import type { InventoryItem as DbInventoryItem } from '@/hooks/data/useInventory'

export function inventoryItemFromDb(db: DbInventoryItem): UIInventoryItem {
  return {
    id: db.id,
    name: db.name,
    category: db.category as UIInventoryItem['category'],
    sku: db.sku ?? '',
    quantity: db.quantity,
    price: db.price ?? 0,
    cost: db.cost ?? 0,
    avgUnitCost: db.avg_unit_cost ?? null,
    inventoryValue: db.inventory_value ?? 0,
    lastUnitCost: db.last_unit_cost ?? null,
    reorderLevel: db.reorder_level,
    supplier: db.supplier ?? undefined,
    description: db.description ?? undefined,
    staffCompensationType: db.staff_compensation_type === 'none'
      ? undefined
      : (db.staff_compensation_type as UIInventoryItem['staffCompensationType']),
    staffCompensationValue: db.staff_compensation_value ?? undefined,
    isActive: db.is_active,
    updated_at: db.updated_at,
  }
}

export function inventoryItemToDb(
  ui: UIInventoryItem
): Omit<DbInventoryItem, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    name: ui.name,
    category: ui.category,
    sku: ui.sku || undefined,
    quantity: ui.quantity,
    price: ui.price || undefined,
    cost: ui.cost || undefined,
    reorder_level: ui.reorderLevel,
    supplier: ui.supplier ?? undefined,
    description: ui.description ?? undefined,
    staff_compensation_type: ui.staffCompensationType ?? 'none',
    staff_compensation_value: ui.staffCompensationValue ?? undefined,
    is_active: ui.isActive ?? true,
  }
}

export function inventoryItemsFromDb(dbItems: DbInventoryItem[]): UIInventoryItem[] {
  return dbItems.map(inventoryItemFromDb)
}
