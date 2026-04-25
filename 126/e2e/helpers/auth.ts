import { Page, expect } from '@playwright/test'

/**
 * Logs in using the E2E test user credentials.
 * Requires E2E_EMAIL and E2E_PASSWORD environment variables.
 */
export async function login(page: Page) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD environment variables are required. ' +
        'See docs/TESTING.md for details.'
    )
  }

  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()

  // Wait for navigation away from login — either dashboard or onboarding
  await page.waitForURL((url) => {
    const path = url.pathname
    return path.startsWith('/dashboard') || path.startsWith('/onboarding')
  }, { timeout: 30_000 })

  // If we landed in onboarding, the E2E user doesn't have a store.
  // For now, we require the E2E user to already be set up with a store.
  const currentPath = new URL(page.url()).pathname
  if (currentPath.startsWith('/onboarding')) {
    throw new Error(
      'E2E test user landed on onboarding — please ensure the test user already has a store membership. ' +
        'See docs/TESTING.md for details.'
    )
  }

  await expect(page).toHaveURL(/\/dashboard/)
}
