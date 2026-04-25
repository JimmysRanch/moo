import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConcurrencyError } from '@/lib/concurrency'

export interface InventoryItem {
  id: string
  store_id: string
  name: string
  category: string
  sku?: string
  quantity: number
  price?: number
  cost?: number
  avg_unit_cost?: number | null
  inventory_value?: number
  last_unit_cost?: number | null
  reorder_level: number
  supplier?: string
  description?: string
  staff_compensation_type?: 'none' | 'percentage' | 'fixed'
  staff_compensation_value?: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface InventoryLedger {
  id: string
  store_id: string
  item_id: string
  timestamp: string
  change: number
  reason: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'transfer'
  reference?: string
  reference_type?: string
  reference_id?: string
  user_id?: string
  resulting_quantity: number
  unit_cost_used?: number | null
  total_cost?: number | null
  notes?: string
  created_at: string
}

export interface InventorySnapshot {
  id: string
  store_id: string
  timestamp: string
  total_value: number
  retail_value: number
  supply_value: number
  item_count: number
  created_at: string
}

const INVENTORY_ITEMS_QUERY_KEY = 'inventory_items'
const INVENTORY_LEDGER_QUERY_KEY = 'inventory_ledger'
const INVENTORY_SNAPSHOTS_QUERY_KEY = 'inventory_snapshots'

// Inventory Items hooks
export function useInventoryItems(includeInactive = false) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, includeInactive ? 'all' : 'active'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('store_id', storeId)

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) throw error
      return data as InventoryItem[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useInventoryItem(itemId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, itemId],
    queryFn: async () => {
      if (!storeId || !itemId) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', itemId)
        .single()

      if (error) throw error
      return data as InventoryItem
    },
    enabled: !!storeId && !!user && !!itemId,
  })
}

export function useInventoryItemsByCategory(category: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, 'category', category],
    queryFn: async () => {
      if (!storeId || !category) throw new Error('Missing required parameters')
      
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('store_id', storeId)
        .eq('category', category)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as InventoryItem[]
    },
    enabled: !!storeId && !!user && !!category,
  })
}

export function useCreateInventoryItem() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemData: Omit<InventoryItem, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          ...itemData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as InventoryItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
    },
  })
}

export function useUpdateInventoryItem() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updated_at, ...itemData }: Partial<InventoryItem> & { id: string; updated_at: string }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error, count } = await supabase
        .from('inventory_items')
        .update({
          ...itemData,
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .eq('updated_at', updated_at)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw new ConcurrencyError('inventory item')
        throw error
      }
      if (!data && count === 0) throw new ConcurrencyError('inventory item')
      return data as InventoryItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, data.id] })
    },
  })
}

export function useDeleteInventoryItem() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!storeId) throw new Error('No active store')

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
    },
  })
}

// Inventory Ledger hooks
export function useInventoryLedger(itemId?: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, itemId ?? 'all'],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      let query = supabase
        .from('inventory_ledger')
        .select('*')
        .eq('store_id', storeId)

      if (itemId) {
        query = query.eq('item_id', itemId)
      }

      const { data, error } = await query.order('timestamp', { ascending: false })

      if (error) throw error
      return data as InventoryLedger[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateInventoryLedgerEntry() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ledgerData: Omit<InventoryLedger, 'id' | 'store_id' | 'created_at' | 'user_id'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('inventory_ledger')
        .insert({
          ...ledgerData,
          store_id: storeId,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as InventoryLedger
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, data.item_id] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, 'all'] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
    },
  })
}

// Inventory Snapshots hooks
export function useInventorySnapshots() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [INVENTORY_SNAPSHOTS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('*')
        .eq('store_id', storeId)
        .order('timestamp', { ascending: false })

      if (error) throw error
      return data as InventorySnapshot[]
    },
    enabled: !!storeId && !!user,
  })
}

export function useCreateInventorySnapshot() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (snapshotData: Omit<InventorySnapshot, 'id' | 'store_id' | 'created_at'>) => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase
        .from('inventory_snapshots')
        .insert({
          ...snapshotData,
          store_id: storeId,
        })
        .select()
        .single()

      if (error) throw error
      return data as InventorySnapshot
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_SNAPSHOTS_QUERY_KEY, storeId] })
    },
  })
}

// ── Weighted Average Cost mutation hooks ──────────────────────────────────────

export interface InventoryCostingResult {
  item_id: string
  on_hand_qty: number
  avg_unit_cost: number | null
  inventory_value: number
  last_unit_cost?: number | null
  cogs_total?: number
  ledger_id: string
  updated_at: string
}

export function useRecordInventoryPurchase(options?: { suppressGlobalError?: boolean }) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: options?.suppressGlobalError ? { onError: () => {} } : undefined,
    mutationFn: async (params: {
      itemId: string
      qty: number
      unitCost: number
      referenceType?: string
      referenceId?: string
      notes?: string
    }): Promise<InventoryCostingResult> => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase.rpc('record_inventory_purchase', {
        p_store_id:       storeId,
        p_item_id:        params.itemId,
        p_qty:            params.qty,
        p_unit_cost:      params.unitCost,
        p_reference_type: params.referenceType ?? null,
        p_reference_id:   params.referenceId ?? null,
        p_notes:          params.notes ?? null,
        p_user_id:        user.id,
      })

      if (error) throw error
      return data as InventoryCostingResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useRecordInventorySale() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      itemId: string
      qty: number
      referenceType?: string
      referenceId?: string
      notes?: string
    }): Promise<InventoryCostingResult> => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase.rpc('record_inventory_sale', {
        p_store_id:       storeId,
        p_item_id:        params.itemId,
        p_qty:            params.qty,
        p_reference_type: params.referenceType ?? null,
        p_reference_id:   params.referenceId ?? null,
        p_notes:          params.notes ?? null,
        p_user_id:        user.id,
      })

      if (error) throw error
      return data as InventoryCostingResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, 'all'] })
    },
  })
}

export function useRecordInventoryAdjustment() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      itemId: string
      qtyDelta: number
      unitCost?: number
      referenceType?: string
      referenceId?: string
      notes?: string
    }): Promise<InventoryCostingResult> => {
      if (!storeId || !user) throw new Error('Missing required context')

      const { data, error } = await supabase.rpc('record_inventory_adjustment', {
        p_store_id:       storeId,
        p_item_id:        params.itemId,
        p_qty_delta:      params.qtyDelta,
        p_unit_cost:      params.unitCost ?? null,
        p_reference_type: params.referenceType ?? null,
        p_reference_id:   params.referenceId ?? null,
        p_notes:          params.notes ?? null,
        p_user_id:        user.id,
      })

      if (error) throw error
      return data as InventoryCostingResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_ITEMS_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, variables.itemId] })
      queryClient.invalidateQueries({ queryKey: [INVENTORY_LEDGER_QUERY_KEY, storeId, 'all'] })
    },
  })
}
