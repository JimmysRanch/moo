import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface BusinessSettings {
  id: string
  store_id: string
  company_name?: string
  phone?: string
  email?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    website?: string
  }
  timezone: string
  tax_rate: number
  currency: string
  logo_url?: string
  hours_of_operation?: Array<{
    day: string
    isOpen: boolean
    openTime: string
    closeTime: string
  }>
  booking_rules?: {
    allow_concurrent_appointments?: boolean
    max_appointments_per_slot?: number
  }

  message_settings?: {
    enabled?: boolean
    business_number?: string
    number_status?: 'unconfigured' | 'pending' | 'active'
    usage?: {
      monthly_included?: number
      monthly_used?: number
      billing_cycle_anchor?: string | null
    }
    templates_enabled?: boolean
    automations?: Record<string, boolean>
    notifications?: {
      play_sound?: boolean
      desktop_alerts?: boolean
      mark_unread_after_hours?: number
    }
    compliance?: {
      registration_status?: 'pending' | 'in_review' | 'approved'
      opt_in_copy?: string
      help_keyword_enabled?: boolean
      stop_keyword_enabled?: boolean
    }
    staff_permissions?: {
      allow_all_staff?: boolean
      require_assignment_for_reply?: boolean
    }
  }
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface PaymentMethodConfig {
  id: string
  store_id: string
  method_name: string
  is_enabled: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface StaffPosition {
  id: string
  store_id: string
  position_name: string
  display_order: number
  created_at: string
}

export interface TemperamentOption {
  id: string
  store_id: string
  option_name: string
  display_order: number
  created_at: string
}

export interface DogBreedOption {
  id: string
  store_id: string
  breed_name: string
  display_order: number
  created_at: string
}

export interface WeightRange {
  id: string
  store_id: string
  category: string
  min_weight: number
  max_weight: number
  display_order: number
  created_at: string
}

const BUSINESS_SETTINGS_QUERY_KEY = 'business_settings'
const PAYMENT_METHOD_CONFIG_QUERY_KEY = 'payment_method_config'
const STAFF_POSITIONS_QUERY_KEY = 'staff_positions'
const TEMPERAMENT_OPTIONS_QUERY_KEY = 'temperament_options'
const DOG_BREEDS_QUERY_KEY = 'dog_breeds'
const WEIGHT_RANGES_QUERY_KEY = 'weight_ranges'

// Business Settings hooks
export function useBusinessSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [BUSINESS_SETTINGS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('store_id', storeId)
        .single()

      if (error) throw error
      return data as BusinessSettings
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateBusinessSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settingsData: Omit<BusinessSettings, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('business_settings')
        .insert({
          ...settingsData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as BusinessSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUSINESS_SETTINGS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateBusinessSettings() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ updated_at, ...settingsData }: Partial<BusinessSettings> & { updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('business_settings')
        .update({
          ...settingsData,
        })
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('business settings')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('business settings')
      return data as BusinessSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUSINESS_SETTINGS_QUERY_KEY, storeId] })
    },
  })
}

// Payment Method Config hooks
export function usePaymentMethodConfigs() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYMENT_METHOD_CONFIG_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('payment_method_config')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as PaymentMethodConfig[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreatePaymentMethodConfig() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (configData: Omit<PaymentMethodConfig, 'id' | 'store_id' | 'created_at' | 'updated_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('payment_method_config')
        .insert({
          ...configData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as PaymentMethodConfig
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENT_METHOD_CONFIG_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdatePaymentMethodConfig() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...configData }: Partial<PaymentMethodConfig> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('payment_method_config')
        .update(configData)
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('payment method config')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('payment method config')
      return data as PaymentMethodConfig
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENT_METHOD_CONFIG_QUERY_KEY, storeId] })
    },
  })
}

export function useDeletePaymentMethodConfig() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (configId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('payment_method_config')
        .delete()
        .eq('id', configId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENT_METHOD_CONFIG_QUERY_KEY, storeId] })
    },
  })
}

// Staff Positions hooks
export function useStaffPositions() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [STAFF_POSITIONS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('staff_positions')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as StaffPosition[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateStaffPosition() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (positionData: Omit<StaffPosition, 'id' | 'store_id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('staff_positions')
        .insert({
          ...positionData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as StaffPosition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_POSITIONS_QUERY_KEY, storeId] })
    },
  })
}

export function useDeleteStaffPosition() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (positionId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('staff_positions')
        .delete()
        .eq('id', positionId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_POSITIONS_QUERY_KEY, storeId] })
    },
  })
}

// Temperament Options hooks
export function useTemperamentOptions() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [TEMPERAMENT_OPTIONS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('temperament_options')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as TemperamentOption[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateTemperamentOption() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (optionData: Omit<TemperamentOption, 'id' | 'store_id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('temperament_options')
        .insert({
          ...optionData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as TemperamentOption
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPERAMENT_OPTIONS_QUERY_KEY, storeId] })
    },
  })
}

export function useDeleteTemperamentOption() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (optionId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('temperament_options')
        .delete()
        .eq('id', optionId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPERAMENT_OPTIONS_QUERY_KEY, storeId] })
    },
  })
}

// Dog Breeds hooks
export function useDogBreeds() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [DOG_BREEDS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('dog_breeds')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return (data as DogBreedOption[]).sort((a, b) =>
        a.breed_name.localeCompare(b.breed_name, undefined, { sensitivity: 'base' })
      )
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateDogBreed() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (breedData: Omit<DogBreedOption, 'id' | 'store_id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('dog_breeds')
        .insert({
          ...breedData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as DogBreedOption
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOG_BREEDS_QUERY_KEY, storeId] })
    },
  })
}

export function useBulkCreateDogBreeds() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (breedsData: Array<Omit<DogBreedOption, 'id' | 'store_id' | 'created_at'>>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('dog_breeds')
        .insert(
          breedsData.map((breed) => ({
            ...breed,
            store_id: storeId,
          }))
        )
        .select()

      if (error) throw error
      return data as DogBreedOption[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOG_BREEDS_QUERY_KEY, storeId] })
    },
  })
}

export function useDeleteDogBreed() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (breedId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('dog_breeds')
        .delete()
        .eq('id', breedId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOG_BREEDS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateDogBreed() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Omit<DogBreedOption, 'id' | 'store_id' | 'created_at'>>
    }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('dog_breeds')
        .update(updates)
        .eq('id', id)
        .eq('store_id', storeId)
        .select()
        .single()

      if (error) throw error
      return data as DogBreedOption
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOG_BREEDS_QUERY_KEY, storeId] })
    },
  })
}

// Weight Ranges hooks
export function useWeightRanges() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [WEIGHT_RANGES_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('weight_ranges')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as WeightRange[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateWeightRange() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rangeData: Omit<WeightRange, 'id' | 'store_id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('weight_ranges')
        .insert({
          ...rangeData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as WeightRange
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEIGHT_RANGES_QUERY_KEY, storeId] })
    },
  })
}

export function useDeleteWeightRange() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rangeId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('weight_ranges')
        .delete()
        .eq('id', rangeId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEIGHT_RANGES_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateWeightRange() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Omit<WeightRange, 'id' | 'store_id' | 'created_at'>>
    }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('weight_ranges')
        .update(updates)
        .eq('id', id)
        .eq('store_id', storeId)
        .select()
        .single()

      if (error) throw error
      return data as WeightRange
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEIGHT_RANGES_QUERY_KEY, storeId] })
    },
  })
}
