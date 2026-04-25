import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

/**
 * Initialize Sentry for production error monitoring.
 * Only unexpected runtime errors are captured — expected business errors
 * (auth expiry, RLS denials, validation failures) are filtered out.
 *
 * Sentry is only initialized when VITE_SENTRY_DSN is set. It is active in
 * all environments where the DSN is present (production, staging, etc.).
 */
export function initSentry() {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Sample 100 % of errors, 10 % of traces (adjust per traffic)
    sampleRate: 1.0,
    tracesSampleRate: 0.1,

    beforeSend(event) {
      // Strip PII from user data
      if (event.user) {
        delete event.user.ip_address
        delete event.user.email
      }

      // Filter out expected business errors that should NOT pollute Sentry.
      // We check both the error message and the Postgres/Supabase error code
      // to reduce false-positive filtering of unrelated errors.
      const message = event.exception?.values?.[0]?.value?.toLowerCase() ?? ''
      const errorType = event.exception?.values?.[0]?.type?.toLowerCase() ?? ''

      const expectedPatterns = [
        'jwt expired',
        'invalid session',
        'session_not_found',
        'permission denied',
        'row-level security',
        'access denied',
        'not authenticated',
      ]

      // Postgres / Supabase error codes that are expected business errors
      const expectedCodes = [
        '42501',   // RLS permission denied
        '23505',   // unique_violation
        '23503',   // foreign_key_violation
        '23502',   // not_null_violation
        '22p02',   // invalid_text_representation
      ]

      if (expectedPatterns.some((p) => message.includes(p))) {
        return null
      }

      // Check if the error type or message contains a known Postgres code
      const combined = `${errorType} ${message}`
      if (expectedCodes.some((c) => combined.includes(c))) {
        return null
      }

      return event
    },
  })
}

/**
 * Set user/store context on Sentry so errors are tagged.
 */
export function setSentryContext(ctx: {
  userId?: string | null
  storeId?: string | null
  route?: string
}) {
  if (!SENTRY_DSN) return

  if (ctx.userId) {
    Sentry.setUser({ id: ctx.userId })
  } else {
    Sentry.setUser(null)
  }

  if (ctx.storeId) {
    Sentry.setTag('store_id', ctx.storeId)
  }

  if (ctx.route) {
    Sentry.setTag('route', ctx.route)
  }
}

export { Sentry }
