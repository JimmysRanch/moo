import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveStoreId, setActiveStoreId as persistActiveStoreId } from '@/lib/activeStore'
import { queryClient } from '@/lib/queryClient'
import { useAuth } from '../auth'
import { isTransientStoreLoadError } from './loadMembershipsErrors'
import { logFallback, logWarning } from '@/lib/appLogger'
import type { StoreMembership, StoreInfo, StoreContextType } from './types'

export const StoreContext = createContext<StoreContextType>({
  storeId: null,
  role: null,
  memberships: [],
  stores: [],
  loading: true,
  error: null,
  setActiveStoreId: () => {},
  refreshMemberships: async () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(getActiveStoreId())
  const [role, setRole] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<StoreMembership[]>([])
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const storeIdRef = useRef(storeId)

  useEffect(() => {
    storeIdRef.current = storeId
  }, [storeId])

  const getRecoveredMembership = useCallback(
    (row: { store_id: string; role?: string | null; is_owner?: boolean | null }) => ({
      store_id: row.store_id,
      role: row.is_owner ? 'owner' : (row.role || 'front_desk'),
    }),
    [],
  )

  const loadMemberships = useCallback(async () => {
    if (!user) return
    const userIdAtStart = user.id
    const persistedStoreId = storeIdRef.current ?? getActiveStoreId()
    const preservePersistedStoreId = () => {
      if (!persistedStoreId) return false
      setStoreId(persistedStoreId)
      setError(null)
      return true
    }
    const recoverMembershipsFromStaff = async (eventType: string, details?: string) => {
      logFallback({
        event_type: eventType,
        message: 'Recovering store membership from staff rows',
        details,
        userId: userIdAtStart,
      })

      const { data: staffRows, error: staffError } = await supabase
        .from('staff')
        .select('store_id, role, is_owner')
        .eq('user_id', userIdAtStart)

      if (staffError) {
        setMemberships([])
        setStores([])
        setStoreId(null)
        setRole(null)
        return false
      }

      const recoveredMemberships = (staffRows ?? []).map(getRecoveredMembership)

      setMemberships(recoveredMemberships)

      const recoveredStoreIds = recoveredMemberships.map((membership) => membership.store_id)
      let recoveredStores: StoreInfo[] = []
      if (recoveredStoreIds.length > 0) {
        const { data: recoveredStoreData } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', recoveredStoreIds)

        recoveredStores = (recoveredStoreData ?? []) as StoreInfo[]
      }
      setStores(recoveredStores)

      const activeRecovered = recoveredMemberships[0] ?? null
      if (activeRecovered) {
        setStoreId(activeRecovered.store_id)
        setRole(activeRecovered.role)
        persistActiveStoreId(activeRecovered.store_id)
        setError(null)
        return true
      }

      setStoreId(null)
      setRole(null)
      return false
    }
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('store_memberships')
        .select('store_id, role')
        .eq('user_id', userIdAtStart)

      if (error) {
        console.error('Error loading store memberships:', error)
        if (!user || user.id !== userIdAtStart) return
        // Always try to preserve the persisted storeId on any load failure.
        // This prevents false redirects to onboarding when connectivity is
        // flaky or when a Supabase error occurs transiently in CI environments.
        if (preservePersistedStoreId()) {
          logWarning({
            event_type: isTransientStoreLoadError(error)
              ? 'store_membership_load_transient_error'
              : 'store_membership_load_error',
            message: 'Error loading store memberships; preserved persisted store id',
            details: typeof error === 'object' ? JSON.stringify(error) : String(error),
            userId: userIdAtStart,
          })
          return
        }
        // Fallback path: recover memberships from the user's own staff rows
        await recoverMembershipsFromStaff(
          'store_membership_fallback_to_staff',
          typeof error === 'object' ? JSON.stringify(error) : String(error),
        )
        return
      }

      const userMemberships = (data ?? []) as StoreMembership[]
      if (!user || user.id !== userIdAtStart) return
      setMemberships(userMemberships)

      // Fetch store names
      const storeIds = userMemberships.map((m) => m.store_id)
      let storeInfos: StoreInfo[] = []
      if (storeIds.length > 0) {
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', storeIds)

        if (storeError) {
          console.error('Error loading stores:', storeError)
          storeInfos = []
        } else {
          storeInfos = (storeData ?? []) as StoreInfo[]
        }
      }

      if (!user || user.id !== userIdAtStart) return
      setStores(storeInfos)

      // Determine active store
      const savedStoreId = getActiveStoreId()
      const savedMembership = userMemberships.find((m) => m.store_id === savedStoreId)
      const activeMembership = savedMembership ?? userMemberships[0] ?? null

      if (!user || user.id !== userIdAtStart) return

      if (activeMembership) {
        setStoreId(activeMembership.store_id)
        setRole(activeMembership.role)
        persistActiveStoreId(activeMembership.store_id)
      } else {
        // store_memberships query succeeded but returned no rows. This can
        // happen during auth initialization when a stale token causes RLS to
        // filter out all rows before a token refresh completes. Apply the same
        // preservePersistedStoreId() fallback used in the error path to prevent
        // a false redirect to onboarding → /dashboard.
        if (preservePersistedStoreId()) {
          logWarning({
            event_type: 'store_membership_empty_preserved',
            message: 'store_memberships query returned empty; preserved persisted store id',
            userId: userIdAtStart,
          })
          return
        }
        if (await recoverMembershipsFromStaff('store_membership_empty_fallback_to_staff')) {
          return
        }
        setStoreId(null)
        setRole(null)
      }
    } catch (err) {
      console.error('Unexpected error loading memberships:', err)
      if (!user || user.id !== userIdAtStart) return
      // Always try to preserve the persisted storeId on any error.
      if (preservePersistedStoreId()) {
        logWarning({
          event_type: isTransientStoreLoadError(err)
            ? 'store_membership_load_transient_error'
            : 'store_membership_load_error',
          message: 'Unexpected error loading memberships; preserved persisted store id',
          details: typeof err === 'object' ? JSON.stringify(err) : String(err),
          userId: userIdAtStart,
        })
        return
      }
      setMemberships([])
      setStores([])
      setStoreId(null)
      setRole(null)
      setError('Unable to load your account right now. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [getRecoveredMembership, user])

  useEffect(() => {
    if (!user) {
      setStoreId(null)
      setRole(null)
      setMemberships([])
      setStores([])
      setLoading(false)
      setError(null)
      return
    }

    loadMemberships()
  }, [user, loadMemberships])

  const handleSetActiveStoreId = (newStoreId: string) => {
    if (newStoreId === storeId) return
    const membership = memberships.find((m) => m.store_id === newStoreId)
    if (membership) {
      setStoreId(newStoreId)
      setRole(membership.role)
      persistActiveStoreId(newStoreId)
      queryClient.clear()
    }
  }

  return (
    <StoreContext.Provider
      value={{
        storeId,
        role,
        memberships,
        stores,
        loading,
        error,
        setActiveStoreId: handleSetActiveStoreId,
        refreshMemberships: loadMemberships,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
