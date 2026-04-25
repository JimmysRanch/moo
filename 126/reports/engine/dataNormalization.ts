/**
 * Data Normalization Layer
 * Transforms raw app data into normalized structures for analytics
 */

import {
  NormalizedAppointment,
  NormalizedTransaction,
  NormalizedStaff,
  NormalizedClient,
  NormalizedInventoryItem,
  NormalizedMessage,
  NormalizedService,
  NormalizedDataStore,
  PetSize,
  Channel,
  ClientType,
  PaymentMethod,
  AppointmentStatus,
} from '../types'
import { Appointment, Client, Staff, InventoryItem, Transaction } from '@/lib/types'
import type { StaffCompensation } from '@/hooks/data/useStaffExtensions'

/**
 * Normalize appointments from app data
 */
/** Minimal checkout price info needed for report normalization */
export interface ReportCheckoutData {
  total: number
  totalBeforeTip: number
  subtotal: number
  discount: number
  additionalFees: number
  taxAmount: number
  tipAmount: number
  paymentMethod: string
}

export function normalizeAppointments(
  appointments: Appointment[],
  transactions: Transaction[],
  clients: Client[],
  checkoutMap?: Map<string, ReportCheckoutData>
): NormalizedAppointment[] {
  const clientMap = new Map(clients.map(c => [c.id, c]))
  const transactionsByAppt = new Map<string, Transaction>()
  
  transactions.forEach(t => {
    if (t.appointmentId) {
      transactionsByAppt.set(t.appointmentId, t)
    }
  })

  return appointments.map(appt => {
    const _client = clientMap.get(appt.clientId)
    const transaction = transactionsByAppt.get(appt.id)
    const checkout = checkoutMap?.get(appt.id)
    
    // Determine client type
    const clientAppointments = appointments.filter(a => 
      a.clientId === appt.clientId && 
      new Date(a.date) < new Date(appt.date)
    )
    const clientType: ClientType = clientAppointments.length === 0 ? 'new' : 'returning'
    
    // Calculate durations
    const startParts = appt.startTime.split(':').map(Number)
    const endParts = appt.endTime.split(':').map(Number)
    const scheduledMinutes = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])
    
    // Map status – canonical 1:1 mapping (statuses now match between UI and DB)
    const statusMap: Record<string, AppointmentStatus> = {
      'picked_up':   'picked_up',
      'ready':       'ready',
      'in_progress': 'in_progress',
      'checked_in':  'checked_in',
      'scheduled':   'scheduled',
      'cancelled':   'cancelled',
      'no_show':     'no_show',
    }
    const status = statusMap[appt.status] || 'scheduled'
    
    // Determine channel (simplified - in real app would track this)
    const channel: Channel = 'online'
    
    // Calculate amounts in cents — prefer checkout data (from payment_intents),
    // fall back to transaction, then appointment booking price
    const subtotalAmount = checkout?.subtotal ?? transaction?.subtotal ?? appt.totalPrice
    const discountAmount = checkout?.discount ?? transaction?.discount ?? 0
    const additionalFeesAmount = checkout?.additionalFees ?? transaction?.additionalFees ?? 0
    const tipAmount = checkout?.tipAmount ?? transaction?.tipAmount ?? appt.tipAmount ?? 0
    const totalBeforeTipAmount = checkout?.totalBeforeTip ?? (transaction ? transaction.total - tipAmount : undefined)
    const inferredTaxAmount = totalBeforeTipAmount !== undefined
      ? Math.max(0, totalBeforeTipAmount - subtotalAmount + discountAmount - additionalFeesAmount)
      : 0
    const taxAmount = checkout?.taxAmount
      ?? (transaction
        ? Math.max(0, transaction.total - transaction.subtotal + (transaction.discount || 0) - transaction.additionalFees - (transaction.tipAmount || 0))
        : inferredTaxAmount)
    const revenueBeforeTaxAmount = totalBeforeTipAmount !== undefined
      ? Math.max(0, totalBeforeTipAmount - taxAmount)
      : Math.max(0, subtotalAmount - discountAmount + additionalFeesAmount)
    const totalAmount = checkout?.total ?? transaction?.total ?? (revenueBeforeTaxAmount + taxAmount + tipAmount)

    const subtotalCents = Math.round(subtotalAmount * 100)
    const discountCents = Math.round(discountAmount * 100)
    const additionalFeesCents = Math.round(additionalFeesAmount * 100)
    const taxCents = Math.round(taxAmount * 100)
    const tipCents = Math.round(tipAmount * 100)
    const totalCents = Math.round(totalAmount * 100)
    const netCents = Math.round(revenueBeforeTaxAmount * 100)
    
    // Payment method — prefer checkout data, fall back to transaction/appointment
    const rawPaymentMethod = checkout?.paymentMethod ?? transaction?.paymentMethod ?? appt.tipPaymentMethod
    const paymentMethod: PaymentMethod = 
      rawPaymentMethod?.toLowerCase() === 'cash' ? 'cash' :
      rawPaymentMethod?.toLowerCase() === 'card' ? 'card' : 'card'
    
    // Normalize services
    const services: NormalizedService[] = appt.services.map(s => ({
      id: s.serviceId,
      name: s.serviceName,
      category: s.type === 'main' ? 'Main Services' : 'Add-ons',
      priceCents: Math.round(s.price * 100),
      durationMinutes: 30, // Default, would calculate based on service
    }))

    // Map pet weight category
    const petSizeMap: Record<string, PetSize> = {
      'small': 'small',
      'medium': 'medium',
      'large': 'large',
      'giant': 'giant',
      'xxlarge': 'xxlarge',
    }
    
    return {
      id: appt.id,
      clientId: appt.clientId,
      clientName: appt.clientName,
      petId: appt.petId,
      petName: appt.petName,
      petBreed: appt.petBreed,
      petWeight: appt.petWeight,
      petWeightCategory: petSizeMap[appt.petWeightCategory] || 'medium',
      groomerId: appt.groomerId,
      groomerName: appt.groomerName,
      serviceDate: appt.date,
      checkoutDate: status === 'picked_up' ? appt.pickedUpAt?.slice(0, 10) ?? appt.date : undefined,
      transactionDate: transaction?.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      scheduledDurationMinutes: scheduledMinutes,
      durationMinutes: scheduledMinutes,
      services,
      subtotalCents,
      discountCents,
      additionalFeesCents,
      taxCents,
      tipCents,
      totalCents,
      netCents,
      status,
      channel,
      clientType,
      paymentMethod,
      rebookedWithin24h: false,
      rebookedWithin7d: false,
      rebookedWithin30d: false,
      noShowFlag: status === 'no_show',
      lateCancelFlag: false,
      isLate: appt.isLate ?? false,
      reminderSent: true,
      reminderConfirmed: true,
      clientNotifiedAt: appt.clientNotifiedAt ?? null,
      notificationType: appt.notificationType ?? null,
      createdAt: appt.createdAt,
      isTaxable: taxCents > 0,
      taxableAmountCents: netCents,
      taxRatePercent: netCents > 0 ? (taxCents / netCents) * 100 : 0,
      taxJurisdiction: 'Default',
    }
  })
}

/**
 * Normalize transactions from app data
 */
export function normalizeTransactions(transactions: Transaction[]): NormalizedTransaction[] {
  return transactions.map(t => {
    const subtotalCents = Math.round(t.subtotal * 100)
    const discountCents = Math.round(t.discount * 100)
    const totalCents = Math.round(t.total * 100)
    const tipCents = Math.round(t.tipAmount * 100)
    const additionalFeesCents = Math.round((t.additionalFees || 0) * 100)
    const taxCents = Math.max(0, totalCents - subtotalCents - additionalFeesCents - tipCents + discountCents)
    const refundCents = t.status === 'refunded' ? totalCents : 0
    
    // Estimate processing fee (2.9% + $0.30 for card)
    const isCard = t.paymentMethod.toLowerCase().includes('card')
    const processingFeeCents = isCard ? Math.round(totalCents * 0.029 + 30) : 0
    
    const paymentMethodMap: Record<string, PaymentMethod> = {
      'cash': 'cash',
      'card': 'card',
      'credit card': 'card',
      'debit card': 'card',
    }
    
    return {
      id: t.id,
      appointmentId: t.appointmentId,
      date: t.date,
      clientId: t.clientId,
      clientName: t.clientName,
      subtotalCents,
      discountCents,
      taxCents,
      tipCents,
      totalCents,
      amountCents: totalCents,
      refundCents,
      processingFeeCents,
      netToBank: totalCents - processingFeeCents - refundCents,
      paymentMethod: paymentMethodMap[t.paymentMethod.toLowerCase()] || 'other',
      type: t.type === 'refund' ? 'refund' : t.type === 'adjustment' ? 'adjustment' : 'payment',
      status: t.status === 'completed' ? 'settled' : t.status === 'refunded' ? 'refunded' : 'pending',
    }
  })
}

/**
 * Normalize staff from app data
 */
/**
 * Normalizes commission settings to the percent-style values used by reports.
 * Some sources store rates as decimals (0.4) while others store percentages
 * (40), so reports convert both representations to whole-number percentages.
 */
function normalizeCommissionPercent(rate?: number | null): number | undefined {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return undefined
  return rate > 1 ? rate : rate * 100
}

export function normalizeStaff(
  staff: Staff[],
  compensationMap?: Map<string, StaffCompensation>,
  defaultCommissionRate?: number | null
): NormalizedStaff[] {
  const defaultCommissionPercent = normalizeCommissionPercent(defaultCommissionRate) ?? 40

  return staff.map(s => {
    const compensation = compensationMap?.get(s.id)
    const compensationHourlyRate = compensation?.hourly_rate
    const hourlyRate = typeof compensationHourlyRate === 'number' && Number.isFinite(compensationHourlyRate) && compensationHourlyRate > 0
      ? compensationHourlyRate
      : s.hourlyRate
        ? parseFloat(s.hourlyRate)
        : undefined

    return {
      id: s.id,
      name: s.name,
      role: s.role,
      isGroomer: s.isGroomer,
      hourlyRateCents: typeof hourlyRate === 'number' && Number.isFinite(hourlyRate) ? Math.round(hourlyRate * 100) : undefined,
      commissionPercent: normalizeCommissionPercent(compensation?.commission_percentage) ?? defaultCommissionPercent,
      hireDate: s.hireDate,
      status: s.status === 'Active' ? 'active' : s.status === 'On Leave' ? 'on-leave' : 'inactive',
    }
  })
}

/**
 * Normalize clients from app data
 */
export function normalizeClients(clients: Client[], appointments: NormalizedAppointment[]): NormalizedClient[] {
  return clients.map(c => {
    const clientAppointments = appointments
      .filter(a => a.clientId === c.id && a.status === 'picked_up')
      .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime())
    
    const totalSpentCents = clientAppointments.reduce((sum, a) => sum + a.totalCents, 0)
    
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt || new Date().toISOString(),
      firstVisitDate: clientAppointments[0]?.serviceDate,
      lastVisitDate: clientAppointments[clientAppointments.length - 1]?.serviceDate,
      totalVisits: clientAppointments.length,
      totalSpentCents,
      referralSource: c.referralSource,
      city: c.address?.city,
      zip: c.address?.zip,
    }
  })
}

/**
 * Normalize inventory items from app data
 */
export function normalizeInventoryItems(items: InventoryItem[]): NormalizedInventoryItem[] {
  return items.map(i => ({
    id: i.id,
    name: i.name,
    category: i.category,
    sku: i.sku,
    quantityOnHand: i.quantity,
    unitCostCents: Math.round(i.cost * 100),
    reorderLevel: i.reorderLevel,
    linkedServiceIds: [],
    usagePerAppointment: i.category === 'supply' ? 0.1 : 0, // Estimate
  }))
}

/**
 * Generate sample messages (since app doesn't have messages yet)
 */
export function normalizeMessages(): NormalizedMessage[] {
  // Return empty array - messages would be populated when feature exists
  return []
}

/**
 * Extract unique services from appointments
 */
export function extractServices(appointments: NormalizedAppointment[]): NormalizedService[] {
  const serviceMap = new Map<string, NormalizedService>()
  
  appointments.forEach(appt => {
    appt.services.forEach(service => {
      if (!serviceMap.has(service.id)) {
        serviceMap.set(service.id, service)
      }
    })
  })
  
  return Array.from(serviceMap.values())
}

/**
 * Create complete normalized data store from raw app data
 */
export function createNormalizedDataStore(
  rawAppointments: Appointment[],
  rawTransactions: Transaction[],
  rawStaff: Staff[],
  rawClients: Client[],
  rawInventory: InventoryItem[],
  checkoutMap?: Map<string, ReportCheckoutData>,
  compensationMap?: Map<string, StaffCompensation>,
  defaultCommissionRate?: number | null
): NormalizedDataStore {
  const appointments = normalizeAppointments(rawAppointments, rawTransactions, rawClients, checkoutMap)
  const transactions = normalizeTransactions(rawTransactions)
  const staff = normalizeStaff(rawStaff, compensationMap, defaultCommissionRate)
  const clients = normalizeClients(rawClients, appointments)
  const inventoryItems = normalizeInventoryItems(rawInventory)
  const messages = normalizeMessages()
  const services = extractServices(appointments)
  
  return {
    appointments,
    transactions,
    staff,
    clients,
    inventoryItems,
    messages,
    services,
  }
}

/**
 * Generate hash for filter state (used for caching)
 */
export function generateFilterHash(filters: Record<string, unknown>): string {
  const sortedKeys = Object.keys(filters).sort()
  const values = sortedKeys.map(k => `${k}:${JSON.stringify(filters[k])}`)
  return values.join('|')
}
