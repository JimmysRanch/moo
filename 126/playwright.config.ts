import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Always produce both a machine-readable list and an HTML report so
  // failures are easy to read locally and in CI artifacts.
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  timeout: 90_000,

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    actionTimeout: 10_000,
    storageState: 'e2e/.auth/state.json',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
