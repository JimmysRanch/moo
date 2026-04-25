import type { BusinessSettings as DbBusinessSettings } from '@/hooks/data/useBusinessSettings'
import type { HoursOfOperation } from '@/lib/business-hours'

export type { HoursOfOperation }

export interface BookingRules {
  allowConcurrentAppointments: boolean
  maxAppointmentsPerSlot: number
}

export interface BusinessInfo {
  companyName: string
  businessPhone: string
  businessEmail: string
  address: string
  city: string
  state: string
  zipCode: string
  timezone: string
  website: string
  hoursOfOperation?: HoursOfOperation[]
  bookingRules?: BookingRules
}

export function businessSettingsFromDb(db: DbBusinessSettings): BusinessInfo {
  return {
    companyName: db.company_name ?? '',
    businessPhone: db.phone ?? '',
    businessEmail: db.email ?? '',
    address: db.address?.street ?? '',
    city: db.address?.city ?? '',
    state: db.address?.state ?? '',
    zipCode: db.address?.zip ?? '',
    timezone: db.timezone ?? '',
    website: db.address?.website ?? '',
    hoursOfOperation: db.hours_of_operation ?? undefined,
    bookingRules: {
      allowConcurrentAppointments: db.booking_rules?.allow_concurrent_appointments ?? false,
      maxAppointmentsPerSlot: Math.max(1, db.booking_rules?.max_appointments_per_slot ?? 1),
    },
  }
}

export function businessSettingsToDb(
  ui: BusinessInfo
): Partial<Omit<DbBusinessSettings, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>> {
  return {
    company_name: ui.companyName || undefined,
    phone: ui.businessPhone || undefined,
    email: ui.businessEmail || undefined,
    address: {
      street: ui.address || undefined,
      city: ui.city || undefined,
      state: ui.state || undefined,
      zip: ui.zipCode || undefined,
      website: ui.website || undefined,
    },
    timezone: ui.timezone || 'America/New_York',
    hours_of_operation: ui.hoursOfOperation ?? undefined,
    booking_rules: ui.bookingRules
      ? {
          allow_concurrent_appointments: ui.bookingRules.allowConcurrentAppointments,
          max_appointments_per_slot: Math.max(1, ui.bookingRules.maxAppointmentsPerSlot),
        }
      : undefined,
  }
}
