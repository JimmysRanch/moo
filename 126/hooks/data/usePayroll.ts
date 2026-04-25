import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface PayrollSettings {
  id: string
  store_id: string
  pay_period_type: 'weekly' | 'biweekly' | 'monthly'
  pay_period_start_day?: number
  default_commission_rate: number
  anchor_start_date?: string | null
  anchor_end_date?: string | null
  anchor_pay_date?: string | null
  created_at: string
  updated_at: string
  updated_by?: string
}

export interface PayrollPeriodSnapshotLineItem {
  appointmentId: string
  date: string
  clientName: string
  petName: string
  serviceLabel: string
  revenue: number
  totalTipAmount: number
  payrollTipAmount: number
  durationHours: number
}

export interface PayrollPeriodSnapshot {
  payPeriodType: string
  payDate: string
  compensation: {
    commissionRatePercent: number
    hourlyRate: number
    salaryAnnualAmount: number
    weeklyGuaranteeAmount: number
    weeklyGuaranteePayoutMode: 'both' | 'higher' | null
    teamOverrides: Array<{
      staffId: string
      percentage: number
    }>
  }
  totals: {
    appointmentsCompleted: number
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
  }
  lineItems: PayrollPeriodSnapshotLineItem[]
}

export interface PayrollPeriod {
  id: string
  store_id: string
  staff_id: string
  period_start: string
  period_end: string
  pay_date?: string | null
  total_hours: number
  total_revenue: number
  commission: number
  tips: number
  total_pay: number
  status: 'draft' | 'finalized' | 'paid'
  finalized_at?: string | null
  finalized_by?: string | null
  paid_at?: string
  notes?: string
  snapshot?: PayrollPeriodSnapshot | null
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

type UpsertablePayrollSettings = Omit<PayrollSettings, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'updated_by'>

const PAYROLL_SETTINGS_QUERY_KEY = 'payroll_settings'
const PAYROLL_PERIODS_QUERY_KEY = 'payroll_periods'

function isMissingPayrollAnchorColumnsError(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true
  }

  const message = [error.message, error.details].filter(Boolean).join(' ').toLowerCase()
  return (
    message.includes('anchor_start_date') ||
    message.includes('anchor_end_date') ||
    message.includes('anchor_pay_date')
  )
}

function stripPayrollAnchorColumns(
  payrollSettings: UpsertablePayrollSettings
) {
  return {
    pay_period_type: payrollSettings.pay_period_type,
    pay_period_start_day: payrollSettings.pay_period_start_day,
    default_commission_rate: payrollSettings.default_commission_rate,
  }
}

// Payroll Settings hooks
export function usePayrollSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYROLL_SETTINGS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as PayrollSettings | null
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreatePayrollSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settingsData: Omit<PayrollSettings, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('payroll_settings')
        .insert({
          ...settingsData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as PayrollSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_SETTINGS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpsertPayrollSettings(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payrollSettings: UpsertablePayrollSettings) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const executePayrollSettingsUpsert = (
        payload: UpsertablePayrollSettings
      ) => supabase
        .from('payroll_settings')
        .upsert(
          { ...payload, store_id: storeId },
          { onConflict: 'store_id' }
        )
        .select()
        .single()

      let { data, error } = await executePayrollSettingsUpsert(payrollSettings)

      if (isMissingPayrollAnchorColumnsError(error)) {
        ({ data, error } = await executePayrollSettingsUpsert(stripPayrollAnchorColumns(payrollSettings)))
      }

      if (error) throw error
      return data as PayrollSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_SETTINGS_QUERY_KEY, storeId] })
    },
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
  })
}

export function useUpdatePayrollSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ updated_at, ...settingsData }: Partial<PayrollSettings> & { updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('payroll_settings')
        .update({
          ...settingsData,
        })
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('payroll settings')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('payroll settings')
      return data as PayrollSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_SETTINGS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpsertPayrollPeriod() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (periodData: Omit<PayrollPeriod, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('payroll_periods')
        .upsert(
          {
            ...periodData,
            store_id: storeId,
          },
          { onConflict: 'store_id,staff_id,period_start,period_end' }
        )
        .select()
        .single()

      if (error) throw error
      return data as PayrollPeriod
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, data.staff_id] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, 'single', data.id] })
    },
  })
}

// Payroll Periods hooks
export function usePayrollPeriods(staffId?: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, staffId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      let query = supabase
        .from('payroll_periods')
        .select('*')
        .eq('store_id', storeId)

      if (staffId) {
        query = query.eq('staff_id', staffId)
      }

      const { data, error } = await query.order('period_start', { ascending: false })

      if (error) throw error
      return data as PayrollPeriod[]
    },
    enabled: !!storeId && !!user,
  })
}

export function usePayrollPeriod(periodId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, 'single', periodId],
    queryFn: async () => {
      if (!storeId || !periodId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', periodId)
        .single()

      if (error) throw error
      return data as PayrollPeriod
    },
    enabled: !!storeId && !!user && !!periodId,
  })
}

export function usePayrollPeriodsByStatus(status: 'draft' | 'finalized' | 'paid' | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, 'status', status],
    queryFn: async () => {
      if (!storeId || !status) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', status)
        .order('period_start', { ascending: false })

      if (error) throw error
      return data as PayrollPeriod[]
    },
    enabled: !!storeId && !!user && !!status,
  })
}

export function useCreatePayrollPeriod() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (periodData: Omit<PayrollPeriod, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('payroll_periods')
        .insert({
          ...periodData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as PayrollPeriod
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, data.staff_id] })
    },
  })
}

export function useUpdatePayrollPeriod() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...periodData }: Partial<PayrollPeriod> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('payroll_periods')
        .update({
          ...periodData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('payroll period')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('payroll period')
      return data as PayrollPeriod
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, data.staff_id] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, 'single', data.id] })
    },
  })
}

export function useDeletePayrollPeriod() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ periodId, staffId }: { periodId: string; staffId: string }) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('payroll_periods')
        .delete()
        .eq('id', periodId)
        .eq('store_id', storeId)

      if (error) throw error
      return { staffId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_PERIODS_QUERY_KEY, storeId, result.staffId] })
    },
  })
}
