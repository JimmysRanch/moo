import fs from 'fs'
import path from 'path'
import { chromium, type FullConfig } from '@playwright/test'

/**
 * Playwright global setup — runs once before all tests.
 *
 * Logs in with the E2E test user and persists the browser storage state
 * (cookies + localStorage) so every subsequent test starts authenticated
 * without repeating the login flow (avoids Supabase rate-limits).
 */
async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD environment variables are required. ' +
        'See docs/TESTING.md for details.'
    )
  }

  const baseURL =
    config.projects[0]?.use?.baseURL || 'http://127.0.0.1:5173'

  const AUTH_STATE_PATH = 'e2e/.auth/state.json'

  // Ensure the auth directory exists (it is gitignored so it won't exist on a fresh checkout)
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    console.log(`[global-setup] Navigating to ${baseURL}/login`)
    await page.goto(`${baseURL}/login`)

    // Confirm the login form is actually present before filling credentials
    await page.getByTestId('login-email').waitFor({ state: 'visible', timeout: 15_000 })

    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill(password)
    await page.getByTestId('login-submit').click()

    // Wait until the app finishes auth and lands on dashboard or onboarding
    await page.waitForURL(
      (url) => {
        const path = url.pathname
        return path.startsWith('/dashboard') || path.startsWith('/onboarding')
      },
      { timeout: 30_000 },
    )

    const currentPath = new URL(page.url()).pathname
    if (currentPath.startsWith('/onboarding')) {
      throw new Error(
        'E2E test user landed on onboarding — the test user does not have a store membership yet. ' +
          'Run the seed script to provision the user:\n' +
          '  SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> E2E_EMAIL=<email> E2E_PASSWORD=<pass> npx tsx scripts/seed-e2e-user.ts\n' +
          'See docs/TESTING.md for full details.'
      )
    }

    console.log(`[global-setup] Logged in successfully, current URL: ${page.url()}`)

    // Give the store context a moment to persist the activeStoreId
    await page.waitForFunction(
      () => localStorage.getItem('activeStoreId') !== null,
      null,
      { timeout: 10_000 },
    )

    // Persist storage state (cookies + localStorage) for all tests
    await context.storageState({ path: AUTH_STATE_PATH })
    console.log(`[global-setup] Auth state saved to ${AUTH_STATE_PATH}`)
  } catch (err) {
    // Capture a screenshot and the current URL to help diagnose the failure
    const screenshotPath = 'test-results/global-setup-failure.png'
    fs.mkdirSync('test-results', { recursive: true })
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.error(`[global-setup] FAILED — screenshot saved to ${screenshotPath}`)
      console.error(`[global-setup] Current URL at failure: ${page.url()}`)
      console.error(`[global-setup] Page title: ${await page.title()}`)
    } catch {
      // Screenshot may fail if the browser already closed
    }
    throw err
  } finally {
    await browser.close()
  }
}

export default globalSetup
