import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'

const bubbles = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  size: 24 + index * 6,
  opacity: 0.18 + index * 0.01,
  top: `${10 + (index * 5) % 70}%`,
  left: `${(index * 13) % 90}%`
}))

export function Signup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    businessName: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Step 1: Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Failed to create account')


      // Step 2: IMMEDIATELY create store + profile (don't wait!)
      const { data: storeId, error: storeError } = await supabase.rpc('create_store_for_user', {
        p_name: formData.businessName,
        p_first_name: formData.firstName,
        p_last_name: formData.lastName,
        p_email: formData.email,
      })

      if (storeError) {
        console.error('Failed to create store:', storeError)
        throw new Error('Account created but store setup failed. Please contact support.')
      }

      if (!storeId) {
        throw new Error('Store creation failed. Please contact support.')
      }

      // Step 3: Create business settings
      await supabase.from('business_settings').insert({
        store_id: storeId,
        company_name: formData.businessName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        tax_rate: 0,
        currency: 'USD',
        email: formData.email,
      })

      // Step 4: Seed default payment method
      await supabase.from('payment_method_config').insert({
        store_id: storeId,
        method_name: 'Cash',
        is_enabled: true,
        display_order: 0,
      })

      // Success!
      setEmail(formData.email)
      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <span className="text-3xl">✉️</span>
              </div>
              <h1 className="text-2xl font-bold">Check Your Email!</h1>
              <p className="text-sm text-slate-200">
                We sent a verification link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-slate-300">
                Click the link in the email to verify your account and log in.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-center text-2xl font-bold mb-6">Create Your Account</h1>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-2xl bg-red-500/20 border border-red-500/50 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm text-slate-300 mb-2">
                Email
              </label>
              <input
                data-testid="signup-email"
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-slate-300 mb-2">
                Password
              </label>
              <input
                data-testid="signup-password"
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="firstName" className="block text-sm text-slate-300 mb-2">
                First Name
              </label>
              <input
                data-testid="signup-first-name"
                id="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm text-slate-300 mb-2">
                Last Name
              </label>
              <input
                data-testid="signup-last-name"
                id="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                placeholder="Doe"
              />
            </div>

            <div>
              <label htmlFor="businessName" className="block text-sm text-slate-300 mb-2">
                Business Name
              </label>
              <input
                data-testid="signup-business-name"
                id="businessName"
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                placeholder="Scruffy Butts"
              />
            </div>

            <button
              data-testid="signup-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
