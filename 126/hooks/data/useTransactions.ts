import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface Transaction {
  id: string
  store_id: string
  appointment_id?: string
  client_id?: string
  date: string
  subtotal: number
  discount?: number
  discount_description?: string
  additional_fees?: number
  additional_fees_description?: string
  total: number
  tip_amount?: number
  tip_payment_method?: string
  payment_method: string
  status: 'pending' | 'completed' | 'refunded' | 'cancelled'
  type: 'sale' | 'refund' | 'adjustment'
  stripe_payment_intent_id?: string
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  item_name: string
  item_type: 'service' | 'product' | 'addon' | 'other'
  quantity: number
  price: number
  total: number
  created_at: string
}

const TRANSACTIONS_QUERY_KEY = 'transactions'
const TRANSACTION_ITEMS_QUERY_KEY = 'transaction_items'

export function useTransactions() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      if (error) throw error
      return data as Transaction[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useTransaction(transactionId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, storeId, transactionId],
    queryFn: async () => {
      if (!storeId || !transactionId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', transactionId)
        .single()

      if (error) throw error
      return data as Transaction
    },
    enabled: !!storeId && !!user && !!transactionId,
  })
}

export function useCreateTransaction() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transactionData: Omit<Transaction, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transactionData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as Transaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateTransaction() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...transactionData }: Partial<Transaction> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('transactions')
        .update({
          ...transactionData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('transaction')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('transaction')
      return data as Transaction
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useDeleteTransaction() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transactionId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY, storeId] })
    },
  })
}

// Transaction Items hooks
export function useTransactionItems(transactionId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [TRANSACTION_ITEMS_QUERY_KEY, storeId, transactionId],
    queryFn: async () => {
      if (!storeId || !transactionId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', transactionId)

      if (error) throw error
      return data as TransactionItem[]
    },
    enabled: !!storeId && !!user && !!transactionId,
  })
}

export function useTransactionItemsForTransactions(transactionIds: string[]) {
  const { storeId } = useStore()
  const { user } = useAuth()

  const normalizedIds = [...new Set(transactionIds.filter(Boolean))]

  return useQuery({
    queryKey: [TRANSACTION_ITEMS_QUERY_KEY, storeId, ...normalizedIds],
    queryFn: async () => {
      if (!storeId || normalizedIds.length === 0) return []

      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', normalizedIds)

      if (error) throw error
      return data as TransactionItem[]
    },
    enabled: !!storeId && !!user && normalizedIds.length > 0,
  })
}

export function useCreateTransactionItem() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemData: Omit<TransactionItem, 'id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('transaction_items')
        .insert(itemData)
        .select()
        .single()

      if (error) throw error
      return data as TransactionItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTION_ITEMS_QUERY_KEY, storeId, data.transaction_id] })
    },
  })
}

export function useDeleteTransactionItem() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, transactionId }: { itemId: string; transactionId: string }) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('transaction_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      return { transactionId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTION_ITEMS_QUERY_KEY, storeId, result.transactionId] })
    },
  })
}
