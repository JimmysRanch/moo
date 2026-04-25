import type { Staff as UIStaff } from '@/lib/types'
import type { Staff as DbStaff } from '@/hooks/data/useStaff'
import { format } from 'date-fns'

type DbStatus = 'active' | 'on_leave' | 'inactive'
type UIStatus = UIStaff['status']

const dbStatusToUi: Record<DbStatus, UIStatus> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
}

function formatHireDate(createdAt: string): string | undefined {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return undefined
  return format(parsed, 'dd-MM-yyyy')
}

export function staffFromDb(db: DbStaff): UIStaff {
  return {
    id: db.id,
    name: `${db.first_name ?? ''} ${db.last_name ?? ''}`.trim() || db.email || 'Staff Member',
    role: db.role,
    email: db.email ?? '',
    phone: db.phone ?? '',
    status: dbStatusToUi[db.status] ?? 'Active',
    isGroomer: db.is_groomer,
    isOwner: db.is_owner ?? false,
    canTakeAppointments: db.can_take_appointments ?? false,
    specialties: db.specialties ?? undefined,
    hourlyRate: db.hourly_rate != null ? String(db.hourly_rate) : undefined,
    hireDate: db.hire_date ?? formatHireDate(db.created_at),
    address: db.address ?? undefined,
    emergencyContact: {
      name: db.emergency_contact_name ?? undefined,
      relation: db.emergency_contact_relation ?? undefined,
      phone: db.emergency_contact_phone ?? undefined,
    },
    notes: db.notes ?? undefined,
  }
}

export function staffToDb(
  ui: UIStaff
): Omit<DbStaff, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  const nameParts = ui.name.split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') ?? ''

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: ui.email || undefined,
    phone: ui.phone || undefined,
    role: ui.role,
    status: (() => {
      if (ui.status === 'Inactive') return 'inactive'
      if (ui.status === 'On Leave') return 'on_leave'
      return 'active'
    })(),
    is_groomer: ui.isGroomer,
    can_take_appointments: ui.canTakeAppointments ?? false,
    specialties: ui.specialties ?? undefined,
    address: ui.address ?? undefined,
    emergency_contact_name: ui.emergencyContact?.name ?? undefined,
    emergency_contact_relation: ui.emergencyContact?.relation ?? undefined,
    emergency_contact_phone: ui.emergencyContact?.phone ?? undefined,
    notes: ui.notes ?? undefined,
    hire_date: ui.hireDate || undefined,
    hourly_rate: (() => {
      if (ui.hourlyRate == null || ui.hourlyRate === '') return undefined
      const parsed = parseFloat(ui.hourlyRate)
      return isFinite(parsed) ? parsed : undefined
    })(),
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Omit<DbStaff, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
}

export function staffListFromDb(dbStaff: DbStaff[]): UIStaff[] {
  return dbStaff.map(staffFromDb)
}
