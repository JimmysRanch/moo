import { supabase } from '@/lib/supabase'
import { clearActiveStoreId } from '@/lib/activeStore'
import { queryClient } from '@/lib/queryClient'
import { toast } from 'sonner'

let logoutInProgress = false

/**
 * Force-logout the user due to access removal (e.g. RLS denial, membership revoked).
 * Single-flight: if multiple requests fail concurrently, only the first triggers logout.
 */
export async function forceLogoutDueToAccessRemoval(): Promise<void> {
  if (logoutInProgress) return
  logoutInProgress = true

  try {
    // 1) Sign out from Supabase (ignore failure)
    try {
      await supabase.auth.signOut()
    } catch {
      // continue regardless
    }

    // 2) Clear all storage
    clearActiveStoreId()
    try {
      localStorage.removeItem('salonId')
    } catch {
      // ignore
    }

    // 3) Clear React Query cache
    queryClient.clear()

    // 4) Show one message
    toast.error('Access removed.')

    // 5) Navigate to /login with replace
    window.location.replace('/login')
  } finally {
    logoutInProgress = false
  }
}

/**
 * Check if an error represents an RLS denial or auth failure that should trigger forced logout.
 */
export function isAccessDeniedError(error: unknown): boolean {
  if (!error) return false
  const msg = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: string }).message)
    : String(error)
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: string }).code)
    : ''

  // Postgres RLS denial code
  if (code === '42501') return true
  // PostgrestError / Supabase messages
  if (/permission denied/i.test(msg)) return true
  if (/row-level security/i.test(msg)) return true
  // HTTP status codes embedded in error
  if (/40[13]/.test(code)) return true

  return false
}
