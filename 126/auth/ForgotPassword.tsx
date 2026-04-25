import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (loading) return

    const mail = email.trim()
    if (!mail) {
      setError('Email is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Please enter a valid email.')
      return
    }

    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo })

      if (resetError) {
        // Don't reveal whether the email exists — show generic message for most errors
        if (resetError.message?.toLowerCase().includes('rate limit')) {
          setError('Too many requests. Please try again later.')
        } else {
          // Show neutral success message even on error to prevent account enumeration
          setSubmitted(true)
        }
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    } finally {
      setLoading(false)
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
              <span className="text-3xl">🔑</span>
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Forgot Password</h1>
            <p className="text-sm text-slate-200">
              {submitted
                ? "If an account exists for that email, you'll receive a reset link."
                : "Enter your email address and we'll send you a link to reset your password."}
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                  Email Address
                </span>
                <input
                  type="email"
                  placeholder="you@doggrooming.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div className="mt-8">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
                Check your inbox for a password reset link.
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm font-semibold text-sky-200 transition hover:text-white"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
