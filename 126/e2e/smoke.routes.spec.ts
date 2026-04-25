import { test, expect } from '@playwright/test'
import { attachGuards } from './helpers/guards'

const ROUTE_RENDER_TIMEOUT_MS = 30_000

/** Escapes special regex metacharacters so a path can be used in a RegExp. */
function escapeRegexPattern(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ROUTES: { path: string; expectedTestId: string }[] = [
  { path: '/dashboard', expectedTestId: 'page-dashboard' },
  { path: '/clients', expectedTestId: 'page-clients' },
  { path: '/appointments', expectedTestId: 'page-appointments' },
  { path: '/staff', expectedTestId: 'page-staff' },
  { path: '/inventory', expectedTestId: 'page-inventory' },
  { path: '/inventory/history', expectedTestId: 'page-inventory-history' },
  { path: '/pos', expectedTestId: 'page-pos' },
  { path: '/finances', expectedTestId: 'page-finances' },
  { path: '/reports', expectedTestId: 'reports-landing' },
  { path: '/settings', expectedTestId: 'page-settings' },
  { path: '/recent-activity', expectedTestId: 'page-recent-activity' },
]

test.describe('Smoke Route Crawl', () => {
  for (const route of ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      const guards = attachGuards(page)
      await page.goto(route.path)
      // Verify the app stayed on (or navigated back to) the expected URL.
      // A redirect to /onboarding or /login would fail here with a clear message.
      await expect(page).toHaveURL(
        new RegExp(escapeRegexPattern(route.path) + '($|[/?#])'),
        { timeout: ROUTE_RENDER_TIMEOUT_MS },
      )
      await expect(page.getByTestId(route.expectedTestId)).toBeVisible({ timeout: ROUTE_RENDER_TIMEOUT_MS })
      guards.assertNoFailures()
    })
  }
})
