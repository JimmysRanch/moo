import { format, addDays, addWeeks, startOfDay, differenceInDays, parseISO } from 'date-fns'
import { getTodayInBusinessTimezone } from './date-utils'

export type PayPeriodType = 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly'

export type CompensationType =
  | 'hourly'
  | 'salary'
  | 'commission'
  | 'hourly-plus-commission'
  | 'salary-plus-commission'
  | 'override'
  | 'guaranteed-vs-commission'

export interface PayPeriodSettings {
  type: PayPeriodType
  anchorStartDate: string
  anchorEndDate: string
  anchorPayDate: string
}

export interface PayPeriod {
  startDate: string
  endDate: string
  payDate: string
}

export interface StaffCompensation {
  type: CompensationType
  hourlyRate?: number
  salaryAmount?: number
  commissionRate?: number
  overrideStaffId?: string
  overridePercentage?: number
  guaranteedAmount?: number
  useHigherAmount?: boolean
}

export const DEFAULT_BIWEEKLY_SETTINGS: PayPeriodSettings = {
  type: 'bi-weekly',
  anchorStartDate: '2024-12-30',
  anchorEndDate: '2025-01-12',
  anchorPayDate: '2025-01-17',
}

export const DEFAULT_WEEKLY_SETTINGS: PayPeriodSettings = {
  type: 'weekly',
  anchorStartDate: '2024-12-30',
  anchorEndDate: '2025-01-05',
  anchorPayDate: '2025-01-10',
}

export function isPayPeriodSettingsComplete(settings?: Partial<PayPeriodSettings> | null): settings is PayPeriodSettings {
  return Boolean(
    settings &&
    settings.type &&
    settings.anchorStartDate &&
    settings.anchorEndDate &&
    settings.anchorPayDate
  )
}

function requireSettings(settings?: Partial<PayPeriodSettings> | null): PayPeriodSettings {
  if (!isPayPeriodSettingsComplete(settings)) {
    throw new Error('Payroll settings are incomplete. Configure payroll settings before running payroll.')
  }

  return settings
}

function requireDate(value: string | undefined, fallback: string): string {
  return value || fallback
}

export function calculateNextPayPeriod(settings: Partial<PayPeriodSettings> | null | undefined, fromDate?: string): PayPeriod {
  const resolvedSettings = requireSettings(settings)
  const effectiveDate = requireDate(fromDate, getTodayInBusinessTimezone())

  const from = startOfDay(parseISO(effectiveDate))
  const anchorStart = startOfDay(parseISO(resolvedSettings.anchorStartDate))

  switch (resolvedSettings.type) {
    case 'weekly': {
      const daysSinceAnchor = differenceInDays(from, anchorStart)
      const weeksPassed = Math.floor(daysSinceAnchor / 7)
      const nextPeriodStart = addWeeks(anchorStart, weeksPassed + 1)
      const nextPeriodEnd = addDays(nextPeriodStart, 6)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const nextPayDate = addDays(nextPeriodEnd, anchorPayDiff)

      return {
        startDate: format(nextPeriodStart, 'yyyy-MM-dd'),
        endDate: format(nextPeriodEnd, 'yyyy-MM-dd'),
        payDate: format(nextPayDate, 'yyyy-MM-dd'),
      }
    }

    case 'bi-weekly': {
      const daysSinceAnchor = differenceInDays(from, anchorStart)
      const biweeksPassed = Math.floor(daysSinceAnchor / 14)
      const nextPeriodStart = addWeeks(anchorStart, (biweeksPassed + 1) * 2)
      const nextPeriodEnd = addDays(nextPeriodStart, 13)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const nextPayDate = addDays(nextPeriodEnd, anchorPayDiff)

      return {
        startDate: format(nextPeriodStart, 'yyyy-MM-dd'),
        endDate: format(nextPeriodEnd, 'yyyy-MM-dd'),
        payDate: format(nextPayDate, 'yyyy-MM-dd'),
      }
    }

    case 'semi-monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const day = currentDate.getDate()

      let startDate: Date
      let endDate: Date

      if (day < 15) {
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month, 15)
      } else {
        startDate = new Date(year, month, 16)
        const nextMonth = month === 11 ? 0 : month + 1
        const nextYear = month === 11 ? year + 1 : year
        endDate = new Date(nextYear, nextMonth, 0)
      }

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year

      const startDate = new Date(nextYear, nextMonth, 1)
      const endDate = new Date(nextYear, nextMonth + 1, 0)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }
  }
}

export function getCurrentPayPeriod(settings: Partial<PayPeriodSettings> | null | undefined, forDate?: string): PayPeriod {
  const resolvedSettings = requireSettings(settings)
  const effectiveDate = requireDate(forDate, getTodayInBusinessTimezone())

  const current = startOfDay(parseISO(effectiveDate))
  const anchorStart = startOfDay(parseISO(resolvedSettings.anchorStartDate))

  switch (resolvedSettings.type) {
    case 'weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const weeksPassed = Math.floor(daysSinceAnchor / 7)
      const periodStart = addWeeks(anchorStart, weeksPassed)
      const periodEnd = addDays(periodStart, 6)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'bi-weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const biweeksPassed = Math.floor(daysSinceAnchor / 14)
      const periodStart = addWeeks(anchorStart, biweeksPassed * 2)
      const periodEnd = addDays(periodStart, 13)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'semi-monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const day = currentDate.getDate()

      let startDate: Date
      let endDate: Date

      if (day <= 15) {
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month, 15)
      } else {
        startDate = new Date(year, month, 16)
        const nextMonth = month === 11 ? 0 : month + 1
        const nextYear = month === 11 ? year + 1 : year
        endDate = new Date(nextYear, nextMonth, 0)
      }

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }
  }
}

export function formatPayPeriodType(type: PayPeriodType): string {
  switch (type) {
    case 'weekly':
      return 'Weekly'
    case 'bi-weekly':
      return 'Bi-Weekly'
    case 'semi-monthly':
      return 'Semi-Monthly'
    case 'monthly':
      return 'Monthly'
  }
}

export function getPreviousPayPeriod(settings: Partial<PayPeriodSettings> | null | undefined, forDate?: string): PayPeriod {
  const resolvedSettings = requireSettings(settings)
  const effectiveDate = requireDate(forDate, getTodayInBusinessTimezone())
  const current = startOfDay(parseISO(effectiveDate))
  const anchorStart = startOfDay(parseISO(resolvedSettings.anchorStartDate))

  switch (resolvedSettings.type) {
    case 'weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const weeksPassed = Math.floor(daysSinceAnchor / 7)
      const periodStart = addWeeks(anchorStart, weeksPassed - 1)
      const periodEnd = addDays(periodStart, 6)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'bi-weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const biweeksPassed = Math.floor(daysSinceAnchor / 14)
      const periodStart = addWeeks(anchorStart, (biweeksPassed - 1) * 2)
      const periodEnd = addDays(periodStart, 13)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'semi-monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const day = currentDate.getDate()

      let startDate: Date
      let endDate: Date

      if (day <= 15) {
        const prevMonth = month === 0 ? 11 : month - 1
        const prevYear = month === 0 ? year - 1 : year
        startDate = new Date(prevYear, prevMonth, 16)
        endDate = new Date(year, month, 0)
      } else {
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month, 15)
      }

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year

      const startDate = new Date(prevYear, prevMonth, 1)
      const endDate = new Date(prevYear, prevMonth + 1, 0)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }
  }
}

export function getUpcomingPayPeriod(periodsAhead: number, settings: Partial<PayPeriodSettings> | null | undefined, forDate?: string): PayPeriod {
  const resolvedSettings = requireSettings(settings)
  const effectiveDate = requireDate(forDate, getTodayInBusinessTimezone())
  const current = startOfDay(parseISO(effectiveDate))
  const anchorStart = startOfDay(parseISO(resolvedSettings.anchorStartDate))

  switch (resolvedSettings.type) {
    case 'weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const weeksPassed = Math.floor(daysSinceAnchor / 7)
      const periodStart = addWeeks(anchorStart, weeksPassed + periodsAhead)
      const periodEnd = addDays(periodStart, 6)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'bi-weekly': {
      const daysSinceAnchor = differenceInDays(current, anchorStart)
      const biweeksPassed = Math.floor(daysSinceAnchor / 14)
      const periodStart = addWeeks(anchorStart, (biweeksPassed + periodsAhead) * 2)
      const periodEnd = addDays(periodStart, 13)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(periodEnd, anchorPayDiff)

      return {
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'semi-monthly': {
      const currentDate = parseISO(effectiveDate)
      let year = currentDate.getFullYear()
      let month = currentDate.getMonth()
      let isFirstHalf = currentDate.getDate() <= 15

      for (let i = 0; i < periodsAhead; i += 1) {
        if (isFirstHalf) {
          isFirstHalf = false
        } else {
          isFirstHalf = true
          month += 1
          if (month > 11) {
            month = 0
            year += 1
          }
        }
      }

      let startDate: Date
      let endDate: Date

      if (isFirstHalf) {
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month, 15)
      } else {
        startDate = new Date(year, month, 16)
        const nextMonth = month === 11 ? 0 : month + 1
        const nextYear = month === 11 ? year + 1 : year
        endDate = new Date(nextYear, nextMonth, 0)
      }

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }

    case 'monthly': {
      const currentDate = parseISO(effectiveDate)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      const targetMonth = month + periodsAhead
      const targetYear = year + Math.floor(targetMonth / 12)
      const actualMonth = targetMonth % 12

      const startDate = new Date(targetYear, actualMonth, 1)
      const endDate = new Date(targetYear, actualMonth + 1, 0)

      const anchorPayDiff = differenceInDays(parseISO(resolvedSettings.anchorPayDate), parseISO(resolvedSettings.anchorEndDate))
      const payDate = addDays(endDate, anchorPayDiff)

      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        payDate: format(payDate, 'yyyy-MM-dd'),
      }
    }
  }
}

export function formatPayPeriodRange(period: PayPeriod): string {
  const start = parseISO(period.startDate)
  const end = parseISO(period.endDate)

  const startMonth = format(start, 'MMM')
  const endMonth = format(end, 'MMM')
  const startDay = format(start, 'd')
  const endDay = format(end, 'd')

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
}

export function getPayPeriodScheduleDescription(type: PayPeriodType): string {
  switch (type) {
    case 'weekly':
      return 'Weekly pay schedule (every week)'
    case 'bi-weekly':
      return 'Bi-weekly pay schedule (every 2 weeks)'
    case 'semi-monthly':
      return 'Semi-monthly pay schedule (1st-15th and 16th-End of month)'
    case 'monthly':
      return 'Monthly pay schedule (1st-End of month)'
  }
}

export function calculateOvertimePay(
  hourlyRate: number,
  regularHours: number,
  totalHours: number,
  overtimeThreshold: number = 40,
): { regularPay: number; overtimePay: number; totalPay: number } {
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold)
  const regularHoursWorked = Math.min(Math.max(regularHours, 0), totalHours, overtimeThreshold)

  const regularPay = regularHoursWorked * hourlyRate
  const overtimePay = overtimeHours * hourlyRate * 1.5

  return {
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  }
}

export function calculateStaffPay(
  compensation: StaffCompensation,
  hours: number,
  commissionableAmount: number,
  overrideCommissionAmount?: number,
): number {
  switch (compensation.type) {
    case 'hourly': {
      const overtime = calculateOvertimePay(compensation.hourlyRate || 0, hours, hours)
      return overtime.totalPay
    }

    case 'salary':
      return compensation.salaryAmount || 0

    case 'commission':
      return commissionableAmount * ((compensation.commissionRate || 0) / 100)

    case 'hourly-plus-commission': {
      const overtime = calculateOvertimePay(compensation.hourlyRate || 0, hours, hours)
      const commissionPay = commissionableAmount * ((compensation.commissionRate || 0) / 100)
      return overtime.totalPay + commissionPay
    }

    case 'salary-plus-commission': {
      const salary = compensation.salaryAmount || 0
      const commission = commissionableAmount * ((compensation.commissionRate || 0) / 100)
      return salary + commission
    }

    case 'override':
      return (overrideCommissionAmount || 0) * ((compensation.overridePercentage || 0) / 100)

    case 'guaranteed-vs-commission': {
      const guaranteed = compensation.guaranteedAmount || 0
      const commissionEarned = commissionableAmount * ((compensation.commissionRate || 0) / 100)

      if (compensation.useHigherAmount) {
        return Math.max(guaranteed, commissionEarned)
      }
      return guaranteed + commissionEarned
    }
  }

  return 0
}
