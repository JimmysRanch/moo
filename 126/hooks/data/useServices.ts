import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Service {
  id: string
  store_id: string
  name: string
  description?: string
  service_type: 'main' | 'addon'
  has_size_pricing: boolean
  price_small?: number
  price_medium?: number
  price_large?: number
  price_giant?: number
  price_xxlarge?: number
  is_active: boolean
  estimated_duration_minutes: number
  display_order: number
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

const SERVICES_QUERY_KEY = 'services'

export function useServices() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [SERVICES_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as Service[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useService(serviceId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [SERVICES_QUERY_KEY, storeId, serviceId],
    queryFn: async () => {
      if (!storeId || !serviceId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', serviceId)
        .single()

      if (error) throw error
      return data as Service
    },
    enabled: !!storeId && !!user && !!serviceId,
  })
}

export function useServicesByType(serviceType: 'main' | 'addon' | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [SERVICES_QUERY_KEY, storeId, 'type', serviceType],
    queryFn: async () => {
      if (!storeId || !serviceType) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('store_id', storeId)
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as Service[]
    },
    enabled: !!storeId && !!user && !!serviceType,
  })
}

export function useCreateService() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceData: Omit<Service, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('services')
        .insert({
          ...serviceData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Service
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateService() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...serviceData }: Partial<Service> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('services')
        .update({
          ...serviceData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('service')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('service')
      return data as Service
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useReorderServices() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      serviceUpdates: Array<Pick<Service, 'id' | 'updated_at' | 'display_order'>>
    ) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const updatedServices: Service[] = []

      for (const serviceUpdate of serviceUpdates) {
        const { data, error, count } = await supabase
          .from('services')
          .update({
            display_order: serviceUpdate.display_order,
          })
          .eq('id', serviceUpdate.id)
          .eq('store_id', storeId)
          .eq('updated_at', serviceUpdate.updated_at)
          .select()
          .single()

        if (error) {
          if (error.code === 'PGRST116') throw new ConcurrencyError('service')
          throw error
        }

        if (!data && count === 0) throw new ConcurrencyError('service')
        updatedServices.push(data as Service)
      }

      return updatedServices
    },
    onSuccess: (updatedServices) => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId] })
      updatedServices.forEach((service) => {
        queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId, service.id] })
      })
    },
  })
}

export function useDeleteService() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY, storeId] })
    },
  })
}
