import type { MutableRefObject } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  /** Set to `true` before calling `supabase.auth.signOut()` so AuthContext
   *  can differentiate a manual logout from a session expiry. */
  logoutInProgressRef: MutableRefObject<boolean>
}
