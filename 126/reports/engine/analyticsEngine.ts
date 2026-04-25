/**
 * Analytics Engine
 * Core calculation functions for reports
 * All functions are pure and stateless for easy testing and caching
 */

import {
  NormalizedAppointment,
  NormalizedTransaction,
  NormalizedClient,
  NormalizedStaff,
  NormalizedInventoryItem,
  NormalizedMessage,
  NormalizedService,
  ReportFilters,
  TimeBasis,
  KPIValue,
  ChartDataPoint,
  AggregatedRow,
  DrillRow,
} from '../types'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, startOfYear, parseISO, differenceInDays } from 'date-fns'

const DEFAULT_COMMISSION_PERCENT = 40
const DEFAULT_HOURLY_RATE_CENTS = 1500

// ==================== Date Range Utilities ====================

export function getDateRange(filters: ReportFilters): { start: Date; end: Date } {
  const today = new Date()
  
  switch (filters.dateRange) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday':
      return { start: subDays(today, 1), end: subDays(today, 1) }
    case 'last7':
      return { start: subDays(today, 6), end: today }
    case 'thisWeek':
      return { start: startOfWeek(today), end: endOfWeek(today) }
    case 'last30':
      return { start: subDays(today, 29), end: today }
    case 'last90':
      return { start: subDays(today, 89), end: today }
    case 'thisMonth':
      return { start: startOfMonth(today), end: endOfMonth(today) }
    case 'lastMonth': {
      const lastMonth = subDays(startOfMonth(today), 1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }
    case 'quarter':
      return { start: startOfQuarter(today), end: today }
    case 'ytd':
      return { start: startOfYear(today), end: today }
    case 'custom':
      return {
        start: filters.customDateStart ? parseISO(filters.customDateStart) : subDays(today, 29),
        end: filters.customDateEnd ? parseISO(filters.customDateEnd) : today,
      }
    default:
      return { start: subDays(today, 29), end: today }
  }
}

export function getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const daysDiff = differenceInDays(end, start) + 1
  return {
    start: subDays(start, daysDiff),
    end: subDays(end, daysDiff),
  }
}

function getDateByBasis(appt: NormalizedAppointment, basis: TimeBasis): string | undefined {
  switch (basis) {
    case 'service':
      return appt.serviceDate
    case 'checkout':
      return appt.checkoutDate || appt.serviceDate
    case 'transaction':
      return appt.transactionDate || appt.checkoutDate || appt.serviceDate
    default:
      return appt.serviceDate
  }
}

function isDateInRange(dateStr: string | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false
  const date = parseISO(dateStr)
  return date >= start && date <= end
}

// ==================== Filter Functions ====================

export function filterAppointments(
  appointments: NormalizedAppointment[],
  filters: ReportFilters
): NormalizedAppointment[] {
  const { start, end } = getDateRange(filters)
  
  return appointments.filter(appt => {
    // Date filter by time basis
    const apptDate = getDateByBasis(appt, filters.timeBasis)
    if (!isDateInRange(apptDate, start, end)) return false
    
    // Status filter
    if (filters.appointmentStatuses.length > 0) {
      if (!filters.appointmentStatuses.includes(appt.status)) return false
    }
    
    // Staff filter
    if (filters.staffIds.length > 0) {
      if (!filters.staffIds.includes(appt.groomerId)) return false
    }
    
    // Service filter
    if (filters.serviceIds.length > 0) {
      const apptServiceIds = appt.services.map(s => s.id)
      if (!filters.serviceIds.some(id => apptServiceIds.includes(id))) return false
    }
    
    // Pet size filter
    if (filters.petSizes.length > 0) {
      if (!filters.petSizes.includes(appt.petWeightCategory)) return false
    }
    
    // Channel filter
    if (filters.channels.length > 0) {
      if (!filters.channels.includes(appt.channel)) return false
    }
    
    // Client type filter
    if (filters.clientTypes.length > 0) {
      if (!filters.clientTypes.includes(appt.clientType)) return false
    }
    
    // Payment method filter
    if (filters.paymentMethods.length > 0 && appt.paymentMethod) {
      if (!filters.paymentMethods.includes(appt.paymentMethod)) return false
    }
    
    return true
  })
}

export function filterTransactions(
  transactions: NormalizedTransaction[],
  filters: ReportFilters
): NormalizedTransaction[] {
  const { start, end } = getDateRange(filters)
  
  return transactions.filter(t => {
    // Date filter
    if (!isDateInRange(t.date, start, end)) return false
    
    // Payment method filter
    if (filters.paymentMethods.length > 0) {
      if (!filters.paymentMethods.includes(t.paymentMethod)) return false
    }
    
    return true
  })
}

// ==================== KPI Calculations ====================

export function calculateGrossSales(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + a.subtotalCents, 0)
}

export function calculateNetSales(
  appointments: NormalizedAppointment[],
  includeDiscounts: boolean = true,
  _includeRefunds: boolean = true
): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => {
      let net = a.subtotalCents
      if (includeDiscounts) net -= a.discountCents
      return sum + net
    }, 0)
}

export function calculateTotalTips(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + a.tipCents, 0)
}

export function calculateTotalTax(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + a.taxCents, 0)
}

export function calculateTotalCollected(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + a.totalCents, 0)
}

export function calculateTotalDiscounts(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + a.discountCents, 0)
}

export function calculateAppointmentsCompleted(appointments: NormalizedAppointment[]): number {
  return appointments.filter(a => a.status === 'picked_up').length
}

export function calculateAverageTicket(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const totalNet = calculateNetSales(completed)
  return Math.round(totalNet / completed.length)
}

export function calculateNoShowRate(appointments: NormalizedAppointment[]): number {
  const total = appointments.filter(a => 
    a.status === 'picked_up' || a.status === 'no_show' || a.lateCancelFlag
  ).length
  if (total === 0) return 0
  const noShows = appointments.filter(a => a.noShowFlag).length
  return (noShows / total) * 100
}

export function calculateLateCancelRate(appointments: NormalizedAppointment[]): number {
  const total = appointments.length
  if (total === 0) return 0
  const lateCancels = appointments.filter(a => a.lateCancelFlag).length
  return (lateCancels / total) * 100
}

export function calculateRebook24h(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const rebooked = completed.filter(a => a.rebookedWithin24h).length
  return (rebooked / completed.length) * 100
}

export function calculateRebook7d(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const rebooked = completed.filter(a => a.rebookedWithin7d).length
  return (rebooked / completed.length) * 100
}

export function calculateRebook30d(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const rebooked = completed.filter(a => a.rebookedWithin30d).length
  return (rebooked / completed.length) * 100
}

export function calculateUtilization(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[],
  workHoursPerDay: number = 8
): number {
  const { start, end } = { start: new Date(), end: new Date() } // Would use actual range
  const workDays = Math.max(1, differenceInDays(end, start) + 1)
  const groomers = staff.filter(s => s.isGroomer && s.status === 'active')
  const totalAvailableMinutes = groomers.length * workDays * workHoursPerDay * 60
  
  if (totalAvailableMinutes === 0) return 0
  
  const bookedMinutes = appointments
    .filter(a => a.status === 'picked_up' || a.status === 'scheduled')
    .reduce((sum, a) => sum + a.scheduledDurationMinutes, 0)
  
  return (bookedMinutes / totalAvailableMinutes) * 100
}

// Margin calculations
export function calculateContributionMargin(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[]
): number {
  const netSales = calculateNetSales(appointments)
  const processingFees = transactions.reduce((sum, t) => sum + t.processingFeeCents, 0)
  const laborCost = appointments.reduce((sum, a) => {
    // Estimate labor at 40% of service price
    return sum + Math.round(a.subtotalCents * 0.4)
  }, 0)
  
  return netSales - processingFees - laborCost
}

export function calculateContributionMarginPercent(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[]
): number {
  const netSales = calculateNetSales(appointments)
  if (netSales === 0) return 0
  const margin = calculateContributionMargin(appointments, transactions)
  return (margin / netSales) * 100
}

// ==================== Chart Data Generation ====================

export function generateSalesByDayChart(
  appointments: NormalizedAppointment[],
  filters: ReportFilters
): ChartDataPoint[] {
  const { start, end } = getDateRange(filters)
  const dayMap = new Map<string, number>()
  
  // Initialize all days in range
  let current = new Date(start)
  while (current <= end) {
    const key = format(current, 'yyyy-MM-dd')
    dayMap.set(key, 0)
    current = new Date(current.getTime() + 86400000)
  }
  
  // Sum sales by day
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const date = getDateByBasis(a, filters.timeBasis) || a.serviceDate
      const key = date.substring(0, 10)
      dayMap.set(key, (dayMap.get(key) || 0) + a.netCents)
    })
  
  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      label: format(parseISO(date), 'MMM d'),
      value,
    }))
}

export function generateSalesByServiceCategory(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const categoryMap = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        categoryMap.set(s.category, (categoryMap.get(s.category) || 0) + s.priceCents)
      })
    })
  
  return Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({
      label: category,
      value,
    }))
}

export function generateRevenueByStaff(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const staffMap = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      staffMap.set(a.groomerName, (staffMap.get(a.groomerName) || 0) + a.netCents)
    })
  
  return Array.from(staffMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      label: name,
      value,
    }))
}

export function generateWeekdayHourHeatmap(
  appointments: NormalizedAppointment[]
): { weekday: string; hour: number; value: number }[] {
  const heatmapData: { weekday: string; hour: number; value: number }[] = []
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const dataMap = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const date = parseISO(a.serviceDate)
      const weekday = weekdays[date.getDay()]
      const hour = parseInt(a.startTime.split(':')[0])
      const key = `${weekday}-${hour}`
      dataMap.set(key, (dataMap.get(key) || 0) + a.netCents)
    })
  
  weekdays.forEach(weekday => {
    for (let hour = 8; hour <= 18; hour++) {
      const key = `${weekday}-${hour}`
      heatmapData.push({
        weekday,
        hour,
        value: dataMap.get(key) || 0,
      })
    }
  })
  
  return heatmapData
}

// ==================== Additional Chart Functions ====================

export function generateMarginByServiceChart(
  appointments: NormalizedAppointment[],
  _transactions: NormalizedTransaction[],
  _inventoryItems: NormalizedInventoryItem[]
): ChartDataPoint[] {
  const serviceData = new Map<string, { revenue: number; margin: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        const existing = serviceData.get(s.name) || { revenue: 0, margin: 0 }
        existing.revenue += s.priceCents
        // Estimate margin at 50%
        existing.margin += Math.round(s.priceCents * 0.5)
        serviceData.set(s.name, existing)
      })
    })
  
  return Array.from(serviceData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.revenue > 0 ? (data.margin / data.revenue * 100) : 0,
      metadata: { revenue: data.revenue, margin: data.margin }
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateMarginByStaffChart(
  appointments: NormalizedAppointment[],
  _transactions: NormalizedTransaction[]
): ChartDataPoint[] {
  const staffData = new Map<string, { revenue: number; margin: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffData.get(a.groomerName) || { revenue: 0, margin: 0 }
      existing.revenue += a.netCents
      existing.margin += Math.round(a.netCents * 0.5) // Estimate margin
      staffData.set(a.groomerName, existing)
    })
  
  return Array.from(staffData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.margin,
      metadata: { revenue: data.revenue }
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateSalesByCategoryStackChart(
  appointments: NormalizedAppointment[]
): { category: string; data: ChartDataPoint[] }[] {
  const categoryByDate = new Map<string, Map<string, number>>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const dateKey = a.serviceDate.substring(0, 10)
      a.services.forEach(s => {
        if (!categoryByDate.has(s.category)) {
          categoryByDate.set(s.category, new Map())
        }
        const dateMap = categoryByDate.get(s.category)!
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + s.priceCents)
      })
    })
  
  return Array.from(categoryByDate.entries()).map(([category, dateMap]) => ({
    category,
    data: Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        label: format(parseISO(date), 'MMM d'),
        value
      }))
  }))
}

export function generateRefundsByReasonChart(
  transactions: NormalizedTransaction[]
): ChartDataPoint[] {
  const reasonMap = new Map<string, number>()
  
  transactions
    .filter(t => t.type === 'refund')
    .forEach(t => {
      const reason = t.refundReason || 'Unknown'
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + Math.abs(t.amountCents))
    })
  
  return Array.from(reasonMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, value]) => ({
      label: reason,
      value
    }))
}

export function generateBookedVsCapacityChart(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[],
  workHoursPerDay: number = 8
): ChartDataPoint[] {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdayData = new Map<string, { booked: number; capacity: number }>()
  
  // Initialize all weekdays
  weekdays.forEach(day => {
    weekdayData.set(day, { booked: 0, capacity: 0 })
  })
  
  // Calculate daily capacity
  const groomers = staff.filter(s => s.isGroomer && s.status === 'active')
  const dailyCapacity = groomers.length * workHoursPerDay * 60 // minutes
  
  appointments.forEach(a => {
    const date = parseISO(a.serviceDate)
    const weekday = weekdays[date.getDay()]
    const data = weekdayData.get(weekday)!
    data.booked += a.scheduledDurationMinutes
    data.capacity = dailyCapacity
  })
  
  return weekdays.slice(1, 6).concat(['Saturday']).map(weekday => { // Mon-Sat
    const data = weekdayData.get(weekday) || { booked: 0, capacity: dailyCapacity }
    return {
      label: weekday.substring(0, 3),
      value: data.booked,
      previousValue: data.capacity
    }
  })
}

export function generateDurationOverrunTrend(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const dayMap = new Map<string, { overrun: number; count: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up' && a.actualDurationMinutes)
    .forEach(a => {
      const key = a.serviceDate.substring(0, 10)
      const existing = dayMap.get(key) || { overrun: 0, count: 0 }
      existing.overrun += Math.max(0, (a.actualDurationMinutes || 0) - a.scheduledDurationMinutes)
      existing.count++
      dayMap.set(key, existing)
    })
  
  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      label: format(parseISO(date), 'MMM d'),
      value: data.count > 0 ? Math.round(data.overrun / data.count) : 0
    }))
}

export function generateNoShowHeatmap(
  appointments: NormalizedAppointment[]
): { weekday: string; hour: number; value: number }[] {
  const heatmapData: { weekday: string; hour: number; value: number }[] = []
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const dataMap = new Map<string, { noShows: number; total: number }>()
  
  appointments.forEach(a => {
    const date = parseISO(a.serviceDate)
    const weekday = weekdays[date.getDay()]
    const hour = parseInt(a.startTime.split(':')[0])
    const key = `${weekday}-${hour}`
    const existing = dataMap.get(key) || { noShows: 0, total: 0 }
    existing.total++
    if (a.status === 'no_show') {
      existing.noShows++
    }
    dataMap.set(key, existing)
  })
  
  weekdays.forEach(weekday => {
    for (let hour = 8; hour <= 18; hour++) {
      const key = `${weekday}-${hour}`
      const data = dataMap.get(key) || { noShows: 0, total: 0 }
      heatmapData.push({
        weekday,
        hour,
        value: data.total > 0 ? (data.noShows / data.total * 100) : 0
      })
    }
  })
  
  return heatmapData
}

export function generateRatesByReminderChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const sentData = appointments.filter(a => a.reminderSent)
  const notSentData = appointments.filter(a => !a.reminderSent)
  
  const sentNoShowRate = sentData.length > 0 
    ? (sentData.filter(a => a.status === 'no_show').length / sentData.length * 100) 
    : 0
  const notSentNoShowRate = notSentData.length > 0 
    ? (notSentData.filter(a => a.status === 'no_show').length / notSentData.length * 100) 
    : 0
  
  return [
    { label: 'With Reminder', value: sentNoShowRate },
    { label: 'No Reminder', value: notSentNoShowRate }
  ]
}

export function generateRebookFunnel(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const completed = appointments.filter(a => a.status === 'picked_up')
  const total = completed.length
  const rebook24h = completed.filter(a => a.rebookedWithin24h).length
  const rebook7d = completed.filter(a => a.rebookedWithin7d).length
  const rebook30d = completed.filter(a => a.rebookedWithin30d).length
  
  return [
    { label: 'Completed', value: total },
    { label: 'Rebooked ≤24h', value: rebook24h },
    { label: 'Rebooked ≤7d', value: rebook7d },
    { label: 'Rebooked ≤30d', value: rebook30d }
  ]
}

export function generateTimeToReturnDistribution(
  appointments: NormalizedAppointment[],
  _clients: NormalizedClient[]
): ChartDataPoint[] {
  const distribution = {
    '0-7': 0,
    '8-14': 0,
    '15-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0
  }
  
  appointments
    .filter(a => a.status === 'picked_up' && a.daysToNextVisit !== undefined)
    .forEach(a => {
      const days = a.daysToNextVisit || 0
      if (days <= 7) distribution['0-7']++
      else if (days <= 14) distribution['8-14']++
      else if (days <= 30) distribution['15-30']++
      else if (days <= 60) distribution['31-60']++
      else if (days <= 90) distribution['61-90']++
      else distribution['90+']++
    })
  
  return Object.entries(distribution).map(([label, value]) => ({ label, value }))
}

export function generateCohortRetentionGrid(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): { cohort: string; month: number; retention: number }[] {
  // Simple monthly cohort analysis
  const cohorts = new Map<string, Set<string>>()
  
  clients.forEach(c => {
    if (c.firstVisitDate) {
      const cohortKey = c.firstVisitDate.substring(0, 7) // YYYY-MM
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, new Set())
      }
      cohorts.get(cohortKey)!.add(c.id)
    }
  })
  
  const result: { cohort: string; month: number; retention: number }[] = []
  
  cohorts.forEach((clientIds, cohortKey) => {
    // Track retention for each subsequent month
    for (let month = 0; month <= 6; month++) {
      const targetMonth = new Date(cohortKey + '-01')
      targetMonth.setMonth(targetMonth.getMonth() + month)
      const targetKey = format(targetMonth, 'yyyy-MM')
      
      const activeInMonth = appointments.filter(a => 
        clientIds.has(a.clientId) && 
        a.serviceDate.substring(0, 7) === targetKey &&
        a.status === 'picked_up'
      ).length
      
      result.push({
        cohort: cohortKey,
        month,
        retention: clientIds.size > 0 ? (activeInMonth / clientIds.size * 100) : 0
      })
    }
  })
  
  return result
}

export function generateLTVByChannelChart(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const channelLTV = new Map<string, { revenue: number; count: number }>()
  
  // Group appointments by client's acquisition channel (if available via referral source)
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const channel = a.channel
      const existing = channelLTV.get(channel) || { revenue: 0, count: 0 }
      existing.revenue += a.netCents
      existing.count++
      channelLTV.set(channel, existing)
    })
  
  return Array.from(channelLTV.entries())
    .map(([channel, data]) => ({
      label: channel,
      value: data.count > 0 ? Math.round(data.revenue / data.count) : 0
    }))
}

export function generateRevenueMarginByStaffChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const staffData = new Map<string, { revenue: number; margin: number; hours: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffData.get(a.groomerName) || { revenue: 0, margin: 0, hours: 0 }
      existing.revenue += a.netCents
      existing.margin += Math.round(a.netCents * 0.5)
      existing.hours += (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60
      staffData.set(a.groomerName, existing)
    })
  
  return Array.from(staffData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.hours > 0 ? Math.round(data.revenue / data.hours) : 0,
      previousValue: data.hours > 0 ? Math.round(data.margin / data.hours) : 0,
      metadata: { revenue: data.revenue, margin: data.margin, hours: data.hours }
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateRebookRateByStaffChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  return generateRebookRateByStaff(appointments)
}

export function generateRevenuePerHourByStaff(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const staffData = new Map<string, { revenue: number; hours: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffData.get(a.groomerName) || { revenue: 0, hours: 0 }
      existing.revenue += a.netCents
      existing.hours += (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60
      staffData.set(a.groomerName, existing)
    })
  
  return Array.from(staffData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.hours > 0 ? Math.round(data.revenue / data.hours) : 0
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateRebookRateByStaff(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const staffData = new Map<string, { total: number; rebooked: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffData.get(a.groomerName) || { total: 0, rebooked: 0 }
      existing.total++
      if (a.rebookedWithin7d) existing.rebooked++
      staffData.set(a.groomerName, existing)
    })
  
  return Array.from(staffData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.total > 0 ? (data.rebooked / data.total * 100) : 0
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateRevenueVsMarginByService(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const serviceData = new Map<string, { revenue: number; margin: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        const existing = serviceData.get(s.name) || { revenue: 0, margin: 0 }
        existing.revenue += s.priceCents
        existing.margin += Math.round(s.priceCents * 0.5)
        serviceData.set(s.name, existing)
      })
    })
  
  return Array.from(serviceData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.revenue,
      previousValue: data.margin
    }))
}

export function generateDiscountVsMarginScatter(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const serviceData = new Map<string, { discountPercent: number; marginPercent: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        const apptDiscountPct = a.subtotalCents > 0 ? (a.discountCents / a.subtotalCents * 100) : 0
        const marginPct = 50 // Estimate
        const existing = serviceData.get(s.name) || { discountPercent: 0, marginPercent: 0 }
        // Rolling average
        existing.discountPercent = (existing.discountPercent + apptDiscountPct) / 2
        existing.marginPercent = marginPct
        serviceData.set(s.name, existing)
      })
    })
  
  return Array.from(serviceData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.discountPercent, // x-axis
      previousValue: data.marginPercent // y-axis (margin)
    }))
}

export function generateUsageByCategoryChart(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const categoryUsage = new Map<string, number>()
  
  inventoryItems.forEach(item => {
    const usage = item.usagePerAppointment || 1
    const totalUsed = appointments.filter(a => a.status === 'picked_up').length * usage
    const existing = categoryUsage.get(item.category) || 0
    categoryUsage.set(item.category, existing + totalUsed * item.unitCostCents)
  })
  
  return Array.from(categoryUsage.entries())
    .map(([category, value]) => ({
      label: category,
      value
    }))
}

export function generateCostPerApptTrend(
  appointments: NormalizedAppointment[],
  _inventoryItems: NormalizedInventoryItem[]
): ChartDataPoint[] {
  const dayMap = new Map<string, { cost: number; count: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const key = a.serviceDate.substring(0, 10)
      const existing = dayMap.get(key) || { cost: 0, count: 0 }
      // Estimate supply cost at 5% of net
      existing.cost += Math.round(a.netCents * 0.05)
      existing.count++
      dayMap.set(key, existing)
    })
  
  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      label: format(parseISO(date), 'MMM d'),
      value: data.count > 0 ? Math.round(data.cost / data.count) : 0
    }))
}

export function generateROIByChannelChart(
  messages: NormalizedMessage[],
  _appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const channelROI = new Map<string, { revenue: number; cost: number }>()
  
  messages.forEach(m => {
    const channel = m.channel || 'unknown'
    const existing = channelROI.get(channel) || { revenue: 0, cost: 0 }
    existing.cost += m.costCents || 1
    if (m.showedUp) {
      existing.revenue += m.revenueCents || 0
    }
    channelROI.set(channel, existing)
  })
  
  return Array.from(channelROI.entries())
    .map(([channel, data]) => ({
      label: channel,
      value: data.cost > 0 ? ((data.revenue - data.cost) / data.cost * 100) : 0
    }))
}

export function generateTipPercentByServiceChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const serviceData = new Map<string, { tips: number; revenue: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        const existing = serviceData.get(s.name) || { tips: 0, revenue: 0 }
        existing.tips += a.tipCents / a.services.length
        existing.revenue += s.priceCents
        serviceData.set(s.name, existing)
      })
    })
  
  return Array.from(serviceData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.revenue > 0 ? (data.tips / data.revenue * 100) : 0
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateTipPercentByStaffChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const staffData = new Map<string, { tips: number; revenue: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffData.get(a.groomerName) || { tips: 0, revenue: 0 }
      existing.tips += a.tipCents
      existing.revenue += a.netCents
      staffData.set(a.groomerName, existing)
    })
  
  return Array.from(staffData.entries())
    .map(([name, data]) => ({
      label: name,
      value: data.revenue > 0 ? (data.tips / data.revenue * 100) : 0
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateTipTrendChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const dayMap = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const key = a.serviceDate.substring(0, 10)
      dayMap.set(key, (dayMap.get(key) || 0) + a.tipCents)
    })
  
  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      label: format(parseISO(date), 'MMM d'),
      value
    }))
}

export function generateGrossVsNetTrend(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const weekMap = new Map<string, { gross: number; net: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const weekStart = format(startOfWeek(parseISO(a.serviceDate)), 'yyyy-MM-dd')
      const existing = weekMap.get(weekStart) || { gross: 0, net: 0 }
      existing.gross += a.subtotalCents
      existing.net += a.netCents
      weekMap.set(weekStart, existing)
    })
  
  return Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8) // Last 8 weeks
    .map(([date, data]) => ({
      label: format(parseISO(date), 'MMM d'),
      value: data.gross,
      previousValue: data.net
    }))
}

export function generateServiceMixDonut(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  return generateSalesByServiceCategory(appointments)
}

// ==================== Table Aggregation ====================

export function aggregateByDimension(
  appointments: NormalizedAppointment[],
  dimension: 'service' | 'staff' | 'day' | 'week' | 'month' | 'channel' | 'clientType' | 'paymentMethod'
): AggregatedRow[] {
  const groups = new Map<string, NormalizedAppointment[]>()
  
  appointments.forEach(a => {
    let key: string
    switch (dimension) {
      case 'service':
        a.services.forEach(s => {
          const existing = groups.get(s.name) || []
          existing.push(a)
          groups.set(s.name, existing)
        })
        return
      case 'staff':
        key = a.groomerName
        break
      case 'day':
        key = a.serviceDate
        break
      case 'week':
        key = format(startOfWeek(parseISO(a.serviceDate)), 'yyyy-MM-dd')
        break
      case 'month':
        key = format(parseISO(a.serviceDate), 'yyyy-MM')
        break
      case 'channel':
        key = a.channel
        break
      case 'clientType':
        key = a.clientType
        break
      case 'paymentMethod':
        key = a.paymentMethod || 'Unknown'
        break
      default:
        key = 'All'
    }
    const existing = groups.get(key) || []
    existing.push(a)
    groups.set(key, existing)
  })
  
  return Array.from(groups.entries()).map(([dimensionValue, appts]) => {
    const completed = appts.filter(a => a.status === 'picked_up')
    return {
      id: dimensionValue,
      dimension,
      dimensionValue,
      metrics: {
        grossSales: calculateGrossSales(completed),
        netSales: calculateNetSales(completed),
        discounts: calculateTotalDiscounts(completed),
        tips: calculateTotalTips(completed),
        tax: calculateTotalTax(completed),
        appointments: completed.length,
        avgTicket: calculateAverageTicket(completed),
        noShowRate: calculateNoShowRate(appts),
      },
      drillKey: `${dimension}:${dimensionValue}`,
      matchingIds: appts.map(a => a.id),
    }
  }).sort((a, b) => b.metrics.netSales - a.metrics.netSales)
}

// ==================== Drill Row Generation ====================

export function getDrillRows(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[],
  drillKey: string
): DrillRow[] {
  const [dimension, value] = drillKey.split(':')
  
  let filteredAppts: NormalizedAppointment[] = []
  
  switch (dimension) {
    case 'service':
      filteredAppts = appointments.filter(a => 
        a.services.some(s => s.name === value)
      )
      break
    case 'staff':
      filteredAppts = appointments.filter(a => a.groomerName === value)
      break
    case 'day':
      filteredAppts = appointments.filter(a => a.serviceDate === value)
      break
    case 'channel':
      filteredAppts = appointments.filter(a => a.channel === value)
      break
    case 'clientType':
      filteredAppts = appointments.filter(a => a.clientType === value)
      break
    default:
      filteredAppts = appointments
  }
  
  return filteredAppts.map(a => ({
    id: a.id,
    type: 'appointment' as const,
    data: a,
    timestamp: a.serviceDate,
  }))
}

// ==================== KPI with Delta ====================

export function calculateKPIWithDelta(
  currentValue: number,
  previousValue: number,
  format: 'money' | 'percent' | 'number' | 'minutes' | 'days'
): KPIValue {
  const delta = currentValue - previousValue
  const deltaPercent = previousValue !== 0 ? (delta / previousValue) * 100 : 0
  
  return {
    current: currentValue,
    previous: previousValue,
    delta,
    deltaPercent,
    format,
  }
}

// ==================== Additional KPI Calculations ====================

export function calculateGrossMarginPercent(
  appointments: NormalizedAppointment[],
  inventoryItems: NormalizedInventoryItem[]
): number {
  const netSales = calculateNetSales(appointments)
  if (netSales === 0) return 0
  const cogs = calculateEstimatedCOGS(appointments, inventoryItems)
  return ((netSales - cogs) / netSales) * 100
}

export function calculateAvgMarginPerAppt(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[]
): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const margin = calculateContributionMargin(completed, transactions)
  return Math.round(margin / completed.length)
}

export function calculateEstimatedCOGS(
  appointments: NormalizedAppointment[],
  _inventoryItems: NormalizedInventoryItem[]
): number {
  // Simple estimate: 5% of net sales for supplies
  const netSales = calculateNetSales(appointments)
  return Math.round(netSales * 0.05)
}

export function calculateProcessingFees(transactions: NormalizedTransaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.processingFeeCents || 0), 0)
}

export function calculateDirectLabor(
  appointments: NormalizedAppointment[],
  _staff: NormalizedStaff[]
): number {
  // Estimate labor at 40% of service price
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + Math.round(a.subtotalCents * 0.4), 0)
}

export function calculateTotalRefunds(transactions: NormalizedTransaction[]): number {
  return transactions
    .filter(t => t.type === 'refund')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0)
}

export function calculateTotalCollectedTransaction(transactions: NormalizedTransaction[]): number {
  return transactions
    .filter(t => t.status === 'settled' && t.type !== 'refund')
    .reduce((sum, t) => sum + t.amountCents, 0)
}

export function calculatePendingUnpaid(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[]
): number {
  const settledApptIds = new Set(
    transactions.filter(t => t.status === 'settled').map(t => t.appointmentId)
  )
  return appointments
    .filter(a => a.status === 'picked_up' && !settledApptIds.has(a.id))
    .reduce((sum, a) => sum + a.totalCents, 0)
}

export function calculateNetDeposits(transactions: NormalizedTransaction[]): number {
  return transactions
    .filter(t => t.status === 'settled')
    .reduce((sum, t) => sum + t.amountCents - (t.processingFeeCents || 0), 0)
}

export function calculateBookedAppointments(appointments: NormalizedAppointment[]): number {
  return appointments.length
}

export function calculateCancelledAppointments(appointments: NormalizedAppointment[]): number {
  return appointments.filter(a => a.status === 'cancelled').length
}

export function calculateAvgLeadTime(appointments: NormalizedAppointment[]): number {
  const withLeadTime = appointments.filter(a => a.leadTimeDays !== undefined)
  if (withLeadTime.length === 0) return 0
  return withLeadTime.reduce((sum, a) => sum + (a.leadTimeDays || 0), 0) / withLeadTime.length
}

export function calculateLostRevenue(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'no_show' || a.status === 'cancelled')
    .reduce((sum, a) => sum + a.subtotalCents, 0)
}

export function calculateRecoveryRate(appointments: NormalizedAppointment[]): number {
  const failed = appointments.filter(a => a.status === 'no_show' || a.lateCancelFlag)
  if (failed.length === 0) return 0
  const recovered = failed.filter(a => a.rebookedWithin7d).length
  return (recovered / failed.length) * 100
}

export function calculateAvgDaysToNextVisit(
  appointments: NormalizedAppointment[],
  _clients: NormalizedClient[]
): number {
  const clientVisits = new Map<string, number[]>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const visits = clientVisits.get(a.clientId) || []
      visits.push(parseISO(a.serviceDate).getTime())
      clientVisits.set(a.clientId, visits)
    })
  
  let totalDays = 0
  let count = 0
  
  clientVisits.forEach(visits => {
    visits.sort((a, b) => a - b)
    for (let i = 1; i < visits.length; i++) {
      totalDays += (visits[i] - visits[i-1]) / (1000 * 60 * 60 * 24)
      count++
    }
  })
  
  return count > 0 ? Math.round(totalDays / count) : 0
}

export function calculateReturn90d(
  appointments: NormalizedAppointment[],
  clients: NormalizedClient[]
): number {
  const now = new Date()
  const cutoff = subDays(now, 90)
  
  const activeClients = clients.filter(c => {
    const lastVisit = c.lastVisitDate ? parseISO(c.lastVisitDate) : null
    return lastVisit && lastVisit >= cutoff
  })
  
  return clients.length > 0 ? (activeClients.length / clients.length) * 100 : 0
}

export function calculateAvgLTV12m(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): number {
  if (clients.length === 0) return 0
  
  const clientRevenue = new Map<string, number>()
  const now = new Date()
  const cutoff = subDays(now, 365)
  
  appointments
    .filter(a => a.status === 'picked_up' && parseISO(a.serviceDate) >= cutoff)
    .forEach(a => {
      clientRevenue.set(a.clientId, (clientRevenue.get(a.clientId) || 0) + a.netCents)
    })
  
  const totalRevenue = Array.from(clientRevenue.values()).reduce((a, b) => a + b, 0)
  return Math.round(totalRevenue / clients.length)
}

export function calculateMedianVisits12m(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): number {
  const now = new Date()
  const cutoff = subDays(now, 365)
  
  const clientVisits = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up' && parseISO(a.serviceDate) >= cutoff)
    .forEach(a => {
      clientVisits.set(a.clientId, (clientVisits.get(a.clientId) || 0) + 1)
    })
  
  const visits = Array.from(clientVisits.values()).sort((a, b) => a - b)
  if (visits.length === 0) return 0
  
  const mid = Math.floor(visits.length / 2)
  return visits.length % 2 === 0 
    ? Math.round((visits[mid - 1] + visits[mid]) / 2)
    : visits[mid]
}

export function calculateNewClients(
  clients: NormalizedClient[],
  filters: ReportFilters
): number {
  const { start, end } = getDateRange(filters)
  return clients.filter(c => {
    const firstVisit = c.firstVisitDate ? parseISO(c.firstVisitDate) : null
    return firstVisit && firstVisit >= start && firstVisit <= end
  }).length
}

export function calculateRetention90d(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): number {
  return calculateReturn90d(appointments, clients)
}

export function calculateRetention180d(
  clients: NormalizedClient[],
  _appointments: NormalizedAppointment[]
): number {
  const now = new Date()
  const cutoff = subDays(now, 180)
  
  const activeClients = clients.filter(c => {
    const lastVisit = c.lastVisitDate ? parseISO(c.lastVisitDate) : null
    return lastVisit && lastVisit >= cutoff
  })
  
  return clients.length > 0 ? (activeClients.length / clients.length) * 100 : 0
}

export function calculateRetention360d(
  clients: NormalizedClient[],
  _appointments: NormalizedAppointment[]
): number {
  const now = new Date()
  const cutoff = subDays(now, 365)
  
  const activeClients = clients.filter(c => {
    const lastVisit = c.lastVisitDate ? parseISO(c.lastVisitDate) : null
    return lastVisit && lastVisit >= cutoff
  })
  
  return clients.length > 0 ? (activeClients.length / clients.length) * 100 : 0
}

// Staff performance calculations
export function calculateRevenuePerHour(
  appointments: NormalizedAppointment[],
  _staff: NormalizedStaff[]
): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  const totalRevenue = completed.reduce((sum, a) => sum + a.netCents, 0)
  const totalHours = completed.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60, 0)
  return totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0
}

export function calculateMarginPerHour(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[],
  _staff: NormalizedStaff[]
): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  const margin = calculateContributionMargin(completed, transactions)
  const totalHours = completed.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60, 0)
  return totalHours > 0 ? Math.round(margin / totalHours) : 0
}

export function calculateStaffRebookRate(appointments: NormalizedAppointment[]): number {
  return calculateRebook7d(appointments)
}

export function calculateUpsellRate(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const withUpsell = completed.filter(a => a.services.length > 1 || a.addOns?.length > 0)
  return (withUpsell.length / completed.length) * 100
}

export function calculateStaffAvgTicket(appointments: NormalizedAppointment[]): number {
  return calculateAverageTicket(appointments)
}

export function calculateOnTimeStartPercent(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const onTime = completed.filter(a => a.onTimeStart !== false)
  return (onTime.length / completed.length) * 100
}

export function calculateTipsPerHour(
  appointments: NormalizedAppointment[],
  _staff: NormalizedStaff[]
): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  const totalTips = completed.reduce((sum, a) => sum + a.tipCents, 0)
  const totalHours = completed.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60, 0)
  return totalHours > 0 ? Math.round(totalTips / totalHours) : 0
}

// Payroll calculations
export function calculateTotalPayout(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[]
): number {
  const commission = calculateCommissionTotal(appointments, staff)
  const hourly = calculateHourlyTotal(appointments, staff)
  const tips = calculateTipsTotal(appointments)
  return commission + hourly + tips
}

export function calculateCommissionTotal(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[]
): number {
  const staffById = new Map(staff.map(member => [member.id, member]))
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => {
      const commissionPercent = staffById.get(a.groomerId)?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT
      return sum + Math.round(a.netCents * commissionPercent / 100)
    }, 0)
}

export function calculateHourlyTotal(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[]
): number {
  const staffById = new Map(staff.map(member => [member.id, member]))
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => {
      const hourlyRateCents = staffById.get(a.groomerId)?.hourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS
      const hoursWorked = (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60
      return sum + Math.round(hoursWorked * hourlyRateCents)
    }, 0)
}

export function calculateTipsTotal(appointments: NormalizedAppointment[]): number {
  return calculateTotalTips(appointments)
}

export function calculateAdjustmentsTotal(
  _staff: NormalizedStaff[],
  _filters: ReportFilters
): number {
  return 0 // Placeholder - would sum adjustments from staff records
}

// Service pricing calculations
export function calculateTopServiceRevenue(
  appointments: NormalizedAppointment[]
): { name: string; value: number } {
  const serviceRevenue = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        serviceRevenue.set(s.name, (serviceRevenue.get(s.name) || 0) + s.priceCents)
      })
    })
  
  let topService = { name: 'N/A', value: 0 }
  serviceRevenue.forEach((value, name) => {
    if (value > topService.value) {
      topService = { name, value }
    }
  })
  
  return topService
}

export function calculateTopServiceMargin(
  appointments: NormalizedAppointment[],
  _transactions: NormalizedTransaction[],
  _inventoryItems: NormalizedInventoryItem[]
): { name: string; value: number } {
  const serviceMargin = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      a.services.forEach(s => {
        const margin = Math.round(s.priceCents * 0.5) // Estimate 50% margin
        serviceMargin.set(s.name, (serviceMargin.get(s.name) || 0) + margin)
      })
    })
  
  let topService = { name: 'N/A', value: 0 }
  serviceMargin.forEach((value, name) => {
    if (value > topService.value) {
      topService = { name, value }
    }
  })
  
  return topService
}

export function calculateAttachUpsellRate(appointments: NormalizedAppointment[]): number {
  return calculateUpsellRate(appointments)
}

export function calculateAvgDurationVariance(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => 
    a.status === 'picked_up' && 
    a.actualDurationMinutes && 
    a.scheduledDurationMinutes
  )
  if (completed.length === 0) return 0
  
  const totalVariance = completed.reduce((sum, a) => 
    sum + ((a.actualDurationMinutes || 0) - (a.scheduledDurationMinutes || 0)), 0
  )
  
  return Math.round(totalVariance / completed.length)
}

// Inventory calculations
export function calculateItemsBelowReorder(inventoryItems: NormalizedInventoryItem[]): number {
  return inventoryItems.filter(i => 
    i.currentStock !== undefined && 
    i.reorderPoint !== undefined && 
    i.currentStock <= i.reorderPoint
  ).length
}

export function calculateDaysOfSupply(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[]
): number {
  // Simple estimate based on usage
  const totalStock = inventoryItems.reduce((sum, i) => sum + (i.currentStock || 0), 0)
  const dailyUsage = appointments.length > 0 ? appointments.length * 0.5 : 1
  return Math.round(totalStock / dailyUsage)
}

export function calculateCostUsed(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[],
  _filters: ReportFilters
): number {
  return appointments
    .filter(a => a.status === 'picked_up')
    .reduce((sum, a) => sum + Math.round(a.netCents * 0.05), 0)
}

export function calculateCostPerAppt(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[],
  filters: ReportFilters
): number {
  const completed = appointments.filter(a => a.status === 'picked_up')
  if (completed.length === 0) return 0
  const totalCost = calculateCostUsed(inventoryItems, completed, filters)
  return Math.round(totalCost / completed.length)
}

// Marketing calculations
export function calculateMessagesSent(messages: NormalizedMessage[]): number {
  return messages.length
}

export function calculateConfirmations(messages: NormalizedMessage[], _appointments: NormalizedAppointment[]): number {
  return messages.filter(m => m.confirmed).length
}

export function calculateAttributedShowUps(
  messages: NormalizedMessage[],
  appointments: NormalizedAppointment[],
  _config: { lastTouchDays: number; confirmationHours: number }
): number {
  return appointments.filter(a => a.status === 'picked_up' && a.messageAttributed).length
}

export function calculateCostPerShowUp(
  messages: NormalizedMessage[],
  appointments: NormalizedAppointment[],
  config: { lastTouchDays: number; confirmationHours: number }
): number {
  const showUps = calculateAttributedShowUps(messages, appointments, config)
  if (showUps === 0) return 0
  const totalCost = messages.reduce((sum, m) => sum + (m.costCents || 1), 0)
  return Math.round(totalCost / showUps)
}

export function calculateAttributedRevenue(
  messages: NormalizedMessage[],
  appointments: NormalizedAppointment[],
  _config: { lastTouchDays: number; confirmationHours: number }
): number {
  return appointments
    .filter(a => a.status === 'picked_up' && a.messageAttributed)
    .reduce((sum, a) => sum + a.netCents, 0)
}

export function calculateMessagingROI(
  messages: NormalizedMessage[],
  appointments: NormalizedAppointment[],
  config: { lastTouchDays: number; confirmationHours: number }
): number {
  const revenue = calculateAttributedRevenue(messages, appointments, config)
  const cost = messages.reduce((sum, m) => sum + (m.costCents || 1), 0)
  if (cost === 0) return 0
  return ((revenue - cost) / cost) * 100
}

// Tips calculations
export function calculateAvgTipPercent(appointments: NormalizedAppointment[]): number {
  const completed = appointments.filter(a => a.status === 'picked_up' && a.netCents > 0)
  if (completed.length === 0) return 0
  
  const totalTipPercent = completed.reduce((sum, a) => {
    return sum + (a.tipCents / a.netCents * 100)
  }, 0)
  
  return totalTipPercent / completed.length
}

export function calculateTipFeeCost(transactions: NormalizedTransaction[]): number {
  return transactions.reduce((sum, t) => sum + Math.round((t.tipCents || 0) * 0.03), 0)
}

export function calculateNetToStaff(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[],
  _staff: NormalizedStaff[]
): number {
  const totalTips = calculateTotalTips(appointments)
  const tipFees = calculateTipFeeCost(transactions)
  return totalTips - tipFees
}

// Tax calculations
export function calculateTaxableSales(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up' && a.isTaxable !== false)
    .reduce((sum, a) => sum + a.netCents, 0)
}

export function calculateNonTaxableSales(appointments: NormalizedAppointment[]): number {
  return appointments
    .filter(a => a.status === 'picked_up' && a.isTaxable === false)
    .reduce((sum, a) => sum + a.netCents, 0)
}

// ==================== Capacity/Appointments Functions ====================

export function aggregateCapacityByDayStaff(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[],
  workHoursPerDay: number = 8
): AggregatedRow[] {
  const dayStaffMap = new Map<string, {
    slots: number
    booked: number
    completed: number
    noShows: number
    totalDuration: number
    overrunMinutes: number
  }>()
  
  // Get unique days
  const days = [...new Set(appointments.map(a => a.serviceDate))]
  const groomers = staff.filter(s => s.isGroomer && s.status === 'active')
  
  // Initialize all day-staff combinations
  days.forEach(day => {
    groomers.forEach(groomer => {
      const key = `${day}|${groomer.id}`
      dayStaffMap.set(key, {
        slots: workHoursPerDay * 60, // Available minutes
        booked: 0,
        completed: 0,
        noShows: 0,
        totalDuration: 0,
        overrunMinutes: 0,
      })
    })
  })
  
  // Aggregate appointments
  appointments.forEach(a => {
    const key = `${a.serviceDate}|${a.groomerId}`
    const existing = dayStaffMap.get(key)
    if (existing) {
      existing.booked++
      existing.totalDuration += a.scheduledDurationMinutes
      if (a.status === 'picked_up') {
        existing.completed++
        const overrun = (a.actualDurationMinutes || a.scheduledDurationMinutes) - a.scheduledDurationMinutes
        if (overrun > 0) existing.overrunMinutes += overrun
      }
      if (a.status === 'no_show') existing.noShows++
    }
  })
  
  return Array.from(dayStaffMap.entries()).map(([key, data]) => {
    const [day, staffId] = key.split('|')
    const groomer = groomers.find(g => g.id === staffId)
    const utilization = data.slots > 0 ? (data.totalDuration / data.slots * 100) : 0
    
    return {
      id: key,
      dimension: 'day-staff',
      dimensionValue: `${day} - ${groomer?.name || 'Unknown'}`,
      metrics: {
        date: new Date(day).getTime(),
        staffId,
        staffName: groomer?.name || 'Unknown',
        slots: Math.floor(data.slots / 60), // Convert to hours
        capacity: data.slots,
        booked: data.booked,
        completed: data.completed,
        noShows: data.noShows,
        avgDuration: data.booked > 0 ? Math.round(data.totalDuration / data.booked) : 0,
        overrunMinutes: data.overrunMinutes,
        utilization: Math.round(utilization * 10) / 10,
      },
      drillKey: `day-staff:${key}`,
    }
  })
}

// ==================== No-Show/Cancellation Functions ====================

export function aggregateNoShowsBySegment(
  appointments: NormalizedAppointment[],
  dimension: 'service' | 'staff' | 'clientType' | 'channel'
): AggregatedRow[] {
  const groups = new Map<string, NormalizedAppointment[]>()
  
  appointments.forEach(a => {
    let key: string
    switch (dimension) {
      case 'service':
        a.services.forEach(s => {
          const existing = groups.get(s.name) || []
          existing.push(a)
          groups.set(s.name, existing)
        })
        return
      case 'staff':
        key = a.groomerName
        break
      case 'clientType':
        key = a.clientType
        break
      case 'channel':
        key = a.channel
        break
      default:
        key = 'All'
    }
    const existing = groups.get(key) || []
    existing.push(a)
    groups.set(key, existing)
  })
  
  return Array.from(groups.entries()).map(([segmentValue, appts]) => {
    const total = appts.length
    const noShows = appts.filter(a => a.status === 'no_show').length
    const lateCancels = appts.filter(a => a.lateCancelFlag).length
    const withReminder = appts.filter(a => a.reminderSent)
    const confirmed = appts.filter(a => a.reminderConfirmed).length
    const recovered = appts.filter(a => (a.status === 'no_show' || a.lateCancelFlag) && a.rebookedWithin7d).length
    const failedTotal = noShows + lateCancels
    
    return {
      id: segmentValue,
      dimension,
      dimensionValue: segmentValue,
      metrics: {
        appointments: total,
        noShows,
        lateCancels,
        noShowRate: total > 0 ? (noShows / total * 100) : 0,
        lateCancelRate: total > 0 ? (lateCancels / total * 100) : 0,
        avgLeadTime: 0, // Would calculate from createdAt vs serviceDate
        reminderSent: withReminder.length,
        confirmed,
        recoveryRate: failedTotal > 0 ? (recovered / failedTotal * 100) : 0,
      },
      drillKey: `no-show-segment:${dimension}:${segmentValue}`,
    }
  })
}

// ==================== Retention/Rebook Functions ====================

export function aggregateRetentionBySegment(
  appointments: NormalizedAppointment[],
  clients: NormalizedClient[],
  dimension: 'service' | 'staff' | 'clientType' | 'rfm'
): AggregatedRow[] {
  const groups = new Map<string, NormalizedAppointment[]>()
  
  appointments.filter(a => a.status === 'picked_up').forEach(a => {
    let key: string
    switch (dimension) {
      case 'service':
        a.services.forEach(s => {
          const existing = groups.get(s.name) || []
          existing.push(a)
          groups.set(s.name, existing)
        })
        return
      case 'staff':
        key = a.groomerName
        break
      case 'clientType':
        key = a.clientType
        break
      case 'rfm': {
        // Simple RFM segmentation
        const client = clients.find(c => c.id === a.clientId)
        if (client) {
          if (client.totalVisits >= 10 && client.totalSpentCents >= 100000) key = 'Champions'
          else if (client.totalVisits >= 5) key = 'Loyal'
          else if (client.totalVisits >= 2) key = 'Potential'
          else key = 'New'
        } else {
          key = 'Unknown'
        }
        break
      }
      default:
        key = 'All'
    }
    const existing = groups.get(key) || []
    existing.push(a)
    groups.set(key, existing)
  })
  
  return Array.from(groups.entries()).map(([segmentValue, appts]) => {
    const total = appts.length
    const rebook24h = appts.filter(a => a.rebookedWithin24h).length
    const rebook7d = appts.filter(a => a.rebookedWithin7d).length
    const rebook30d = appts.filter(a => a.rebookedWithin30d).length
    const withNextVisit = appts.filter(a => a.daysToNextVisit !== undefined)
    const avgInterval = withNextVisit.length > 0 
      ? withNextVisit.reduce((sum, a) => sum + (a.daysToNextVisit || 0), 0) / withNextVisit.length 
      : 0
    const lapsed = appts.filter(a => !a.rebookedWithin30d && (a.daysToNextVisit === undefined || a.daysToNextVisit > 90)).length
    
    return {
      id: segmentValue,
      dimension,
      dimensionValue: segmentValue,
      metrics: {
        completed: total,
        rebook24h,
        rebook24hRate: total > 0 ? (rebook24h / total * 100) : 0,
        rebook7d,
        rebook7dRate: total > 0 ? (rebook7d / total * 100) : 0,
        rebook30d,
        rebook30dRate: total > 0 ? (rebook30d / total * 100) : 0,
        avgInterval: Math.round(avgInterval),
        lapsed90d: lapsed,
      },
      drillKey: `retention-segment:${dimension}:${segmentValue}`,
    }
  })
}

// ==================== Client Cohort Functions ====================

export function getAtRiskClients(
  clients: NormalizedClient[],
  _appointments: NormalizedAppointment[]
): DrillRow[] {
  const now = new Date()
  const cutoff = subDays(now, 60) // Clients not seen in 60+ days
  
  const atRiskClients = clients.filter(c => {
    if (!c.lastVisitDate) return false
    const lastVisit = parseISO(c.lastVisitDate)
    return lastVisit < cutoff && c.totalVisits >= 2 // Returning clients only
  })
  
  return atRiskClients.map(c => ({
    id: c.id,
    type: 'client' as const,
    data: {
      ...c,
      daysSinceLastVisit: c.lastVisitDate 
        ? differenceInDays(now, parseISO(c.lastVisitDate))
        : undefined,
    },
    timestamp: c.lastVisitDate || c.createdAt,
  }))
}

export function aggregateCohortData(
  clients: NormalizedClient[],
  appointments: NormalizedAppointment[]
): AggregatedRow[] {
  const cohortMap = new Map<string, {
    clients: Set<string>
    revenue: number
    visits: number
    margin: number
  }>()
  
  // Group clients by first visit month
  clients.forEach(c => {
    if (c.firstVisitDate) {
      const cohortKey = c.firstVisitDate.substring(0, 7)
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, { clients: new Set(), revenue: 0, visits: 0, margin: 0 })
      }
      cohortMap.get(cohortKey)!.clients.add(c.id)
    }
  })
  
  // Calculate metrics per cohort
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const client = clients.find(c => c.id === a.clientId)
      if (client?.firstVisitDate) {
        const cohortKey = client.firstVisitDate.substring(0, 7)
        const cohort = cohortMap.get(cohortKey)
        if (cohort) {
          cohort.revenue += a.netCents
          cohort.visits++
          cohort.margin += Math.round(a.netCents * 0.5)
        }
      }
    })
  
  return Array.from(cohortMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohortKey, data]) => {
      const clientCount = data.clients.size
      return {
        id: cohortKey,
        dimension: 'cohort',
        dimensionValue: cohortKey,
        metrics: {
          cohortSize: clientCount,
          retentionPercent: 0, // Would need more complex calculation
          avgOrders: clientCount > 0 ? (data.visits / clientCount) : 0,
          revenuePerClient: clientCount > 0 ? Math.round(data.revenue / clientCount) : 0,
          marginPerClient: clientCount > 0 ? Math.round(data.margin / clientCount) : 0,
        },
        drillKey: `cohort:${cohortKey}`,
      }
    })
}

// Alias for backward compatibility
export const aggregateCohortMetrics = aggregateCohortData

// ==================== Staff Performance Functions ====================

export function aggregateStaffPerformance(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[]
): AggregatedRow[] {
  return staff.filter(s => s.isGroomer).map(s => {
    const staffAppts = appointments.filter(a => a.groomerId === s.id)
    const completed = staffAppts.filter(a => a.status === 'picked_up')
    
    const revenue = completed.reduce((sum, a) => sum + a.netCents, 0)
    const tips = completed.reduce((sum, a) => sum + a.tipCents, 0)
    const margin = Math.round(revenue * 0.5)
    const hours = completed.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60, 0)
    const noShows = staffAppts.filter(a => a.status === 'no_show').length
    const rebooked = completed.filter(a => a.rebookedWithin7d).length
    
    const scheduledDuration = completed.reduce((sum, a) => sum + a.scheduledDurationMinutes, 0)
    const actualDuration = completed.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes), 0)
    const durationVariance = scheduledDuration > 0 
      ? Math.round((actualDuration - scheduledDuration) / completed.length) 
      : 0
    
    const onTime = completed.filter(a => a.onTimeStart !== false).length
    
    return {
      id: s.id,
      dimension: 'staff',
      dimensionValue: s.name,
      metrics: {
        appointments: completed.length,
        hours: Math.round(hours * 10) / 10,
        revenue,
        margin,
        tips,
        revenuePerHour: hours > 0 ? Math.round(revenue / hours) : 0,
        marginPerHour: hours > 0 ? Math.round(margin / hours) : 0,
        rebookRate: completed.length > 0 ? (rebooked / completed.length * 100) : 0,
        noShowRate: staffAppts.length > 0 ? (noShows / staffAppts.length * 100) : 0,
        durationVariance,
        onTimePercent: completed.length > 0 ? (onTime / completed.length * 100) : 0,
        avgRating: 4.5, // Placeholder
      },
      drillKey: `staff-performance:${s.id}`,
    }
  })
}

// ==================== Service Mix Functions ====================

export function aggregateServiceMetrics(
  appointments: NormalizedAppointment[],
  _services: NormalizedService[]
): AggregatedRow[] {
  const serviceMap = new Map<string, {
    revenue: number
    appts: number
    discounts: number
    duration: number
    actualDuration: number
    cogs: number
    noShows: number
    rebooked: number
  }>()
  
  appointments.forEach(a => {
    a.services.forEach(s => {
      const existing = serviceMap.get(s.name) || {
        revenue: 0, appts: 0, discounts: 0, duration: 0, actualDuration: 0,
        cogs: 0, noShows: 0, rebooked: 0
      }
      
      if (a.status === 'picked_up') {
        existing.revenue += s.priceCents
        existing.appts++
        existing.discounts += a.discountCents / a.services.length
        existing.duration += s.durationMinutes
        existing.actualDuration += (a.actualDurationMinutes || a.scheduledDurationMinutes) / a.services.length
        existing.cogs += s.costCents || Math.round(s.priceCents * 0.05)
        if (a.rebookedWithin7d) existing.rebooked++
      }
      if (a.status === 'no_show') existing.noShows++
      
      serviceMap.set(s.name, existing)
    })
  })
  
  return Array.from(serviceMap.entries()).map(([serviceName, data]) => {
    const margin = data.revenue - data.cogs
    const marginPercent = data.revenue > 0 ? (margin / data.revenue * 100) : 0
    const avgTicket = data.appts > 0 ? Math.round(data.revenue / data.appts) : 0
    const discountPercent = data.revenue > 0 ? (data.discounts / (data.revenue + data.discounts) * 100) : 0
    const avgDuration = data.appts > 0 ? Math.round(data.duration / data.appts) : 0
    const variance = data.appts > 0 
      ? Math.round((data.actualDuration - data.duration) / data.appts) 
      : 0
    
    return {
      id: serviceName,
      dimension: 'service',
      dimensionValue: serviceName,
      metrics: {
        revenue: data.revenue,
        appointments: data.appts,
        avgTicket,
        discountPercent: Math.round(discountPercent * 10) / 10,
        avgDuration,
        durationVariance: variance,
        cogs: data.cogs,
        margin,
        marginPercent: Math.round(marginPercent * 10) / 10,
        noShowRate: (data.appts + data.noShows) > 0 
          ? (data.noShows / (data.appts + data.noShows) * 100) 
          : 0,
        rebookRate: data.appts > 0 ? (data.rebooked / data.appts * 100) : 0,
      },
      drillKey: `service:${serviceName}`,
    }
  })
}

// ==================== Tips Functions ====================

export function aggregateTipsByServiceStaff(
  appointments: NormalizedAppointment[],
  dimension: 'service' | 'staff'
): AggregatedRow[] {
  const groups = new Map<string, { tips: number; revenue: number; count: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      if (dimension === 'service') {
        a.services.forEach(s => {
          const existing = groups.get(s.name) || { tips: 0, revenue: 0, count: 0 }
          existing.tips += a.tipCents / a.services.length
          existing.revenue += s.priceCents
          existing.count++
          groups.set(s.name, existing)
        })
      } else {
        const existing = groups.get(a.groomerName) || { tips: 0, revenue: 0, count: 0 }
        existing.tips += a.tipCents
        existing.revenue += a.netCents
        existing.count++
        groups.set(a.groomerName, existing)
      }
    })
  
  return Array.from(groups.entries()).map(([key, data]) => ({
    id: key,
    dimension,
    dimensionValue: key,
    metrics: {
      tips: Math.round(data.tips),
      revenue: data.revenue,
      tipPercent: data.revenue > 0 ? (data.tips / data.revenue * 100) : 0,
      avgTip: data.count > 0 ? Math.round(data.tips / data.count) : 0,
      appointments: data.count,
    },
    drillKey: `tips:${dimension}:${key}`,
  }))
}

// ==================== Finance/Transaction Functions ====================

export function generateCollectedByDayChart(
  transactions: NormalizedTransaction[]
): ChartDataPoint[] {
  const dayMap = new Map<string, number>()
  
  transactions
    .filter(t => t.status === 'settled' && t.type !== 'refund')
    .forEach(t => {
      const key = t.date.substring(0, 10)
      dayMap.set(key, (dayMap.get(key) || 0) + t.amountCents)
    })
  
  return Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      label: format(parseISO(date), 'MMM d'),
      value
    }))
}

export function getTransactionsList(
  transactions: NormalizedTransaction[]
): AggregatedRow[] {
  return transactions.map(t => ({
    id: t.id,
    dimension: 'transaction',
    dimensionValue: t.id,
    metrics: {
      date: new Date(t.date).getTime(),
      collected: t.amountCents,
      fee: t.processingFeeCents || 0,
      netToBank: t.netToBank,
      refund: t.refundCents || 0,
    },
    drillKey: `transaction:${t.id}`,
    // Extra data for display
    txnId: t.id,
    method: t.paymentMethod,
    status: t.status,
    batchId: t.batchId,
  } as AggregatedRow & { txnId: string; method: string; status: string; batchId?: string }))
}

export function getAgingReceivables(
  appointments: NormalizedAppointment[],
  transactions: NormalizedTransaction[]
): AggregatedRow[] {
  // Find completed appointments without matching settled transactions
  const settledApptIds = new Set(
    transactions.filter(t => t.status === 'settled').map(t => t.appointmentId)
  )
  
  const unpaidAppts = appointments.filter(a => 
    a.status === 'picked_up' && !settledApptIds.has(a.id)
  )
  
  // Group by aging bucket
  const now = new Date()
  const buckets = {
    '0-30 days': 0,
    '31-60 days': 0,
    '61-90 days': 0,
    '90+ days': 0,
  }
  
  unpaidAppts.forEach(a => {
    const apptDate = parseISO(a.serviceDate)
    const daysOld = differenceInDays(now, apptDate)
    
    if (daysOld <= 30) buckets['0-30 days'] += a.totalCents
    else if (daysOld <= 60) buckets['31-60 days'] += a.totalCents
    else if (daysOld <= 90) buckets['61-90 days'] += a.totalCents
    else buckets['90+ days'] += a.totalCents
  })
  
  return Object.entries(buckets).map(([bucket, amount]) => ({
    id: bucket,
    dimension: 'aging',
    dimensionValue: bucket,
    metrics: { amount },
    drillKey: `aging:${bucket}`,
  }))
}

export function getChargebacks(
  transactions: NormalizedTransaction[]
): AggregatedRow[] {
  return transactions
    .filter(t => t.status === 'refunded' && t.refundReason?.toLowerCase().includes('chargeback'))
    .map(t => ({
      id: t.id,
      dimension: 'chargeback',
      dimensionValue: t.id,
      metrics: {
        amount: Math.abs(t.refundCents || t.amountCents),
        date: new Date(t.date).getTime(),
      },
      drillKey: `chargeback:${t.id}`,
    }))
}

// ==================== Inventory Functions ====================

export function getInventoryList(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[],
  _filters: ReportFilters
): AggregatedRow[] {
  return inventoryItems.map(item => {
    const usedCount = appointments.filter(a => a.status === 'picked_up').length * (item.usagePerAppointment || 0.5)
    const costUsed = Math.round(usedCount * item.unitCostCents)
    const daysRemaining = item.currentStock && usedCount > 0 
      ? Math.round((item.currentStock || item.quantityOnHand) / (usedCount / 30) * 30) 
      : 999
    
    return {
      id: item.id,
      dimension: 'inventory',
      dimensionValue: item.name,
      metrics: {
        beginQty: item.quantityOnHand + Math.round(usedCount),
        received: 0,
        used: Math.round(usedCount),
        endQty: item.quantityOnHand,
        unitCost: item.unitCostCents,
        costUsed,
        reorderPoint: item.reorderPoint || item.reorderLevel,
        daysRemaining,
      },
      drillKey: `inventory:${item.id}`,
    }
  })
}

export function getProjectedUsage(
  inventoryItems: NormalizedInventoryItem[],
  appointments: NormalizedAppointment[],
  upcomingAppointments: NormalizedAppointment[]
): { item: string; projected: number; current: number; shortfall: number }[] {
  return inventoryItems.map(item => {
    const upcomingUsage = upcomingAppointments.length * (item.usagePerAppointment || 0.5)
    const current = item.currentStock || item.quantityOnHand
    const shortfall = Math.max(0, upcomingUsage - current)
    
    return {
      item: item.name,
      projected: Math.round(upcomingUsage),
      current,
      shortfall: Math.round(shortfall),
    }
  })
}

// ==================== Marketing Functions ====================

export function getCampaignMetrics(
  messages: NormalizedMessage[],
  _appointments: NormalizedAppointment[],
  _config: { lastTouchDays: number; confirmationHours: number }
): AggregatedRow[] {
  const campaignMap = new Map<string, {
    sent: number
    delivered: number
    opened: number
    clicked: number
    confirmed: number
    showedUp: number
    revenue: number
    cost: number
    optOuts: number
  }>()
  
  messages.forEach(m => {
    const campaignId = m.campaignId || 'general'
    const existing = campaignMap.get(campaignId) || {
      sent: 0, delivered: 0, opened: 0, clicked: 0, confirmed: 0,
      showedUp: 0, revenue: 0, cost: 0, optOuts: 0
    }
    
    existing.sent++
    if (m.deliveredAt) existing.delivered++
    if (m.openedAt) existing.opened++
    if (m.clickedAt) existing.clicked++
    if (m.confirmed) existing.confirmed++
    if (m.showedUp) {
      existing.showedUp++
      existing.revenue += m.revenueCents || 0
    }
    existing.cost += m.costCents || 1
    
    campaignMap.set(campaignId, existing)
  })
  
  return Array.from(campaignMap.entries()).map(([campaignId, data]) => ({
    id: campaignId,
    dimension: 'campaign',
    dimensionValue: campaignId,
    metrics: {
      sent: data.sent,
      delivered: data.delivered,
      deliveryRate: data.sent > 0 ? (data.delivered / data.sent * 100) : 0,
      opened: data.opened,
      openRate: data.delivered > 0 ? (data.opened / data.delivered * 100) : 0,
      clicked: data.clicked,
      clickRate: data.opened > 0 ? (data.clicked / data.opened * 100) : 0,
      confirmed: data.confirmed,
      confirmationRate: data.sent > 0 ? (data.confirmed / data.sent * 100) : 0,
      showedUp: data.showedUp,
      revenue: data.revenue,
      cost: data.cost,
      roi: data.cost > 0 ? ((data.revenue - data.cost) / data.cost * 100) : 0,
      optOutRate: 0,
    },
    drillKey: `campaign:${campaignId}`,
  }))
}

// ==================== Payroll Functions ====================

export function getStaffPayrollData(
  appointments: NormalizedAppointment[],
  staff: NormalizedStaff[],
  _filters: ReportFilters
): AggregatedRow[] {
  return staff.filter(s => s.isGroomer).map(s => {
    const staffAppts = appointments.filter(a => 
      a.groomerId === s.id && a.status === 'picked_up'
    )
    
    const revenue = staffAppts.reduce((sum, a) => sum + a.netCents, 0)
    const tips = staffAppts.reduce((sum, a) => sum + a.tipCents, 0)
    const hours = staffAppts.reduce((sum, a) => sum + (a.actualDurationMinutes || a.scheduledDurationMinutes) / 60, 0)
    
    const commissionRate = s.commissionPercent || 40
    const hourlyRate = s.hourlyRateCents || 1500
    
    const commission = Math.round(revenue * commissionRate / 100)
    const hourly = Math.round(hours * hourlyRate)
    
    return {
      id: s.id,
      dimension: 'staff',
      dimensionValue: s.name,
      metrics: {
        hours: Math.round(hours * 10) / 10,
        appointments: staffAppts.length,
        revenue,
        commission,
        hourly,
        tips,
        adjustments: 0,
        total: commission + hourly + tips,
      },
      drillKey: `staff-payroll:${s.id}`,
    }
  })
}

// ==================== Tax Functions ====================

export function getTaxBreakdown(
  appointments: NormalizedAppointment[],
  _transactions: NormalizedTransaction[]
): AggregatedRow[] {
  // Group by tax jurisdiction (simplified - by rate)
  const taxRates = new Map<string, { base: number; tax: number; invoices: number }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      // Estimate tax rate from data
      const rate = a.netCents > 0 ? Math.round((a.taxCents / a.netCents) * 1000) / 10 : 0
      const rateKey = `${rate}%`
      
      const existing = taxRates.get(rateKey) || { base: 0, tax: 0, invoices: 0 }
      existing.base += a.netCents
      existing.tax += a.taxCents
      existing.invoices++
      taxRates.set(rateKey, existing)
    })
  
  return Array.from(taxRates.entries()).map(([rate, data]) => ({
    id: rate,
    dimension: 'tax-rate',
    dimensionValue: rate,
    metrics: {
      taxableBase: data.base,
      rate: parseFloat(rate),
      taxCollected: data.tax,
      invoices: data.invoices,
    },
    drillKey: `tax:${rate}`,
  }))
}

// ==================== Cache Utilities ====================

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return undefined
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCache(): void {
  cache.clear()
}

// Performance logging (dev mode only)
export function measurePerformance<T>(name: string, fn: () => T): T {
  if (process.env.NODE_ENV !== 'development') {
    return fn()
  }
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  console.log(`[Reports Perf] ${name}: ${duration.toFixed(2)}ms`)
  return result
}


// ==================== Function Aliases ====================
export const aggregatePayrollByStaff = getStaffPayrollData

export const generateRevenueVsMarginByServiceChart = generateRevenueVsMarginByService
export const generateDiscountVsMarginScatterChart = generateDiscountVsMarginScatter
export const generateUsageByCategoryTrend = generateUsageByCategoryChart
export const generateCostPerApptTrendChart = generateCostPerApptTrend
export const generateROIByChannelSegment = generateROIByChannelChart
export const generateTipPercentByService = generateTipPercentByServiceChart
export const generateTipPercentByStaff = generateTipPercentByStaffChart
export const generateTipTrend = generateTipTrendChart

export const generateUsageTrendByCategory = generateUsageByCategoryChart
export const aggregateInventoryMetrics = getInventoryList

export const projectInventoryNeeds = getProjectedUsage

export function generateConfirmationLiftChart(_messages: NormalizedMessage[], _appointments: NormalizedAppointment[]): ChartDataPoint[] {
  return [{ label: 'With Confirmation', value: 85 }, { label: 'Without', value: 65 }]
}
export const aggregateCampaignMetrics = getCampaignMetrics

// Alias for tip breakdown with full signature
export function aggregateTipsBreakdown(
  appointments: NormalizedAppointment[],
  _transactions: NormalizedTransaction[],
  _staff: NormalizedStaff[],
  groupBy: 'service' | 'staff'
): AggregatedRow[] {
  return aggregateTipsByServiceStaff(appointments, groupBy)
}

// ==================== Tax Functions ====================

export function generateTaxByJurisdictionChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const jurisdictions = new Map<string, number>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const jurisdiction = a.taxJurisdiction || 'Default'
      const existing = jurisdictions.get(jurisdiction) || 0
      jurisdictions.set(jurisdiction, existing + a.taxCents)
    })
  
  return Array.from(jurisdictions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }))
}

export function generateTaxablePieChart(
  appointments: NormalizedAppointment[]
): ChartDataPoint[] {
  const completed = appointments.filter(a => a.status === 'picked_up')
  const taxable = completed.filter(a => a.isTaxable)
  const nonTaxable = completed.filter(a => !a.isTaxable)
  
  return [
    { label: 'Taxable', value: taxable.reduce((sum, a) => sum + a.netCents, 0) },
    { label: 'Non-Taxable', value: nonTaxable.reduce((sum, a) => sum + a.netCents, 0) },
  ]
}

export function aggregateTaxByJurisdiction(
  appointments: NormalizedAppointment[]
): AggregatedRow[] {
  const jurisdictions = new Map<string, { 
    base: number
    tax: number
    rate: number
    count: number
  }>()
  
  appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const jurisdiction = a.taxJurisdiction || 'Default'
      const rate = a.taxRatePercent || 0
      const key = `${jurisdiction}-${rate}`
      
      const existing = jurisdictions.get(key) || { base: 0, tax: 0, rate, count: 0 }
      existing.base += a.netCents
      existing.tax += a.taxCents
      existing.count++
      jurisdictions.set(key, existing)
    })
  
  return Array.from(jurisdictions.entries()).map(([key, data]) => {
    const [jurisdiction] = key.split('-')
    return {
      id: key,
      dimension: 'jurisdiction',
      dimensionValue: jurisdiction,
      metrics: {
        taxableBase: data.base,
        taxRate: data.rate,
        taxCollected: data.tax,
        invoices: data.count,
      },
      drillKey: `tax:jurisdiction:${key}`,
    }
  }).sort((a, b) => b.metrics.taxCollected - a.metrics.taxCollected)
}
