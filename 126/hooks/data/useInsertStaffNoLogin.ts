import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import type { Staff } from './useStaff'

type InsertNoLoginStaffInput = {
  first_name: string
  last_name: string
  role: string
  status?: string
  is_groomer?: boolean
  hire_date?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  hourly_rate?: number | null
  address?: { street?: string; city?: string; state?: string; zip?: string } | null
  emergency_contact_name?: string | null
  emergency_contact_relation?: string | null
  emergency_contact_phone?: string | null
  specialties?: string[] | null
}

export function useInsertStaffNoLogin() {
  const { storeId } = useStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: InsertNoLoginStaffInput) => {
      if (!storeId) throw new Error('No active store')

      const payload = {
        ...input,
        store_id: storeId,
        user_id: null as null,
      }

      const { data, error } = await supabase
        .from('staff')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error
      return data as Staff
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['staff'] })
      await qc.invalidateQueries({ queryKey: ['staff', storeId] })
    },
  })
}
