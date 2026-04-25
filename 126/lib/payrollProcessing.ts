import { isAppointmentInBusinessDateRange } from '@/lib/date-utils'
import type { Appointment } from '@/lib/types'
import type { AppointmentCheckoutData } from '@/hooks/useAppointmentCheckout'
import type { StaffCompensation } from '@/hooks/data/useStaffExtensions'
import type {
  PayrollPeriod,
  PayrollPeriodSnapshot,
  PayrollPeriodSnapshotLineItem,
  PayrollSettings,
} from '@/hooks/data/usePayroll'
import type { PayPeriod, PayPeriodSettings } from '@/lib/payroll-utils'
import { getPayrollServiceLabel, getPayrollStaffName, getPayrollTipMethod } from '@/lib/payrollDisplay'

function toUiPayPeriodType(type: PayrollSettings['pay_period_type']): PayPeriodSettings['type'] {
  if (type === 'biweekly') return 'bi-weekly'
  return type
}

export interface PayrollStaffMember {
  id: string
  first_name?: string | null
  last_name?: string | null
  role?: string | null
  status?: string | null
}

export interface PayrollStaffSummary {
  staffId: string
  staffName: string
  role: string
  commissionRatePercent: number
  totalHours: number
  totalRevenue: number
  commissionPay: number
  hourlyPay: number
  salaryPay: number
  teamOverridePay: number
  guaranteePay: number
  grossPay: number
  tips: number
  totalPay: number
  appointmentsCompleted: number
  lineItems: PayrollPeriodSnapshotLineItem[]
  status: PayrollPeriod['status']
  existingPeriod?: PayrollPeriod
  compensation: PayrollPeriodSnapshot['compensation']
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeCommissionDecimal(rate?: number | null): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return 0
  }

  return rate > 1 ? rate / 100 : rate
}

function normalizeRole(role?: string | null): string {
  return role || 'Staff'
}

function getWeeksPerPayPeriod(settings: PayPeriodSettings): number {
  switch (settings.type) {
    case 'weekly':
      return 1
    case 'bi-weekly':
      return 2
    case 'semi-monthly':
      // Weekly guarantees are stored per week, so semi-monthly payroll needs
      // the average number of weeks represented by one semi-monthly period.
      return 52 / 24
    case 'monthly':
      // Weekly guarantees are stored per week, so monthly payroll needs the
      // average number of weeks represented by one monthly period.
      return 52 / 12
  }
}

function getSalaryPeriodsPerYear(type: PayPeriodSettings['type']): number {
  switch (type) {
    case 'weekly':
      return 52
    case 'bi-weekly':
      return 26
    case 'semi-monthly':
      return 24
    case 'monthly':
      return 12
  }
}

function getDurationHours(appointment: Appointment): number {
  const [startHour = '0', startMinute = '0'] = appointment.startTime.split(':')
  const [endHour = '0', endMinute = '0'] = appointment.endTime.split(':')
  const startMinutes = Number(startHour) * 60 + Number(startMinute)
  const endMinutes = Number(endHour) * 60 + Number(endMinute)
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
    return 0
  }

  return (endMinutes - startMinutes) / 60
}

function getSnapshotSummary(period: PayrollPeriod): PayrollStaffSummary | null {
  const snapshot = period.snapshot
  if (!snapshot) return null

  const compensation = snapshot.compensation ?? {
    commissionRatePercent: 0,
    hourlyRate: 0,
    salaryAnnualAmount: 0,
    weeklyGuaranteeAmount: 0,
    weeklyGuaranteePayoutMode: null,
    teamOverrides: [],
  }
  const totals = snapshot.totals

  if (!totals) return null

  return {
    staffId: period.staff_id,
    staffName: '',
    role: 'Staff',
    commissionRatePercent: compensation.commissionRatePercent,
    totalHours: totals.totalHours,
    totalRevenue: totals.totalRevenue,
    commissionPay: totals.commissionPay,
    hourlyPay: totals.hourlyPay,
    salaryPay: totals.salaryPay,
    teamOverridePay: totals.teamOverridePay,
    guaranteePay: totals.guaranteePay,
    grossPay: totals.grossPay,
    tips: totals.tips,
    totalPay: totals.totalPay,
    appointmentsCompleted: totals.appointmentsCompleted,
    lineItems: snapshot.lineItems ?? [],
    status: period.status,
    existingPeriod: period,
    compensation,
  }
}

export function createPayrollSnapshot(
  summary: PayrollStaffSummary,
  periodSettings: PayPeriodSettings,
  payDate: string,
): PayrollPeriodSnapshot {
  return {
    payPeriodType: periodSettings.type,
    payDate,
    compensation: summary.compensation,
    totals: {
      appointmentsCompleted: summary.appointmentsCompleted,
      totalHours: roundCurrency(summary.totalHours),
      totalRevenue: roundCurrency(summary.totalRevenue),
      commissionPay: roundCurrency(summary.commissionPay),
      hourlyPay: roundCurrency(summary.hourlyPay),
      salaryPay: roundCurrency(summary.salaryPay),
      teamOverridePay: roundCurrency(summary.teamOverridePay),
      guaranteePay: roundCurrency(summary.guaranteePay),
      grossPay: roundCurrency(summary.grossPay),
      tips: roundCurrency(summary.tips),
      totalPay: roundCurrency(summary.totalPay),
    },
    lineItems: summary.lineItems,
  }
}

export function createPayrollPeriodPayload(
  summary: PayrollStaffSummary,
  payPeriod: PayPeriod,
  periodSettings: PayPeriodSettings,
  status: PayrollPeriod['status'],
  finalizedByUserId?: string | null,
): Omit<PayrollPeriod, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    staff_id: summary.staffId,
    period_start: payPeriod.startDate,
    period_end: payPeriod.endDate,
    pay_date: payPeriod.payDate,
    total_hours: roundCurrency(summary.totalHours),
    total_revenue: roundCurrency(summary.totalRevenue),
    commission: roundCurrency(summary.commissionPay + summary.teamOverridePay + summary.guaranteePay),
    tips: roundCurrency(summary.tips),
    total_pay: roundCurrency(summary.totalPay),
    status,
    finalized_at: status === 'draft' ? null : summary.existingPeriod?.finalized_at ?? new Date().toISOString(),
    finalized_by: status === 'draft' ? null : summary.existingPeriod?.finalized_by ?? finalizedByUserId ?? null,
    paid_at: status === 'paid' ? summary.existingPeriod?.paid_at ?? new Date().toISOString() : null,
    notes: summary.existingPeriod?.notes,
    snapshot: createPayrollSnapshot(summary, periodSettings, payPeriod.payDate),
  }
}

export function calculatePayrollSummaries({
  appointments,
  checkoutByAppointmentId,
  staffMembers,
  staffCompensationMap,
  payrollSettings,
  payPeriod,
  existingPayrollPeriods,
}: {
  appointments: Appointment[]
  checkoutByAppointmentId: Map<string, AppointmentCheckoutData>
  staffMembers: PayrollStaffMember[]
  staffCompensationMap: Map<string, StaffCompensation>
  payrollSettings: PayrollSettings
  payPeriod: PayPeriod
  existingPayrollPeriods?: PayrollPeriod[]
}): PayrollStaffSummary[] {
  const existingByStaff = new Map(
    (existingPayrollPeriods ?? []).map((period) => [period.staff_id, period])
  )

  const liveLineItemsByStaff = new Map<string, PayrollPeriodSnapshotLineItem[]>()
  const liveRevenueByStaff = new Map<string, number>()
  const liveHoursByStaff = new Map<string, number>()
  const liveTipsByStaff = new Map<string, number>()

  appointments
    .filter((appointment) =>
      appointment.status === 'picked_up' &&
      isAppointmentInBusinessDateRange(appointment.date, payPeriod.startDate, payPeriod.endDate)
    )
    .forEach((appointment) => {
      const staffId = appointment.groomerId
      if (!staffId) return

      const checkout = checkoutByAppointmentId.get(appointment.id)
      const revenue = roundCurrency(checkout?.totalBeforeTip ?? appointment.totalPrice)
      const totalTipAmount = roundCurrency(checkout?.tipAmount ?? appointment.tipAmount ?? 0)
      const tipMethod = getPayrollTipMethod(checkout?.tipPaymentMethod, checkout?.paymentMethod)
      const payrollTipAmount = tipMethod === 'Card' ? totalTipAmount : 0
      const durationHours = getDurationHours(appointment)
      const lineItem: PayrollPeriodSnapshotLineItem = {
        appointmentId: appointment.id,
        date: appointment.date,
        clientName: appointment.clientName,
        petName: appointment.petName,
        serviceLabel: getPayrollServiceLabel(appointment),
        revenue,
        totalTipAmount,
        payrollTipAmount,
        durationHours: roundCurrency(durationHours),
      }

      liveLineItemsByStaff.set(staffId, [...(liveLineItemsByStaff.get(staffId) ?? []), lineItem])
      liveRevenueByStaff.set(staffId, roundCurrency((liveRevenueByStaff.get(staffId) ?? 0) + revenue))
      liveHoursByStaff.set(staffId, roundCurrency((liveHoursByStaff.get(staffId) ?? 0) + durationHours))
      liveTipsByStaff.set(staffId, roundCurrency((liveTipsByStaff.get(staffId) ?? 0) + payrollTipAmount))
    })

  return staffMembers
    .filter((staff) => staff.status?.toLowerCase() !== 'inactive')
    .map((staff) => {
      const existingPeriod = existingByStaff.get(staff.id)
      if (existingPeriod?.status && existingPeriod.status !== 'draft') {
        const snapshotSummary = getSnapshotSummary(existingPeriod)
        if (snapshotSummary) {
          return {
            ...snapshotSummary,
            staffName: getPayrollStaffName(staff),
            role: normalizeRole(staff.role),
          }
        }
      }

      const compensation = staffCompensationMap.get(staff.id)
      const commissionRateDecimal = normalizeCommissionDecimal(
        compensation?.commission_percentage ?? payrollSettings.default_commission_rate
      )
      const commissionRatePercent = roundCurrency(commissionRateDecimal * 100)
      const totalRevenue = roundCurrency(liveRevenueByStaff.get(staff.id) ?? 0)
      const totalHours = roundCurrency(liveHoursByStaff.get(staff.id) ?? 0)
      const tips = roundCurrency(liveTipsByStaff.get(staff.id) ?? 0)
      const commissionPay = roundCurrency(totalRevenue * commissionRateDecimal)
      const hourlyPay = roundCurrency((compensation?.hourly_rate ?? 0) * totalHours)
      const salaryPay = roundCurrency(
        compensation?.salary_annual_amount
          ? compensation.salary_annual_amount / getSalaryPeriodsPerYear(toUiPayPeriodType(payrollSettings.pay_period_type))
          : 0
      )
      const teamOverridePay = roundCurrency(
        (compensation?.team_overrides ?? []).reduce((sum, override) => {
          return sum + ((liveRevenueByStaff.get(override.staffId) ?? 0) * ((override.percentage ?? 0) / 100))
        }, 0)
      )
      const guaranteeBase = roundCurrency(
        // Convert a weekly guarantee into the active pay period.
        (compensation?.weekly_guarantee_amount ?? 0) * getWeeksPerPayPeriod({
          type: toUiPayPeriodType(payrollSettings.pay_period_type),
          anchorStartDate: payrollSettings.anchor_start_date ?? payPeriod.startDate,
          anchorEndDate: payrollSettings.anchor_end_date ?? payPeriod.endDate,
          anchorPayDate: payrollSettings.anchor_pay_date ?? payPeriod.payDate,
        })
      )
      const guaranteePay = compensation?.weekly_guarantee_amount
        ? roundCurrency(
            compensation.weekly_guarantee_payout_mode === 'both'
              ? guaranteeBase
              : Math.max(0, guaranteeBase - commissionPay)
          )
        : 0
      const grossPay = roundCurrency(commissionPay + hourlyPay + salaryPay + teamOverridePay + guaranteePay)
      const totalPay = roundCurrency(grossPay + tips)

      return {
        staffId: staff.id,
        staffName: getPayrollStaffName(staff),
        role: normalizeRole(staff.role),
        commissionRatePercent,
        totalHours,
        totalRevenue,
        commissionPay,
        hourlyPay,
        salaryPay,
        teamOverridePay,
        guaranteePay,
        grossPay,
        tips,
        totalPay,
        appointmentsCompleted: (liveLineItemsByStaff.get(staff.id) ?? []).length,
        lineItems: liveLineItemsByStaff.get(staff.id) ?? [],
        status: existingPeriod?.status ?? 'draft',
        existingPeriod,
        compensation: {
          commissionRatePercent,
          hourlyRate: roundCurrency(compensation?.hourly_rate ?? 0),
          salaryAnnualAmount: roundCurrency(compensation?.salary_annual_amount ?? 0),
          weeklyGuaranteeAmount: roundCurrency(compensation?.weekly_guarantee_amount ?? 0),
          weeklyGuaranteePayoutMode: compensation?.weekly_guarantee_payout_mode ?? null,
          teamOverrides: compensation?.team_overrides ?? [],
        },
      }
    })
    .filter((summary) => summary.totalPay > 0 || summary.existingPeriod)
}
