import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface InviteCompensationPayload {
  hourly_rate?: number | null
  commission_percentage?: number | null
  service_commission_overrides?: Record<string, number>
}

export interface InviteSchedulePayload {
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export interface StaffInvite {
  id: string
  store_id: string
  email: string
  role: 'manager' | 'groomer' | 'front_desk' | 'bather'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invited_by: string
  expires_at: string
  hire_date?: string | null
  compensation?: InviteCompensationPayload | null
  schedules?: InviteSchedulePayload[] | null
  accepted_at?: string | null
  created_at: string
  updated_at: string
}


export type StaffInviteRoleInput = StaffInvite['role'] | "staff"

export interface StaffCompensation {
  id: string
  store_id: string
  staff_id: string
  commission_percentage: number
  hourly_rate: number
  salary_annual_amount?: number | null
  weekly_guarantee_amount?: number | null
  weekly_guarantee_payout_mode?: 'both' | 'higher' | null
  team_overrides: Array<{
    staffId: string
    percentage: number
  }>
  service_commission_overrides?: Record<string, number>
  created_at: string
  updated_at: string
  updated_by?: string
}

export interface StaffSchedule {
  id: string
  store_id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
  updated_at: string
}

export type StaffAttendanceStatus = 'late' | 'sick_personal' | 'no_call_no_show'
export type StaffScheduleOverrideType = 'approved_day_off' | 'block_hours' | 'modify_hours'

export interface StaffScheduleOverride {
  id: string
  store_id: string
  staff_id: string
  override_date: string
  attendance_status?: StaffAttendanceStatus | null
  actual_arrival_time?: string | null
  schedule_override_type?: StaffScheduleOverrideType | null
  start_time?: string | null
  end_time?: string | null
  created_at: string
  updated_at: string
}

const STAFF_INVITES_QUERY_KEY = 'staff_invites'
const STAFF_COMPENSATION_QUERY_KEY = 'staff_compensation'
const STAFF_SCHEDULES_QUERY_KEY = 'staff_schedules'
const STAFF_SCHEDULE_OVERRIDES_QUERY_KEY = 'staff_schedule_overrides'

function extractScheduleErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as Record<string, unknown>
  if (typeof candidate.code === 'string') return candidate.code
  if (candidate.details && typeof candidate.details === 'object') {
    const details = candidate.details as Record<string, unknown>
    if (typeof details.code === 'string') return details.code
  }
  return undefined
}

function extractScheduleErrorText(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    const message = typeof candidate.message === 'string' ? candidate.message : ''
    const details = typeof candidate.details === 'string'
      ? candidate.details
      : candidate.details && typeof candidate.details === 'object'
        ? JSON.stringify(candidate.details)
        : ''
    const hint = typeof candidate.hint === 'string' ? candidate.hint : ''
    return [message, details, hint].filter(Boolean).join(' ')
  }
  return ''
}

export function getStaffScheduleMutationErrorMessage(
  error: unknown,
  action: 'save' | 'remove' = 'save',
): string {
  const code = extractScheduleErrorCode(error)
  const text = extractScheduleErrorText(error).toLowerCase()

  if (
    code === '23505' &&
    text.includes('staff_schedules_staff_id_day_of_week_key')
  ) {
    return 'Staff schedules still use the old one-block-per-day schema. Apply migration 036_staff_compensation_schedule_fixes.sql and try again.'
  }

  if (
    code === '42501' ||
    text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('forbidden')
  ) {
    return action === 'remove'
      ? 'You do not have permission to remove this staff schedule block.'
      : 'You do not have permission to edit staff schedules for the active store.'
  }

  return action === 'remove'
    ? 'Failed to remove staff schedule block.'
    : 'Failed to save staff schedule.'
}

// Staff Invites hooks
export function useStaffInvites() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_INVITES_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as StaffInvite[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useStaffInvite(inviteId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_INVITES_QUERY_KEY, storeId, inviteId],
    queryFn: async () => {
      if (!storeId || !inviteId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', inviteId)
        .single()

      if (error) throw error
      return data as StaffInvite
    },
    enabled: !!storeId && !!user && !!inviteId,
  })
}

export function useCreateStaffInvite() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteData: Omit<StaffInvite, 'id' | 'store_id' | 'invited_by' | 'created_at' | 'role'> & { role: StaffInviteRoleInput }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Missing access token')

      const normalizedRole = inviteData.role === "staff" ? 'front_desk' : inviteData.role

      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-store-id': storeId,
        },
        body: JSON.stringify({
          email: inviteData.email,
          role: normalizedRole,
          expiresAt: inviteData.expires_at,
          hireDate: inviteData.hire_date,
          compensation: inviteData.compensation,
          schedules: inviteData.schedules,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to send invitation')
      }

      return payload.invite as StaffInvite
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_INVITES_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateStaffInvite() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...inviteData }: Partial<StaffInvite> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('staff_invites')
        .update(inviteData)
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('staff invite')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('staff invite')
      return data as StaffInvite
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_INVITES_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_INVITES_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useDeleteStaffInvite() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteId: string) => {
      if (!storeId) throw new Error('No active store')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Missing access token')

      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-store-id': storeId,
        },
        body: JSON.stringify({ cancelInviteId: inviteId }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to cancel invitation')
      }

      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_INVITES_QUERY_KEY, storeId] })
    },
  })
}

export function useResendStaffInvite() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteId: string) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Missing access token')

      // Step 1: Extend the invite expiry directly via Supabase
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: updateError } = await supabase
        .from('staff_invites')
        .update({ expires_at: newExpiresAt })
        .eq('id', inviteId)
        .eq('store_id', storeId)
        .eq('status', 'pending')

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update invitation expiry')
      }

      // Step 2: Send the email via the invite endpoint (resend mode)
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-store-id': storeId,
        },
        body: JSON.stringify({ inviteId }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to resend invitation')
      }

      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_INVITES_QUERY_KEY, storeId] })
    },
  })
}

// Staff Compensation hooks
export function useStaffCompensation(staffId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_COMPENSATION_QUERY_KEY, storeId, staffId],
    queryFn: async () => {
      if (!storeId || !staffId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('staff_compensation')
        .select('*')
        .eq('store_id', storeId)
        .eq('staff_id', staffId)
        .maybeSingle()

      if (error) throw error
      return data as StaffCompensation | null
    },
    enabled: !!storeId && !!user && !!staffId,
  })
}

export function useAllStaffCompensations() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_COMPENSATION_QUERY_KEY, storeId, 'all'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('staff_compensation')
        .select('*')
        .eq('store_id', storeId)

      if (error) throw error
      return (data ?? []) as StaffCompensation[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateStaffCompensation() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (compensationData: Omit<StaffCompensation, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('staff_compensation')
        .insert({
          ...compensationData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as StaffCompensation
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_COMPENSATION_QUERY_KEY, storeId, data.staff_id] })
    },
  })
}

export function useUpdateStaffCompensation() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ staff_id, updated_at, ...compensationData }: Partial<StaffCompensation> & { staff_id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('staff_compensation')
        .update({
          ...compensationData,
        })
        .eq('staff_id', staff_id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('staff compensation')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('staff compensation')
      return data as StaffCompensation
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_COMPENSATION_QUERY_KEY, storeId, data.staff_id] })
    },
  })
}

// Staff Schedules hooks
export function useStaffSchedules(staffId?: string) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, staffId ?? 'all'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      let query = supabase
        .from('staff_schedules')
        .select('*')
        .eq('store_id', storeId)

      if (staffId) {
        query = query.eq('staff_id', staffId)
      }

      const { data, error } = await query.order('day_of_week', { ascending: true })

      if (error) throw error
      return data as StaffSchedule[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateStaffSchedule(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async (scheduleData: Omit<StaffSchedule, 'id' | 'store_id' | 'created_at' | 'updated_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase.rpc('create_staff_schedule_block', {
        p_store_id: storeId,
        p_staff_id: scheduleData.staff_id,
        p_day_of_week: scheduleData.day_of_week,
        p_start_time: scheduleData.start_time,
        p_end_time: scheduleData.end_time,
        p_is_available: scheduleData.is_available,
      })

      if (error) throw error
      return data as StaffSchedule
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, data.staff_id] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useUpdateStaffSchedule(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async ({ id, updated_at, ...scheduleData }: Partial<StaffSchedule> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('staff_schedules')
        .update(scheduleData)
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('staff schedule')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('staff schedule')
      return data as StaffSchedule
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, data.staff_id] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useDeleteStaffSchedule(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async ({ scheduleId, staffId }: { scheduleId: string; staffId: string }) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase.rpc('delete_staff_schedule_block', {
        p_store_id: storeId,
        p_schedule_id: scheduleId,
        p_staff_id: staffId,
      })

      if (error) throw error
      return { staffId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, result.staffId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULES_QUERY_KEY, storeId, 'all'] })
    },
  })
}

// Staff schedule override hooks
export function useStaffScheduleOverrides(staffId?: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId, staffId ?? 'all'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      let query = supabase
        .from('staff_schedule_overrides')
        .select('*')
        .eq('store_id', storeId)

      if (staffId) {
        query = query.eq('staff_id', staffId)
      }

      const { data, error } = await query.order('override_date', { ascending: false })

      if (error) throw error
      return data as StaffScheduleOverride[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useUpsertStaffScheduleOverride(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async ({ id, updated_at, ...overrideData }: Partial<StaffScheduleOverride> & {
      staff_id: string
      override_date: string
      updated_at?: string
    }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      if (id) {
        const { data, error, count } = await supabase
          .from('staff_schedule_overrides')
          .update(overrideData)
          .eq('id', id)
          .eq('store_id', storeId)
          .eq('updated_at', updated_at)
          .select()
          .single()

        if (error) {
          if (error.code === 'PGRST116') throw new ConcurrencyError('staff schedule override')
          throw error
        }
        if (!data && count === 0) throw new ConcurrencyError('staff schedule override')
        return data as StaffScheduleOverride
      }

      const { data, error } = await supabase
        .from('staff_schedule_overrides')
        .insert({
          ...overrideData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as StaffScheduleOverride
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId, data.staff_id] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useDeleteStaffScheduleOverride(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async ({ overrideId, staffId, updated_at }: { overrideId: string; staffId: string; updated_at: string }) => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('staff_schedule_overrides')
        .delete()
        .eq('id', overrideId)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new ConcurrencyError('staff schedule override')
      return { staffId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId, result.staffId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_SCHEDULE_OVERRIDES_QUERY_KEY, storeId, 'all'] })
    },
  })
}
