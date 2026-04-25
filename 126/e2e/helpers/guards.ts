import { Page, expect } from '@playwright/test'

/**
 * Attaches console-error and network-failure listeners to the page.
 * Call `assertNoFailures()` at the end of each test to fail on:
 *  - console errors / page errors
 *  - API responses >= 400 (to your backend / Supabase)
 */
export function attachGuards(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const networkFailures: string[] = []

  // Known harmless endpoints that may return 4xx without being bugs
  const allowlist = [
    '/auth/v1/token', // Supabase may 400 on expired refresh
    'favicon.ico',
    'analytics',
    'speed-insights',
    '/_spark/', // Vercel SpeedInsights page-load beacon; not served by vite preview
    '/rest/v1/rpc/', // Some RPC calls may legitimately 404
    // The Express backend (/api/*) is not available when running against
    // `vite preview` in CI.  The app handles these failures gracefully
    // (showing error/empty states) so we don't want them to break navigation tests.
    '/api/',
  ]

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore React-internal warnings and known noisy logs
      if (
        text.includes('Failed to load resource') ||
        text.includes('net::ERR_') ||
        text.includes('Download the React DevTools')
      ) {
        return
      }
      // Ignore transient network errors the app handles gracefully
      // (e.g. store membership re-fetches failing due to flaky CI connectivity).
      // The StoreContext uses isTransientStoreLoadError() to preserve the
      // persisted activeStoreId on these errors instead of redirecting.
      if (
        text.includes('Error loading store memberships') ||
        text.includes('Error loading staff')
      ) {
        return
      }
      consoleErrors.push(text)
    }
  })

  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
  })

  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()
    if (status >= 400) {
      const isAllowlisted = allowlist.some((pattern) => url.includes(pattern))
      if (!isAllowlisted) {
        networkFailures.push(`${status} ${response.request().method()} ${url}`)
      }
    }
  })

  return {
    consoleErrors,
    pageErrors,
    networkFailures,
    assertNoFailures() {
      expect(pageErrors, 'Unexpected page errors').toEqual([])
      expect(consoleErrors, 'Unexpected console errors').toEqual([])
      expect(networkFailures, 'Unexpected network failures (4xx/5xx)').toEqual([])
    },
  }
}

/**
 * Asserts that a toast notification matching the pattern appears.
 */
export async function expectToast(page: Page, pattern: RegExp) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: pattern })
  await expect(toast.first()).toBeVisible({ timeout: 10_000 })
}
