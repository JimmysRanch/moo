import { supabase } from './supabase'
import { toast } from 'sonner'
import { logError } from './appLogger'

// ── Postgres error code → friendly message mappings ─────────────────────────

const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'This record already exists',
  '23503': 'This record is in use and cannot be deleted',
  '23502': 'A required field is missing',
  '22P02': 'Invalid value provided',
}

const FALLBACK_MESSAGE = 'Something went wrong'

// ── Auth-error detection patterns ───────────────────────────────────────────

const AUTH_ERROR_PATTERNS = [
  'jwt expired',
  'invalid claim: missing sub claim',
  'invalid jwt',
  'invalid token',
  'token is expired',
  'missing sub claim',
  'session_not_found',
  'invalid session',
  'not authenticated',
  'missing auth',
  'no session found',
  'refresh_token_not_found',
]

// ── Toast-spam deduplication ────────────────────────────────────────────────

const recentToasts = new Map<string, number>()
const TOAST_DEDUP_MS = 3_000
const MAX_RECENT_TOASTS = 200

function deduplicatedToast(message: string, type: 'error' | 'warning' = 'error') {
  const now = Date.now()
  const lastShown = recentToasts.get(message)
  if (lastShown && now - lastShown < TOAST_DEDUP_MS) return
  recentToasts.set(message, now)
  // Ensure the recentToasts map cannot grow without bound
  while (recentToasts.size > MAX_RECENT_TOASTS) {
    const firstKey = recentToasts.keys().next().value as string | undefined
    if (firstKey === undefined) break
    recentToasts.delete(firstKey)
  }
  if (type === 'warning') {
    toast.warning(message)
  } else {
    toast.error(message)
  }
}

// ── Redirect guard ──────────────────────────────────────────────────────────

let isRedirecting = false

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect whether an error is an authentication/session error.
 */
export function isAuthError(error: unknown): boolean {
  const msg = extractMessage(error).toLowerCase()

  // Check for auth-related string patterns
  if (AUTH_ERROR_PATTERNS.some((p) => msg.includes(p))) return true

  // Check HTTP-style status codes embedded in the error
  const status = extractStatus(error)
  if (status === 401) return true

  return false
}

/**
 * Detect whether an error is an RLS / permission-denied error.
 */
export function isRLSError(error: unknown): boolean {
  const code = extractCode(error)
  if (code === '42501') return true

  const status = extractStatus(error)
  if (status === 403) return true

  const msg = extractMessage(error).toLowerCase()
  if (
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('forbidden')
  ) return true

  return false
}

/**
 * Map any Supabase / Postgres error to a user-friendly message.
 * Never leaks SQL or policy details.
 *
 * Accepts any value for `error`. Expected shapes include:
 * - `Error` instances (message extracted via `.message`)
 * - Supabase/Postgres error objects: `{ message: string, code?: string, details?: { code?: string } }`
 * - HTTP-style error objects: `{ message: string, status?: number, statusCode?: number }`
 * - Plain strings (treated as the error message)
 * - `null` / `undefined` / other types (returns fallback message)
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (isAuthError(error)) return 'Your session has expired. Please sign in again.'
  if (isRLSError(error)) return 'Access denied'

  const code = extractCode(error)
  if (code && POSTGRES_ERROR_MESSAGES[code]) return POSTGRES_ERROR_MESSAGES[code]

  return FALLBACK_MESSAGE
}

/**
 * Central handler — call from React Query global callbacks or any Supabase
 * call site.  Handles sign-out / redirect for auth errors, toast for others.
 */
export async function handleSupabaseError(error: unknown): Promise<void> {
  // 1. Auth errors → sign out + redirect to /login
  if (isAuthError(error)) {
    if (isRedirecting) return
    isRedirecting = true
    try {
      await supabase.auth.signOut()
    } catch {
      // Best-effort sign out
    }
    // Redirect (replace to avoid back-button loops)
    if (window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
    return
  }

  // 2. RLS / permission errors → friendly "Access denied" toast
  if (isRLSError(error)) {
    deduplicatedToast('Access denied', 'warning')
    return
  }

  // 3. All other errors → friendly postgres or fallback message
  const message = getFriendlyErrorMessage(error)
  deduplicatedToast(message)

  // 4. Report unexpected errors to Sentry (if initialised)
  captureSentryError(error)

  // 5. Write to internal app_logs for owner review in Settings > Logs
  logError({
    event_type: 'unhandled_error',
    message,
    details: extractMessage(error) || undefined,
  })
}

// ── Internal helpers ────────────────────────────────────────────────────────

function extractMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.error_description === 'string') return e.error_description
    if (typeof e.msg === 'string') return e.msg
  }
  return ''
}

function extractCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as Record<string, unknown>
  if (typeof e.code === 'string') return e.code
  if (typeof e.details === 'object' && e.details !== null) {
    const d = e.details as Record<string, unknown>
    if (typeof d.code === 'string') return d.code
  }
  return undefined
}

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as Record<string, unknown>
  if (typeof e.status === 'number') return e.status
  if (typeof e.statusCode === 'number') return e.statusCode
  return undefined
}

/**
 * Send unexpected errors to Sentry when it's loaded.
 * Expected business errors (auth, RLS, validation) are NOT sent.
 */
function captureSentryError(error: unknown) {
  try {
    import('./sentry').then(({ Sentry }) => {
      Sentry.captureException(error instanceof Error ? error : new Error(extractMessage(error)))
    }).catch(() => {
      // Sentry module not available — silently ignore
    })
  } catch {
    // Sentry not available — silently ignore
  }
}
