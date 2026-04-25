import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Appointment {
  id: string
  store_id: string
  client_id: string
  pet_id?: string
  groomer_id?: string
  date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'ready' | 'picked_up' | 'cancelled' | 'no_show'
  total_price: number
  tip_amount?: number
  tip_payment_method?: string
  notes?: string
  grooming_preferences?: Record<string, unknown>
  // Workflow timestamps
  is_late: boolean
  checked_in_at?: string | null
  in_progress_at?: string | null
  ready_at?: string | null
  picked_up_at?: string | null
  // Notification metadata
  client_notified_at?: string | null
  notification_type?: 'manual_heads_up' | 'ready_pickup' | null
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface AppointmentService {
  id: string
  appointment_id: string
  service_id?: string
  service_name: string
  service_type: 'main' | 'addon'
  price: number
  created_at: string
}

const APPOINTMENTS_QUERY_KEY = 'appointments'
const APPOINTMENT_SERVICES_QUERY_KEY = 'appointment_services'

export function useAppointments() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [APPOINTMENTS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useAppointment(appointmentId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [APPOINTMENTS_QUERY_KEY, storeId, appointmentId],
    queryFn: async () => {
      if (!storeId || !appointmentId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', appointmentId)
        .single()

      if (error) throw error
      return data as Appointment
    },
    enabled: !!storeId && !!user && !!appointmentId,
  })
}

export function useCreateAppointment() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentData: Omit<Appointment, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          ...appointmentData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateAppointment() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...appointmentData }: Partial<Appointment> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const doUpdate = (payload: Record<string, unknown>) =>
        supabase
          .from('appointments')
          .update(payload)
          .eq('id', id)
          .eq('store_id', storeId)
          .eq('updated_at', updated_at)
          .select()
          .single()

      // First attempt: try with the full payload (requires migration 035/036 to be applied)
      let { data, error } = await doUpdate(appointmentData as Record<string, unknown>)

      // If the DB rejected the update because migration 035/036 hasn't been applied yet,
      // retry with a backward-compatible payload that works on the pre-migration schema.
      //
      // PostgreSQL / PostgREST error codes we handle here:
      //   23514 — check_violation: new status values not allowed by old CHECK constraint
      //   42703 — undefined_column: new columns (is_late, checked_in_at, …) don't exist yet
      //   PGRST204 — PostgREST "no match" path error (unexpected column reference)
      if (error && (error.code === '23514' || error.code === '42703' || error.code === 'PGRST204')) {
        const compat = buildPreMigration035Payload(appointmentData as Record<string, unknown>)
        ;({ data, error } = await doUpdate(compat))
      }

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('appointment')
        throw error
      }
      return data as Appointment
    },
    onSuccess: (data, variables) => {
      // Detect when the compat bridge fired: the DB stored a legacy-mapped status
      // (e.g. 'in_progress' instead of 'ready') while the caller intended a new
      // canonical status. `variables` is the original mutation input, so
      // variables.status is what the caller actually wanted to store.
      const requestedStatus = variables.status
      const compatFired =
        requestedStatus !== undefined &&
        data.status !== requestedStatus

      if (compatFired && requestedStatus) {
        // Build a corrected record that has the right updated_at (from DB) but the
        // intended status, so subsequent mutations pass the concurrency check and the
        // UI renders the correct workflow state.
        const corrected: Appointment = { ...data, status: requestedStatus }

        queryClient.setQueryData<Appointment[]>(
          [APPOINTMENTS_QUERY_KEY, storeId],
          (old) => old?.map((apt) => apt.id === data.id ? corrected : apt) ?? []
        )
        queryClient.setQueryData<Appointment>(
          [APPOINTMENTS_QUERY_KEY, storeId, data.id],
          corrected
        )
        // Mark both queries as stale so they'll be refetched the next time they
        // become active, but don't force an immediate background refetch that
        // would overwrite the corrected cache entry with the old compat value.
        queryClient.invalidateQueries({
          queryKey: [APPOINTMENTS_QUERY_KEY, storeId],
          refetchType: 'none',
        })
        queryClient.invalidateQueries({
          queryKey: [APPOINTMENTS_QUERY_KEY, storeId, data.id],
          refetchType: 'none',
        })
      } else {
        queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY, storeId] })
        queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY, storeId, data.id] })
      }
    },
  })
}

/**
 * Builds a backward-compatible payload for the pre-migration-035 DB schema.
 *
 * Migration 035 adds new status values (checked_in, ready, picked_up) and new
 * columns (is_late, checked_in_at, etc.). If the migration hasn't been applied
 * yet, the first update attempt fails with a DB error and this function is used
 * to build a fallback payload that works on the old schema.
 *
 * Status mapping (new canonical → old DB value):
 *   checked_in  → confirmed       (1:1 semantic match)
 *   picked_up   → completed       (1:1 semantic match)
 *   ready       → in_progress     (closest pre-migration approximation;
 *                                  the dog is still in-shop but grooming is done.
 *                                  This is temporary — once migration 035 runs,
 *                                  the correct `ready` value will be used.)
 *
 * New columns (is_late, checked_in_at, in_progress_at, ready_at, picked_up_at,
 * client_notified_at, notification_type) are stripped because they don't exist
 * in the pre-035 schema. Workflow timestamps and the late flag won't be persisted
 * until the migration is applied.
 */
function buildPreMigration035Payload(data: Record<string, unknown>): Record<string, unknown> {
  // Strip columns that were added by migration 035 and don't exist pre-migration.
  const migration035Columns = new Set([
    'is_late', 'checked_in_at', 'in_progress_at', 'ready_at',
    'picked_up_at', 'client_notified_at', 'notification_type',
  ])
  const rest = Object.fromEntries(
    Object.entries(data).filter(([key]) => !migration035Columns.has(key))
  )

  // Map new canonical status values back to old DB-compatible values
  if (rest.status) {
    const statusCompat: Record<string, string> = {
      checked_in: 'confirmed',
      picked_up:  'completed',
      ready:      'in_progress', // best pre-migration approximation (see JSDoc above)
    }
    const mapped = statusCompat[rest.status as string]
    if (mapped) rest.status = mapped
  }

  return rest
}

export function useDeleteAppointment() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY, storeId] })
    },
  })
}

// Appointment Services hooks
export function useAppointmentServices(appointmentId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [APPOINTMENT_SERVICES_QUERY_KEY, storeId, appointmentId],
    queryFn: async () => {
      if (!storeId || !appointmentId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('appointment_services')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('service_type', { ascending: true })

      if (error) throw error
      return data as AppointmentService[]
    },
    enabled: !!storeId && !!user && !!appointmentId,
  })
}

export function useAppointmentServicesByAppointmentIds(appointmentIds: string[]) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const normalizedIds = Array.from(new Set(appointmentIds.filter(Boolean))).sort()

  return useQuery({
    queryKey: [APPOINTMENT_SERVICES_QUERY_KEY, storeId, 'batch', normalizedIds],
    queryFn: async () => {
      if (!normalizedIds.length) return [] as AppointmentService[]

      const { data, error } = await supabase
        .from('appointment_services')
        .select('*')
        .in('appointment_id', normalizedIds)
        .order('service_type', { ascending: true })

      if (error) throw error
      return data as AppointmentService[]
    },
    enabled: !!storeId && !!user && normalizedIds.length > 0,
  })
}

export function useCreateAppointmentService() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceData: Omit<AppointmentService, 'id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('appointment_services')
        .insert(serviceData)
        .select()
        .single()

      if (error) throw error
      return data as AppointmentService
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENT_SERVICES_QUERY_KEY, storeId, data.appointment_id] })
    },
  })
}

export function useDeleteAppointmentService() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ serviceId, appointmentId }: { serviceId: string; appointmentId: string }) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('appointment_services')
        .delete()
        .eq('id', serviceId)

      if (error) throw error
      return { appointmentId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENT_SERVICES_QUERY_KEY, storeId, result.appointmentId] })
    },
  })
}
