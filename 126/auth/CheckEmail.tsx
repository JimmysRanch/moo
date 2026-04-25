import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function CheckEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string })?.email ?? ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  const handleResend = async () => {
    if (!email) {
      setError('No email address found. Please sign up again.')
      return
    }

    setResending(true)
    setError('')
    setResent(false)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (resendError) {
        setError(resendError.message)
      } else {
        setResent(true)
      }
    } catch {
      setError('Failed to resend email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 shadow-[0_15px_45px_rgba(56,189,248,0.35)]">
              <span className="text-3xl">✉️</span>
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Check Your Email</h1>
            <p className="text-sm text-slate-200">
              We&apos;ve sent a confirmation link to{' '}
              {email ? <strong className="text-white">{email}</strong> : 'your email'}. Click the
              link in the email to activate your account.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            {resent && (
              <p className="text-center text-sm text-emerald-400">
                Confirmation email resent! Check your inbox.
              </p>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {resending ? 'Resending…' : 'Resend Confirmation Email'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01]"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
