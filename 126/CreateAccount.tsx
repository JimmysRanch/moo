import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { setActiveStoreId } from '@/lib/activeStore'
import { formatPhoneNumber, validatePhoneNumber } from '@/utils/phone'

// PostgreSQL error codes
const POSTGRES_UNIQUE_VIOLATION = '23505'

type Bubble = {
  id: number
  size: number
  opacity: number
  top: string
  left: string
}

type SignupStep = 'form' | 'verify'

export function CreateAccount() {
  const navigate = useNavigate()
  const [step, setStep] = useState<SignupStep>('form')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [storeName, setStoreName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const bubbles: Bubble[] = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        size: 22 + index * 6,
        opacity: 0.15 + index * 0.01,
        top: `${8 + (index * 6) % 75}%`,
        left: `${(index * 11) % 92}%`,
      })),
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    if (loading) return

    const first = firstName.trim()
    const last = lastName.trim()
    const mail = email.trim()
    const store = storeName.trim()
    const phoneInput = phone.trim()

    if (!first) return setError('First name is required.')
    if (!last) return setError('Last name is required.')
    if (!phoneInput) return setError('Phone number is required.')
    if (!validatePhoneNumber(phoneInput)) {
      return setError('Please enter a valid 10-digit US phone number.')
    }
    if (!mail) return setError('Email is required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setError('Please enter a valid email.')
    if (!store) return setError('Store name is required.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phoneInput)
      
      // Sign up with phone as primary identifier
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: {
          data: {
            first_name: first,
            last_name: last,
            email: mail,
            pending_store_name: store,
          },
        },
      })
      
      if (signUpError) throw signUpError
      if (!signUpData.user) throw new Error('Signup failed')

      // Move to verification step (same page)
      setStep('verify')
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '') ?? ''
      setError(msg || 'Create account failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    if (loading) return

    if (verificationCode.length !== 6) {
      return setError('Please enter a 6-digit verification code.')
    }

    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)

      // Verify the SMS OTP code
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: verificationCode,
        type: 'sms',
      })

      if (verifyError) throw verifyError
      
      // Get the current user session (email-based signup should have created the user)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Failed to retrieve authenticated user session')

      const userId = user.id
      const metadata = user.user_metadata

      // Create store
      const { data: storeId, error: storeError } = await supabase.rpc('create_store_for_user', {
        p_name: metadata.pending_store_name || storeName.trim(),
      })

      if (storeError) throw storeError
      if (!storeId) throw new Error('Failed to create store')

      // Update profile - the trigger will have created it with data from raw_user_meta_data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          first_name: metadata.first_name,
          last_name: metadata.last_name,
          phone: metadata.phone,
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Failed to update profile:', profileError)
        // Continue anyway as profile trigger may have set basic data
      }

      // Create business settings (with on conflict to handle retries)
      const { error: settingsError } = await supabase.from('business_settings').insert({
        store_id: storeId,
        company_name: metadata.pending_store_name || storeName.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        tax_rate: 0,
        currency: 'USD',
        email: user.email,
      })

      // PostgreSQL error code 23505 = unique_violation (duplicate key)
      if (settingsError && settingsError.code !== POSTGRES_UNIQUE_VIOLATION) {
        console.error('Failed to create business settings:', settingsError)
        // Continue anyway - settings can be configured later
      }

      // Seed default payment method (with on conflict to handle retries)
      const { error: paymentError } = await supabase.from('payment_method_config').insert({
        store_id: storeId,
        method_name: 'Cash',
        is_enabled: true,
        display_order: 0,
      })

      // PostgreSQL error code 23505 = unique_violation (duplicate key)
      if (paymentError && paymentError.code !== POSTGRES_UNIQUE_VIOLATION) {
        console.error('Failed to seed payment method:', paymentError)
        // Continue anyway - payment methods can be configured later
      }

      // Set active store and redirect to dashboard
      setActiveStoreId(storeId)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '') ?? ''
      if (msg.includes('expired')) {
        setError('Verification code has expired. Please request a new code.')
      } else if (msg.includes('invalid')) {
        setError('Invalid verification code. Please try again.')
      } else {
        setError(msg || 'Verification failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)
      
      // Resend SMS OTP by calling signUp again (user hasn't verified yet, so no session exists)
      const { error: resendError } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            pending_store_name: storeName.trim(),
          },
        },
      })

      if (resendError) throw resendError
      setSuccessMessage('Verification code sent successfully!')
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '') ?? ''
      setError(msg || 'Failed to resend code.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePhoneNumber = () => {
    setStep('form')
    setVerificationCode('')
    setError('')
    setSuccessMessage('')
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
              opacity: bubble.opacity,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
          {step === 'form' ? (
            // Signup Form
            <>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/70 shadow-[0_15px_45px_rgba(56,189,248,0.35)]">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-200">Welcome</p>
                  <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Create New Account</h1>
                  <p className="mt-2 text-sm text-slate-200">
                    Set up your profile to start booking appointments, managing clients, and tracking services.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-slate-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">First Name *</span>
                    <input
                      type="text"
                      placeholder="Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Last Name *</span>
                    <input
                      type="text"
                      placeholder="Walker"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Phone Number *</span>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Email Address *</span>
                  <input
                    type="email"
                    placeholder="you@doggrooming.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Store / Business Name *</span>
                  <input
                    type="text"
                    placeholder="Fluffy Paws Grooming"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-slate-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Password *</span>
                    <input
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Confirm Password *</span>
                    <input
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                    />
                  </label>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-4 text-lg font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? 'Sending Code…' : 'Create New Account'}
                </button>
              </form>
            </>
          ) : (
            // Verification Form
            <>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/70 shadow-[0_15px_45px_rgba(56,189,248,0.35)]">
                  <span className="text-2xl">📱</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-200">Verification</p>
                  <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Enter Code</h1>
                  <p className="mt-2 text-sm text-slate-200">
                    We sent a 6-digit code to {phone}
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifyCode} className="mt-10 space-y-6">
                <label className="flex flex-col gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-200 text-center">Verification Code</span>
                  <input
                    type="text"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-center text-2xl tracking-widest font-mono text-white placeholder:text-slate-400 shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-70"
                  />
                </label>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                {successMessage && <p className="text-sm text-green-400 text-center">{successMessage}</p>}

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 px-6 py-4 text-lg font-semibold text-slate-900 shadow-[0_15px_30px_rgba(56,189,248,0.45)] transition hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>

                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={handleChangePhoneNumber}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Change Phone Number
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
