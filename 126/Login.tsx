import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { setActiveStoreId } from '@/lib/activeStore'

const bubbles = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  size: 24 + index * 6,
  opacity: 0.18 + index * 0.01,
  top: `${10 + (index * 5) % 70}%`,
  left: `${(index * 13) % 90}%`
}))

export function Login({ previewMode = false }: { previewMode?: boolean } = {}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (previewMode) {
      setError('Preview mode only. Use the standard login page to sign in.')
      return
    }

    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.session) {
      const msg = authError?.message ?? ''
      if (msg.includes('Email not confirmed')) {
        setError('Please verify your email before signing in.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Invalid email or password.')
      } else {
        setError(msg || 'Login failed.')
      }
      setLoading(false)
      return
    }

    // Fetch store memberships
    const { data: memberships } = await supabase
      .from('store_memberships')
      .select('store_id, role')
      .eq('user_id', data.session.user.id)

    const stores = memberships ?? []

    // Cache the first store ID for use during auth context initialization
    if (stores.length > 0) {
      setActiveStoreId(stores[0].store_id)
    }

    // Navigation will be handled by route guards based on store membership
    // If no stores, user will be redirected to /onboarding/create-store
    // If stores exist, user will be redirected to /dashboard
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_55%)]" />
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="absolute rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              top: bubble.top,
              left: bubble.left,
              opacity: bubble.opacity
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/90 via-cyan-300 to-emerald-200 shadow-[0_15px_45px_rgba(56,189,248,0.45)]">
              <div className="absolute -top-4 left-1/2 h-9 w-9 -translate-x-1/2 rounded-full bg-white/70" />
              <span className="text-5xl">🐶</span>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">Dog Grooming</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pamper Your Pooch</h1>
              <p className="mt-2 text-sm text-slate-200">
                Welcome back! Sign in to manage appointments, clients, and wag-worthy services.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">✉️</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                  Email
                </span>
                <input
                  data-testid="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🔒</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">Password</span>
                <input
                  data-testid="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-lg text-slate-200 transition hover:border-white/60"
                aria-label="Show password"
              >
                👁️
              </button>
            </label>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-between text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-white/40 bg-white/10 text-sky-400 focus:ring-sky-400"
                />
                <span>Remember me</span>
              </label>
              <button type="button" onClick={() => navigate('/forgot-password')} className="font-semibold text-sky-200 transition hover:text-white">
                Forgot password?
              </button>
            </div>

            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-4 text-lg font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-200">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="font-semibold text-sky-200 transition hover:text-white"
              onClick={() => navigate('/create-account')}
            >
              Create New Account
            </button>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-4 text-xs text-slate-300">
          <span className="h-px w-12 bg-white/30" />
          <span>Trusted by 2,100+ groomers across the globe</span>
          <span className="h-px w-12 bg-white/30" />
        </div>
      </div>
    </div>
  )
}
