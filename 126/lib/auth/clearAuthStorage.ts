import { clearActiveStoreId } from '@/lib/activeStore'
import { queryClient } from '@/lib/queryClient'

/**
 * Auth-scoped localStorage keys to remove on logout / session expiry.
 * All logout and expiry flows must call `clearAuthStorage()` — never
 * hand-pick keys in individual files.
 */
const AUTH_STORAGE_KEYS = [
  'activeStoreId',
  'salonId',
  'onboardingComplete',
  'onboardingStep',
  'cachedStoreContext',
  'roleContext',
  'permissionContext',
] as const

/**
 * Remove every auth-derived key from localStorage, clear the React-Query
 * cache, and delete any lingering global auth hacks (`window.user`, etc.).
 */
export function clearAuthStorage(): void {
  // 1. localStorage
  try {
    for (const key of AUTH_STORAGE_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // Restricted environment — nothing to do
  }

  // Also call the canonical helper so callers don't need to remember both
  clearActiveStoreId()

  // 2. React Query cache
  queryClient.clear()

  // 3. Remove any remaining global auth injections
  try {
    const win = window as unknown as Record<string, unknown>
    delete win.user
    delete win.session
    delete win.supabase
  } catch {
    // ignore
  }
}
