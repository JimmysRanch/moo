import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { clearAuthStorage } from '@/lib/auth/clearAuthStorage'
import type { AuthContextType } from './types'

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null)
  const [session, setSession] = useState<AuthContextType['session']>(null)
  const [loading, setLoading] = useState(true)

  /** Shared ref so TopNav (or other callers) can signal a manual logout. */
  const logoutInProgressRef = useRef(false)

  /** Prevent showing more than one expiry toast in quick succession. */
  const expiryToastShownRef = useRef(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_OUT') {
        // Clear all auth-scoped storage + caches
        clearAuthStorage()

        if (logoutInProgressRef.current) {
          // Manual logout — no toast
          logoutInProgressRef.current = false
        } else {
          // Session expired / revoked
          if (!expiryToastShownRef.current) {
            expiryToastShownRef.current = true
            toast.error('Your session has expired. Please sign in again.')
            // Reset after a short delay to allow future toasts
            setTimeout(() => {
              expiryToastShownRef.current = false
            }, 5000)
          }
        }
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        // Refresh succeeded but returned no session — treat as expiry
        clearAuthStorage()
        if (!expiryToastShownRef.current) {
          expiryToastShownRef.current = true
          toast.error('Your session has expired. Please sign in again.')
          setTimeout(() => {
            expiryToastShownRef.current = false
          }, 5000)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, logoutInProgressRef }}>
      {children}
    </AuthContext.Provider>
  )
}
