import type { InventoryItem } from '@/lib/types'

export interface InventorySummary {
  costValue: number
  totalPotentialRevenue: number
  supplyValue: number
  potentialProfit: number
  itemCount: number
  retailCount: number
  supplyCount: number
}

export interface InventorySnapshotValues {
  total_value: number
  retail_value: number
  supply_value: number
  item_count: number
}

export function getInventoryUnitCostBasis(item: InventoryItem): number {
  return Number(item.avgUnitCost ?? item.cost ?? 0)
}

export function getInventoryCostValue(item: InventoryItem): number {
  if (typeof item.inventoryValue === 'number' && Number.isFinite(item.inventoryValue)) {
    return Number(item.inventoryValue)
  }

  return Number(item.quantity) * getInventoryUnitCostBasis(item)
}

export function getInventoryCompensationPerUnit(item: InventoryItem): number {
  const compensationValue = Number(item.staffCompensationValue ?? 0)
  const price = Number(item.price ?? 0)

  switch (item.staffCompensationType) {
    case 'fixed':
      return compensationValue
    case 'percentage':
      return price * (compensationValue / 100)
    default:
      return 0
  }
}

export function getInventoryPotentialProfitPerUnit(item: InventoryItem): number {
  return Number(item.price ?? 0) - getInventoryUnitCostBasis(item) - getInventoryCompensationPerUnit(item)
}

export function calculateInventorySummary(items: InventoryItem[]): InventorySummary {
  const activeItems = items.filter(item => item.isActive !== false)
  const retailItems = activeItems.filter(item => item.category === 'retail')
  const supplyItems = activeItems.filter(item => item.category === 'supply')

  return {
    costValue: activeItems.reduce((sum, item) => sum + getInventoryCostValue(item), 0),
    totalPotentialRevenue: retailItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.price ?? 0)), 0),
    supplyValue: supplyItems.reduce((sum, item) => sum + getInventoryCostValue(item), 0),
    potentialProfit: retailItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) * getInventoryPotentialProfitPerUnit(item))
    }, 0),
    itemCount: activeItems.length,
    retailCount: retailItems.length,
    supplyCount: supplyItems.length,
  }
}

export function createInventorySnapshotValues(items: InventoryItem[]): InventorySnapshotValues {
  const summary = calculateInventorySummary(items)

  return {
    total_value: summary.costValue,
    retail_value: summary.totalPotentialRevenue,
    supply_value: summary.supplyValue,
    item_count: summary.itemCount,
  }
}
