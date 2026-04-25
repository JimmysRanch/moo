import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Staff {
  id: string
  store_id: string
  user_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  notes?: string
  role: string
  status: 'active' | 'on_leave' | 'inactive'
  is_groomer: boolean
  is_owner?: boolean
  can_take_appointments?: boolean
  specialties?: string[]
  hourly_rate?: number
  hire_date?: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

const STAFF_QUERY_KEY = 'staff'

export function useStaff() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('store_id', storeId)
        .order('last_name', { ascending: true })

      if (error) throw error
      return data as Staff[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useStaffMember(staffId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_QUERY_KEY, storeId, staffId],
    queryFn: async () => {
      if (!storeId || !staffId) throw new Error('Missing required parameters')

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', staffId)
        .single()

      if (error) throw error
      return data as Staff
    },
    enabled: !!storeId && !!user && !!staffId,
  })
}

export function useCreateStaff() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffData: Omit<Staff, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('staff')
        .upsert({
          ...staffData,
          store_id: storeId,
          user_id: user.id,
        }, { onConflict: 'store_id, user_id' })
        .select()
        .single()

      if (error) throw error
      return data as Staff
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateStaff() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...staffData }: Partial<Staff> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('staff')
        .update(staffData)
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('staff member')
        throw error
      }

      return data as Staff
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY, storeId, result.id] })
    },
  })
}

export function useDeleteStaff() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY, storeId] })
    },
  })
}
