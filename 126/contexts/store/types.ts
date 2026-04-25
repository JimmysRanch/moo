export interface StoreMembership {
  store_id: string
  role: string
}

export interface StoreInfo {
  id: string
  name: string
}

export interface StoreContextType {
  storeId: string | null
  role: string | null
  memberships: StoreMembership[]
  stores: StoreInfo[]
  loading: boolean
  error: string | null
  setActiveStoreId: (storeId: string) => void
  refreshMemberships: () => Promise<void>
}
