import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Expense {
  id: string
  store_id: string
  date: string
  category: string
  amount: number
  vendor?: string
  description?: string
  payment_method?: string
  receipt_url?: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

const EXPENSES_QUERY_KEY = 'expenses'

export function useExpenses() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [EXPENSES_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      if (error) throw error
      return data as Expense[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useExpense(expenseId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [EXPENSES_QUERY_KEY, storeId, expenseId],
    queryFn: async () => {
      if (!storeId || !expenseId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', expenseId)
        .single()

      if (error) throw error
      return data as Expense
    },
    enabled: !!storeId && !!user && !!expenseId,
  })
}

export function useExpensesByCategory(category: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [EXPENSES_QUERY_KEY, storeId, 'category', category],
    queryFn: async () => {
      if (!storeId || !category) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .eq('category', category)
        .order('date', { ascending: false })

      if (error) throw error
      return data as Expense[]
    },
    enabled: !!storeId && !!user && !!category,
  })
}

export function useCreateExpense(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async (expenseData: Omit<Expense, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...expenseData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Expense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateExpense() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...expenseData }: Partial<Expense> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('expenses')
        .update({
          ...expenseData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('expense')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('expense')
      return data as Expense
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useDeleteExpense() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expenseId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY, storeId] })
    },
  })
}
