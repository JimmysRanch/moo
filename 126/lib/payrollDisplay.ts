import type { Appointment as DbAppointment, AppointmentService as DbAppointmentService } from '@/hooks/data/useAppointments'
import type { Client as DbClient, Pet as DbPet } from '@/hooks/data/useClients'
import type { Service as DbService } from '@/hooks/data/useServices'
import type { Staff as DbStaff } from '@/hooks/data/useStaff'
import type { Appointment, Transaction } from '@/lib/types'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { formatTimeLabel } from '@/lib/business-hours'

const DEFAULT_COMMISSION_RATE = 0.5

function formatFullName(firstName?: string, lastName?: string) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim()
}

function resolvePayrollServiceName(service: DbAppointmentService, serviceNameById: Map<string, string>) {
  const serviceName = service.service_name?.trim()
  if (serviceName) return serviceName
  if (service.service_id) return serviceNameById.get(service.service_id) ?? ''
  return ''
}

export function getPayrollStaffName(staff?: DbStaff, appointmentGroomerName?: string) {
  return appointmentGroomerName || formatFullName(staff?.first_name, staff?.last_name) || 'Staff Member'
}

export function getPayrollCommissionRate(defaultCommissionRate?: number | null) {
  if (typeof defaultCommissionRate !== 'number' || !Number.isFinite(defaultCommissionRate) || defaultCommissionRate <= 0) {
    return DEFAULT_COMMISSION_RATE
  }

  return defaultCommissionRate > 1 ? defaultCommissionRate / 100 : defaultCommissionRate
}

export function hydrateAppointmentsForPayroll({
  dbAppointments,
  dbAppointmentServices,
  dbServiceCatalog,
  dbClients,
  dbPets,
  dbStaff,
}: {
  dbAppointments?: DbAppointment[]
  dbAppointmentServices?: DbAppointmentService[]
  dbServiceCatalog?: DbService[]
  dbClients?: DbClient[]
  dbPets?: DbPet[]
  dbStaff?: DbStaff[]
}): Appointment[] {
  if (!dbAppointments?.length) return []

  const servicesByAppointment = new Map<string, DbAppointmentService[]>()
  for (const service of dbAppointmentServices ?? []) {
    const existing = servicesByAppointment.get(service.appointment_id) ?? []
    existing.push(service)
    servicesByAppointment.set(service.appointment_id, existing)
  }

  const clientMap = new Map((dbClients ?? []).map((client) => [client.id, client]))
  const petMap = new Map((dbPets ?? []).map((pet) => [pet.id, pet]))
  const staffMap = new Map((dbStaff ?? []).map((staff) => [staff.id, staff]))
  const serviceNameById = new Map((dbServiceCatalog ?? []).map((service) => [service.id, service.name]))

  return dbAppointments.map((appointment) => {
    const client = clientMap.get(appointment.client_id)
    const pet = appointment.pet_id ? petMap.get(appointment.pet_id) : undefined
    const staff = appointment.groomer_id ? staffMap.get(appointment.groomer_id) : undefined
    const appointmentServices = servicesByAppointment.get(appointment.id)?.map((service) => ({
      ...service,
      service_name: resolvePayrollServiceName(service, serviceNameById),
    }))

    return appointmentFromDb(
      appointment,
      appointmentServices,
      client ? formatFullName(client.first_name, client.last_name) : '',
      pet?.name ?? '',
      pet?.breed ?? undefined,
      pet?.weight ?? undefined,
      pet?.weight_category ?? undefined,
      staff ? getPayrollStaffName(staff) : '',
    )
  })
}

export function getPayrollTipMethod(method?: string, paymentMethod?: string): 'Cash' | 'Card' {
  if (method === 'cash') return 'Cash'
  if (method === 'card') return 'Card'
  if (paymentMethod?.toLowerCase().includes('cash')) return 'Cash'
  return 'Card'
}

export function getPayrollTipDetails(appointment: Appointment, transaction?: Transaction) {
  const tipAmount = transaction?.tipAmount ?? appointment.tipAmount ?? 0
  const tipPaymentMethod = getPayrollTipMethod(
    transaction?.tipPaymentMethod ?? appointment.tipPaymentMethod,
    transaction?.paymentMethod,
  )
  const tipPaidInPayroll = tipPaymentMethod === 'Card'

  return {
    tipAmount,
    tipPaymentMethod,
    tipPaidInPayroll,
    payrollTipAmount: tipPaidInPayroll ? tipAmount : 0,
  }
}

export function getPayrollRevenue(appointment: Appointment, transaction?: Transaction) {
  const { tipAmount } = getPayrollTipDetails(appointment, transaction)
  return transaction ? Math.max(0, transaction.total - tipAmount) : appointment.totalPrice
}

export function formatPayrollTime(time: string) {
  return formatTimeLabel(time)
}

export function getPayrollServiceLabel(appointment: Appointment, transaction?: Transaction) {
  const services = appointment.services
    .map((service) => service.serviceName.trim())
    .filter(Boolean)

  if (services.length > 0) return services.join(', ')

  // Fall back to transaction item names when appointment_services are empty
  if (transaction?.items?.length) {
    const txServices = transaction.items
      .filter((item) => item.type === 'service')
      .map((item) => item.name.trim())
      .filter(Boolean)
    if (txServices.length > 0) return txServices.join(', ')
  }

  return '—'
}
