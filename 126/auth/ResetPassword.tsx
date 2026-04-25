import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    // Listen for the PASSWORD_RECOVERY event from Supabase to confirm
    // the user arrived via a valid recovery link, not a regular session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })

    // If no PASSWORD_RECOVERY event fires quickly, the link is invalid/expired
    const timeout = setTimeout(() => {
      setValidSession((current) => current === null ? false : current)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (loading) return

    if (!password) {
      setError('Password is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        if (updateError.message?.toLowerCase().includes('weak')) {
          setError('Password is too weak. Please choose a stronger password.')
        } else if (
          updateError.message?.toLowerCase().includes('expired') ||
          updateError.message?.toLowerCase().includes('invalid')
        ) {
          setError('Reset link has expired. Please request a new one.')
        } else {
          setError(updateError.message || 'Failed to update password.')
        }
        return
      }

      toast.success('Password updated')
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading while checking session
  if (validSession === null) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20">
                <span className="text-3xl">⏳</span>
              </div>
              <h1 className="text-2xl font-bold">Verifying reset link…</h1>
              <p className="text-sm text-slate-200">Please wait while we verify your reset link.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Invalid / expired session
  if (!validSession) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_55%)]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-3xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold">Reset link is invalid or expired</h1>
              <p className="text-sm text-slate-200">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <button
                onClick={() => navigate('/forgot-password', { replace: true })}
                className="mt-4 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01]"
              >
                Request New Reset Link
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Valid session — show reset form
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
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Reset Password</h1>
            <p className="text-sm text-slate-200">Enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                New Password
              </span>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                Confirm Password
              </span>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-4 text-lg font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
