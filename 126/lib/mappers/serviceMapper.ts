import type { MainService, AddOn, ServicePricing } from '@/lib/types'
import type { Service as DbService } from '@/hooks/data/useServices'

function getXXLargePrice(db: DbService): number {
  const giantPrice = db.price_giant ?? 0
  const largePrice = db.price_large ?? 0
  const step = Math.max(giantPrice - largePrice, 0)
  return db.price_xxlarge ?? (giantPrice + step)
}

function buildPricing(db: DbService): ServicePricing {
  return {
    small: db.price_small ?? 0,
    medium: db.price_medium ?? 0,
    large: db.price_large ?? 0,
    giant: db.price_giant ?? 0,
    xxlarge: getXXLargePrice(db),
  }
}

export function serviceToMainService(db: DbService): MainService {
  return {
    id: db.id,
    name: db.name,
    description: db.description ?? '',
    pricing: buildPricing(db),
    estimatedDurationMinutes: db.estimated_duration_minutes,
  }
}

export function serviceToAddOn(db: DbService): AddOn {
  const pricing = buildPricing(db)
  return {
    id: db.id,
    name: db.name,
    hasSizePricing: db.has_size_pricing,
    ...(db.has_size_pricing
      ? { pricing }
      : { price: db.price_small ?? 0 }),
    estimatedDurationMinutes: db.estimated_duration_minutes,
  }
}

export function mainServiceToDb(
  ui: MainService
): Omit<DbService, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'display_order'> {
  return {
    name: ui.name,
    description: ui.description || undefined,
    service_type: 'main',
    has_size_pricing: true,
    price_small: ui.pricing.small,
    price_medium: ui.pricing.medium,
    price_large: ui.pricing.large,
    price_giant: ui.pricing.giant,
    price_xxlarge: ui.pricing.xxlarge,
    is_active: true,
    estimated_duration_minutes: ui.estimatedDurationMinutes,
  }
}

export function addOnToDb(
  ui: AddOn
): Omit<DbService, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'display_order'> {
  return {
    name: ui.name,
    service_type: 'addon',
    has_size_pricing: ui.hasSizePricing,
    price_small: ui.hasSizePricing ? (ui.pricing?.small ?? 0) : ui.price,
    price_medium: ui.hasSizePricing ? (ui.pricing?.medium ?? 0) : ui.price,
    price_large: ui.hasSizePricing ? (ui.pricing?.large ?? 0) : ui.price,
    price_giant: ui.hasSizePricing ? (ui.pricing?.giant ?? 0) : ui.price,
    price_xxlarge: ui.hasSizePricing ? (ui.pricing?.xxlarge ?? 0) : ui.price,
    is_active: true,
    estimated_duration_minutes: ui.estimatedDurationMinutes,
  }
}
