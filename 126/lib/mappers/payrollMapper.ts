import type { PayrollSettings as DbPayrollSettings } from '@/hooks/data/usePayroll'
import type { PayPeriodSettings, PayPeriodType } from '@/lib/payroll-utils'

const dbTypeToUi: Record<string, PayPeriodType> = {
  weekly: 'weekly',
  biweekly: 'bi-weekly',
  monthly: 'monthly',
}

const uiTypeToDb: Record<PayPeriodType, string> = {
  weekly: 'weekly',
  'bi-weekly': 'biweekly',
  'semi-monthly': 'monthly',
  monthly: 'monthly',
}

export function payrollSettingsFromDb(db: DbPayrollSettings): PayPeriodSettings {
  return {
    type: dbTypeToUi[db.pay_period_type] ?? 'bi-weekly',
    anchorStartDate: db.anchor_start_date ?? '',
    anchorEndDate: db.anchor_end_date ?? '',
    anchorPayDate: db.anchor_pay_date ?? '',
  }
}

export function payrollSettingsToDb(
  ui: PayPeriodSettings
): Partial<Omit<DbPayrollSettings, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'updated_by'>> {
  return {
    pay_period_type: (uiTypeToDb[ui.type] ?? 'biweekly') as DbPayrollSettings['pay_period_type'],
    anchor_start_date: ui.anchorStartDate || null,
    anchor_end_date: ui.anchorEndDate || null,
    anchor_pay_date: ui.anchorPayDate || null,
  }
}
