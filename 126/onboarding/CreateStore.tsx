import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { setActiveStoreId } from '@/lib/activeStore'
import { useStore } from '@/contexts/StoreContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const bubbles = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  size: 24 + index * 6,
  opacity: 0.18 + index * 0.01,
  top: `${10 + (index * 5) % 70}%`,
  left: `${(index * 13) % 90}%`
}))

export function CreateStore({ previewMode = false }: { previewMode?: boolean } = {}) {
  const navigate = useNavigate()
  const { storeId, refreshMemberships, loading: storeLoading } = useStore()
  const [storeName, setStoreName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isEmailValid = EMAIL_REGEX.test(email.trim())
  const isFormValid = storeName.trim().length > 0 && firstName.trim().length > 0 && lastName.trim().length > 0 && isEmailValid

  // Guard: redirect to dashboard if user already has a store
  useEffect(() => {
    if (!previewMode && !storeLoading && storeId) {
      navigate('/dashboard', { replace: true })
    }
  }, [previewMode, storeId, storeLoading, navigate])

  // Guard: must be logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (!previewMode) {
          navigate('/login', { replace: true })
        }
        return
      }
      setEmail(session.user.email ?? '')
    })
  }, [previewMode, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (previewMode) {
      setError('Preview mode only. Use the standard onboarding flow to create a store.')
      return
    }

    const trimmedName = storeName.trim()
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) {
      setError('Store name is required.')
      return
    }
    if (!trimmedFirstName) {
      setError('First name is required.')
      return
    }
    if (!trimmedLastName) {
      setError('Last name is required.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('A valid email is required.')
      return
    }

    setLoading(true)
    try {
      // 1. Verify authentication using getUser() (server-validated)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('No authenticated user found — redirecting to /login')
        setError('You must be logged in to create a store.')
        setLoading(false)
        navigate('/login', { replace: true })
        return
      }

      console.log('Creating store for user:', user.id)

      // 2. Call the RPC directly — no server roundtrip
      const { data, error: rpcError } = await supabase.rpc('create_store_for_user', {
        p_name: trimmedName,
        p_first_name: trimmedFirstName,
        p_last_name: trimmedLastName,
        p_email: trimmedEmail,
      })

      console.log('create_store_for_user data:', data)
      console.log('create_store_for_user error:', rpcError)

      if (rpcError) {
        // Map known error cases to user-friendly messages
        const msg = rpcError.message ?? ''

        if (msg.includes('NOT_AUTHENTICATED')) {
          setError('You must be logged in to create a store.')
        } else if (msg.includes('VALIDATION_ERROR')) {
          setError('There was a problem with the store details. Please check the name and try again.')
        } else if (msg.includes('NEEDS_OWNER_INVITE')) {
          setError('You must be invited by the store owner before you can create or join this store.')
        } else {
          setError('We could not create your store due to an unexpected error. Please try again or contact support.')
        }

        if (import.meta.env.DEV) {
          console.error('create_store_for_user RPC failed:', rpcError)
        }

        setLoading(false)
        return
      }

      // 3. Use store ID returned by RPC, then verify via store_memberships
      const newStoreId = data as string | null

      if (newStoreId) {
        // Create business_settings record with the store name as company name
        const { error: settingsError } = await supabase
          .from('business_settings')
          .insert({
            store_id: newStoreId,
            company_name: trimmedName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
            tax_rate: 0,
            currency: 'USD',
          })

        if (settingsError) {
          console.error('Failed to create business settings:', settingsError)
          setError('Your store was created, but we couldn\'t save the business settings. You can update them in Settings later.')
        }

        // Seed default payment method (Cash only)
        const { error: paymentError } = await supabase
          .from('payment_method_config')
          .insert({
            store_id: newStoreId,
            method_name: 'Cash',
            is_enabled: true,
            display_order: 0,
          })

        if (paymentError) {
          console.error('Failed to seed payment method:', paymentError)
        }

        setActiveStoreId(newStoreId)
        try { localStorage.setItem('salonId', newStoreId) } catch { /* ignore */ }
        await refreshMemberships()
        navigate('/dashboard', { replace: true })
        return
      }

      // Fallback: query store_memberships if RPC didn't return an ID
      const { data: memberships, error: membershipError } = await supabase
        .from('store_memberships')
        .select('store_id')
        .eq('user_id', user.id)

      if (membershipError) {
        console.error('Failed to query store_memberships:', membershipError)
        setError('Your store was created, but we couldn\'t verify your membership due to a temporary error. Please refresh the page or contact support if this continues.')
        setLoading(false)
        return
      }

      const stores = memberships ?? []

      if (stores.length === 0) {
        setError('Store was created but membership was not found. Please refresh the page or contact support.')
        setLoading(false)
        return
      }

      // Set active store and redirect to dashboard
      setActiveStoreId(stores[0].store_id)
      try { localStorage.setItem('salonId', stores[0].store_id) } catch { /* ignore */ }

      await refreshMemberships()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Unexpected error during store creation:', err)
      setError('An unexpected error occurred. Please check the console and try again.')
      setLoading(false)
    }
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
              <span className="text-5xl">🏪</span>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">Almost There</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Create Your Store</h1>
              <p className="mt-2 text-sm text-slate-200">
                Give your grooming business a name to get started.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🏠</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                  Store Name *
                </span>
                <input
                  type="text"
                  placeholder="e.g. Happy Paws Grooming"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🙍</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                  First Name *
                </span>
                <input
                  type="text"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">🙍</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                  Last Name *
                </span>
                <input
                  type="text"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">✉️</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                  Email *
                </span>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
                />
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-4 text-lg font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Creating…' : 'Create Store'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
