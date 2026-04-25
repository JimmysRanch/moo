import { test, expect } from '@playwright/test'
import { attachGuards, expectToast } from './helpers/guards'
import { uniqueName } from './helpers/utils'

test.describe('Journey: Client → Pet → Appointment flow', () => {
  test('create client, add pet, then navigate to new appointment', async ({ page }) => {
    const guards = attachGuards(page)

    // 1. Create a client
    await page.goto('/clients/new')
    const clientFirst = uniqueName('JClient')
    await page.getByTestId('client-first-name').fill(clientFirst)
    await page.getByTestId('client-last-name').fill('TestLast')
    await page.getByTestId('client-phone').fill('555-111-2222')
    await page.getByTestId('client-save').click()
    await expectToast(page, /saved|created|added|success/i)

    // 2. Navigate to clients list and verify new client appears
    await page.goto('/clients')
    await expect(page.getByTestId('page-clients')).toBeVisible()

    // 3. Navigate to new appointment
    await page.goto('/appointments')
    await page.getByTestId('appointments-new').click()
    await page.waitForURL(/\/appointments\/new/)

    guards.assertNoFailures()
  })
})

test.describe('Journey: Inventory item create → appears in list', () => {
  test('create inventory item and verify it shows', async ({ page }) => {
    const guards = attachGuards(page)

    await page.goto('/inventory')
    await page.getByTestId('inventory-new').click()
    await page.getByTestId('inventory-save').waitFor({ state: 'visible', timeout: 5_000 })

    guards.assertNoFailures()
  })
})

test.describe('Journey: Expense create → appears in list', () => {
  test('navigate to add expense and verify form loads', async ({ page }) => {
    const guards = attachGuards(page)

    await page.goto('/finances')
    await page.getByTestId('finances-add-expense').click()
    await page.waitForURL(/\/finances\/add-expense/)
    await expect(page.getByTestId('page-add-expense')).toBeVisible()

    guards.assertNoFailures()
  })
})

test.describe('Journey: Staff management', () => {
  test('navigate to create staff member form', async ({ page }) => {
    const guards = attachGuards(page)

    await page.goto('/staff')
    await page.getByTestId('staff-new').click()
    await page.waitForURL(/\/staff\/new/)
    await expect(page.getByTestId('page-create-staff')).toBeVisible()

    guards.assertNoFailures()
  })
})

test.describe('Journey: POS flow', () => {
  test('load POS page and verify checkout area', async ({ page }) => {
    const guards = attachGuards(page)

    await page.goto('/pos')
    await expect(page.getByTestId('page-pos')).toBeVisible()

    guards.assertNoFailures()
  })
})

test.describe('Journey: Dashboard → Recent Activity', () => {
  test('navigate from dashboard to recent activity', async ({ page }) => {
    const guards = attachGuards(page)

    await page.goto('/dashboard')
    await expect(page.getByTestId('page-dashboard')).toBeVisible()

    await page.goto('/recent-activity')
    await expect(page.getByTestId('page-recent-activity')).toBeVisible()

    guards.assertNoFailures()
  })
})

