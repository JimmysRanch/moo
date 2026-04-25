import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Client {
  id: string
  store_id: string
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
  referral_source?: string
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface Pet {
  id: string
  client_id: string
  name: string
  breed?: string
  mixed_breed?: string
  weight?: number
  weight_category?: string
  birthday?: string
  gender?: string
  color?: string
  temperament?: string[]
  grooming_notes?: string
  medical_notes?: string
  overall_length?: string
  face_style?: string
  skip_ear_trim?: boolean
  skip_tail_trim?: boolean
  desired_style_photo?: string
  is_active?: boolean
  deleted_at?: string | null
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

// ─── Query Scoping Policy ─────────────────────────────────────────
// All queries should be explicitly store-scoped unless intentionally
// global/admin. Direct store_id filters are used as defense-in-depth
// in addition to RLS policies.
//
// Queries relying on parent-scoped RLS (safe because the parent table
// enforces store membership via RLS, and the child join limits rows):
//   - usePets(clientId): scoped via client_id FK → clients.store_id RLS
//   - usePet(petId): single-row fetch; RLS on pets checks via client FK
//
// Queries with explicit store_id filter (defense-in-depth):
//   - useClients(): explicit .eq('store_id', storeId)
//   - useClient(clientId): explicit .eq('store_id', storeId)
//   - useAllPets(): all pets via client join (historical/reporting contexts)
//   - useActivePets(): active-only pets via client join (booking/operational flows)
// ──────────────────────────────────────────────────────────────────

const CLIENTS_QUERY_KEY = 'clients'

export function useClients() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [CLIENTS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('store_id', storeId)
        .order('last_name', { ascending: true })

      if (error) throw error
      return data as Client[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useClient(clientId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [CLIENTS_QUERY_KEY, storeId, clientId],
    queryFn: async () => {
      if (!storeId || !clientId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', clientId)
        .single()

      if (error) throw error
      return data as Client
    },
    enabled: !!storeId && !!user && !!clientId,
  })
}

export function useCreateClient() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateClient() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...clientData }: Partial<Client> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('clients')
        .update({
          ...clientData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('client')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('client')
      return data as Client
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useDeleteClient() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY, storeId] })
    },
  })
}

// Pet hooks
const PETS_QUERY_KEY = 'pets'

// Returns all pets for this store regardless of active status.
// Use this for historical/reporting contexts (appointment views, POS, payroll, reports)
// where inactive pet details must still resolve for past records.
export function useAllPets() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PETS_QUERY_KEY, storeId, 'all'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      // Defense-in-depth: explicit store_id filter via client join,
      // not relying solely on parent-scoped RLS on the pets table.
      const { data, error } = await supabase
        .from('pets')
        .select('*, clients!inner(store_id)')
        .eq('clients.store_id', storeId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Pet[]
    },
    enabled: !!storeId && !!user,
  })
}

// Returns only active (is_active = true) pets for this store.
// Use this for operational flows: appointment booking, client lists, pet selectors.
export function useActivePets() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PETS_QUERY_KEY, storeId, 'active'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('pets')
        .select('*, clients!inner(store_id)')
        .eq('clients.store_id', storeId)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Pet[]
    },
    enabled: !!storeId && !!user,
  })
}

export function usePets(clientId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PETS_QUERY_KEY, storeId, clientId],
    queryFn: async () => {
      if (!storeId || !clientId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('client_id', clientId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Pet[]
    },
    enabled: !!storeId && !!user && !!clientId,
  })
}

export function usePet(petId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PETS_QUERY_KEY, storeId, petId],
    queryFn: async () => {
      if (!storeId || !petId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single()

      if (error) throw error
      return data as Pet
    },
    enabled: !!storeId && !!user && !!petId,
  })
}

export function useCreatePet() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (petData: Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('pets')
        .insert({
          ...petData,
        })
        .select()
        .single()

      if (error) throw error
      return data as Pet
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, data.client_id] })
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useUpdatePet() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...petData }: Partial<Pet> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('pets')
        .update({
          ...petData,
        })
        .eq('id', id)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('pet')
        throw error
      }
      return data as Pet
    },
    onSuccess: (result) => {
      if (result.client_id) {
        queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, result.client_id] })
      }
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, result.id] })
    },
  })
}

// Soft-deactivates a pet by setting is_active = false and recording deleted_at.
// The pet row is preserved so that historical appointments, payment records, and
// reports can still resolve pet details.
export function useDeactivatePet() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ petId, clientId }: { petId: string; clientId: string }) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('pets')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', petId)

      if (error) throw error
      return { clientId, petId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, result.clientId] })
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, result.petId] })
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, 'all'] })
      queryClient.invalidateQueries({ queryKey: [PETS_QUERY_KEY, storeId, 'active'] })
    },
  })
}
