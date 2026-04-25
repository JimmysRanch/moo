import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { setActiveStoreId } from '@/lib/activeStore'

export function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(location.search)
        const next = params.get('next') ?? '/dashboard'
        const code = params.get('code')
        const callbackError = params.get('error_description') || params.get('error')

        if (callbackError) {
          setError(`Sign-in verification failed: ${callbackError}`)
          return
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (exchangeError) {
            setError('Unable to verify your invite link. Please request a new invitation and try again.')
            return
          }
        } else if (location.search.includes('type=invite') || location.search.includes('access_token=')) {
          setError('Missing or invalid verification code. Please use the latest invite email link.')
          return
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          setError('We could not validate your session after verification. Please sign in again.')
          return
        }

        if (!session) {
          setError('Verification completed but no active session was found. Please request a fresh invite link.')
          return
        }

        if (next.startsWith('/onboarding/staff')) {
          navigate(next, { replace: true })
          return
        }

        const userId = session.user.id

        const { data: memberships, error: membershipError } = await supabase
          .from('store_memberships')
          .select('store_id')
          .eq('user_id', userId)
          .limit(1)

        if (membershipError) {
          console.error('Failed to fetch store memberships:', membershipError)
          setError('Unable to load your account. Please contact support.')
          return
        }

        if (!memberships || memberships.length === 0) {
          setError('Account setup incomplete. Please contact support.')
          return
        }

        setActiveStoreId(memberships[0].store_id)
        navigate('/dashboard', { replace: true })
      } catch {
        setError('An unexpected error occurred while verifying your sign-in. Please try again.')
      }
    }

    handleCallback()
  }, [location.search, navigate])

  if (error) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-3xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold">Verification Failed</h1>
              <p className="text-sm text-slate-200">{error}</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="mt-4 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01]"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold">Verifying your email…</h1>
            <p className="text-sm text-slate-200">Please wait while we log you in.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
