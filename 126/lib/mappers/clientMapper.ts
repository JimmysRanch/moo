import type { Client as UIClient } from '@/lib/types'
import type { Client as DbClient, Pet as DbPet } from '@/hooks/data/useClients'
import type { Appointment as DbAppointment } from '@/hooks/data/useAppointments'
import { formatDateForDisplay, getTodayInBusinessTimezone } from '@/lib/date-utils'
import { petsFromDb } from './petMapper'

type ClientVisitDates = Pick<UIClient, 'lastVisit' | 'nextVisit'>

function buildClientVisitDatesByClient(
  dbAppointments: DbAppointment[],
  today: string = getTodayInBusinessTimezone()
): Map<string, ClientVisitDates> {
  const visitDatesByClient = new Map<string, ClientVisitDates>()

  for (const appointment of dbAppointments) {
    const existing = visitDatesByClient.get(appointment.client_id) ?? {}

    if (
      appointment.status === 'completed' &&
      (!existing.lastVisit || appointment.date > existing.lastVisit)
    ) {
      existing.lastVisit = appointment.date
    }

    if (
      appointment.date >= today &&
      appointment.status !== 'cancelled' &&
      appointment.status !== 'no_show' &&
      (!existing.nextVisit || appointment.date < existing.nextVisit)
    ) {
      existing.nextVisit = appointment.date
    }

    visitDatesByClient.set(appointment.client_id, existing)
  }

  return new Map(
    Array.from(visitDatesByClient.entries()).map(([clientId, visitDates]) => [
      clientId,
      {
        lastVisit: visitDates.lastVisit ? formatDateForDisplay(visitDates.lastVisit) : undefined,
        nextVisit: visitDates.nextVisit ? formatDateForDisplay(visitDates.nextVisit) : undefined,
      },
    ])
  )
}

export function clientFromDb(
  db: DbClient,
  dbPets: DbPet[] = [],
  visitDates?: ClientVisitDates
): UIClient {
  return {
    id: db.id,
    name: `${db.first_name} ${db.last_name}`.trim(),
    firstName: db.first_name,
    lastName: db.last_name,
    email: db.email ?? '',
    phone: db.phone ?? '',
    pets: petsFromDb(dbPets),
    createdAt: db.created_at,
    address: db.address ?? undefined,
    referralSource: db.referral_source ?? undefined,
    lastVisit: visitDates?.lastVisit,
    nextVisit: visitDates?.nextVisit,
  }
}

export function clientToDb(
  ui: UIClient
): Omit<DbClient, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  const firstName = ui.firstName ?? ui.name.split(' ')[0] ?? ''
  const lastName = ui.lastName ?? ui.name.split(' ').slice(1).join(' ') ?? ''

  return {
    first_name: firstName,
    last_name: lastName,
    email: ui.email || undefined,
    phone: ui.phone || undefined,
    address: ui.address ?? undefined,
    referral_source: ui.referralSource ?? undefined,
  }
}

export function clientsFromDb(
  dbClients: DbClient[],
  dbPetsByClient: Map<string, DbPet[]>,
  dbAppointments: DbAppointment[] = []
): UIClient[] {
  const visitDatesByClient = buildClientVisitDatesByClient(dbAppointments)
  return dbClients.map((c) =>
    clientFromDb(c, dbPetsByClient.get(c.id) ?? [], visitDatesByClient.get(c.id))
  )
}
