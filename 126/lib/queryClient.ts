import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { handleSupabaseError, isAuthError } from './errorHandling'

type ErrorHandler = (err: unknown) => void

/**
 * React Query error-handling flow (execution order):
 *
 *   1. `queryFn` / `mutationFn` throws
 *   2. `retry` callback evaluates the *original* error
 *      → auth errors return `false` immediately (no retries)
 *   3. After retries exhausted, `QueryCache.onError` / `MutationCache.onError` fires
 *      → auth errors trigger `handleSupabaseError` (sign-out + redirect)
 *      → other errors show a toast via `handleSupabaseError`
 *
 * Because `retry` runs *before* `onError`, the auth-error check in `retry`
 * always sees the original error object — `handleSupabaseError` has NOT yet
 * triggered a redirect when `retry` evaluates. This is the intended order.
 *
 * Per-query `meta.onError` callbacks are supported — if a query provides its
 * own handler via meta, the global handler still runs for auth-redirect safety
 * but the toast is left to the local handler.
 */
const queryCache = new QueryCache({
  onError(error, query) {
    const localHandler = query.meta?.onError as ErrorHandler | undefined
    if (localHandler) {
      localHandler(error)
    }

    // Auth errors (JWT expired, invalid session) → sign out + redirect
    if (isAuthError(error)) {
      handleSupabaseError(error)
      return
    }

    // Other errors → toast via global handler (skip if local handler exists)
    if (!localHandler) {
      handleSupabaseError(error)
    }
  },
})

const mutationCache = new MutationCache({
  onError(error, _variables, _context, mutation) {
    const localHandler = (mutation.options.onError as ErrorHandler | undefined)
      ?? (mutation.meta?.onError as ErrorHandler | undefined)
    if (localHandler) {
      localHandler(error)
    }

    if (isAuthError(error)) {
      handleSupabaseError(error)
      return
    }

    if (!localHandler) {
      handleSupabaseError(error)
    }
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Auth errors: skip retry entirely — onError will handle redirect
        if (isAuthError(error)) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
