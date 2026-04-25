import type { Appointment as UIAppointment, AppointmentService as UIAppointmentService } from '@/lib/types'
import type { Appointment as DbAppointment, AppointmentService as DbAppointmentService } from '@/hooks/data/useAppointments'

type UIStatus = UIAppointment['status']

// DB → UI status mapping.
// Handles both the new canonical values (post-migration 035) and the legacy
// values that may still exist in databases where migration 035 hasn't run yet.
const dbStatusToUi: Record<string, UIStatus> = {
  // Canonical post-migration values
  scheduled:   'scheduled',
  checked_in:  'checked_in',
  in_progress: 'in_progress',
  ready:       'ready',
  picked_up:   'picked_up',
  cancelled:   'cancelled',
  no_show:     'no_show',
  // Legacy pre-migration values — kept for backward compatibility until
  // migration 035 has been applied to all environments.
  confirmed:   'checked_in',
  completed:   'picked_up',
}

const uiStatusToDb: Record<UIStatus, string> = {
  scheduled:   'scheduled',
  checked_in:  'checked_in',
  in_progress: 'in_progress',
  ready:       'ready',
  picked_up:   'picked_up',
  cancelled:   'cancelled',
  no_show:     'no_show',
}

function mapDbServices(dbServices: DbAppointmentService[]): UIAppointmentService[] {
  return dbServices.map((s) => ({
    // service_id references the service catalog; fall back to row id for inline services
    serviceId: s.service_id ?? s.id,
    serviceName: s.service_name,
    price: s.price,
    type: s.service_type === 'addon' ? 'addon' : 'main',
  }))
}

export function appointmentFromDb(
  db: DbAppointment,
  dbServices?: DbAppointmentService[],
  clientName?: string,
  petName?: string,
  petBreed?: string,
  petWeight?: number,
  petWeightCategory?: string,
  groomerName?: string
): UIAppointment {
  return {
    id: db.id,
    clientId: db.client_id,
    clientName: clientName ?? '',
    petId: db.pet_id ?? '',
    petName: petName ?? '',
    petBreed: petBreed ?? undefined,
    petWeight: petWeight ?? 0,
    petWeightCategory: (petWeightCategory as UIAppointment['petWeightCategory']) ?? 'medium',
    groomerId: db.groomer_id ?? '',
    groomerName: groomerName ?? '',
    groomerRequested: false,
    date: db.date,
    startTime: db.start_time,
    endTime: db.end_time,
    services: dbServices ? mapDbServices(dbServices) : [],
    totalPrice: db.total_price,
    status: dbStatusToUi[db.status as string] ?? 'scheduled',
    tipAmount: db.tip_amount ?? undefined,
    tipPaymentMethod: db.tip_payment_method as UIAppointment['tipPaymentMethod'],
    notes: db.notes ?? undefined,
    groomingPreferences: db.grooming_preferences as UIAppointment['groomingPreferences'],
    isLate: db.is_late ?? false,
    checkedInAt: db.checked_in_at ?? null,
    inProgressAt: db.in_progress_at ?? null,
    readyAt: db.ready_at ?? null,
    pickedUpAt: db.picked_up_at ?? null,
    clientNotifiedAt: db.client_notified_at ?? null,
    notificationType: db.notification_type ?? null,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export function appointmentToDb(
  ui: UIAppointment
): Omit<DbAppointment, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    client_id: ui.clientId,
    pet_id: ui.petId || undefined,
    groomer_id: ui.groomerId || undefined,
    date: ui.date,
    start_time: ui.startTime,
    end_time: ui.endTime,
    status: (uiStatusToDb[ui.status] ?? 'scheduled') as DbAppointment['status'],
    total_price: ui.totalPrice,
    tip_amount: ui.tipAmount ?? undefined,
    tip_payment_method: ui.tipPaymentMethod ?? undefined,
    notes: ui.notes ?? undefined,
    grooming_preferences: ui.groomingPreferences as Record<string, unknown> | undefined,
    is_late: ui.isLate,
    checked_in_at: ui.checkedInAt ?? null,
    in_progress_at: ui.inProgressAt ?? null,
    ready_at: ui.readyAt ?? null,
    picked_up_at: ui.pickedUpAt ?? null,
    client_notified_at: ui.clientNotifiedAt ?? null,
    notification_type: ui.notificationType ?? null,
  }
}

