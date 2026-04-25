import { Page } from '@playwright/test'
import { uniqueName } from '../helpers/utils'
import { expectToast } from '../helpers/guards'

export type Action = {
  name: string
  route: string
  run: (page: Page) => Promise<void>
}

export const actionRegistry: Action[] = [
  // ── Clients ──────────────────────────────────────────────
  {
    name: 'Create client',
    route: '/clients/new',
    run: async (page) => {
      await page.goto('/clients/new')
      const name = uniqueName('Client')
      const [first, ...rest] = name.split(' ')
      await page.getByTestId('client-first-name').fill(first)
      await page.getByTestId('client-last-name').fill(rest.join(' '))
      await page.getByTestId('client-phone').fill('555-000-1234')
      await page.getByTestId('client-save').click()
      await expectToast(page, /saved|created|added|success/i)
    },
  },
  // ── Appointments ─────────────────────────────────────────
  {
    name: 'Navigate to new appointment',
    route: '/appointments',
    run: async (page) => {
      await page.goto('/appointments')
      await page.getByTestId('appointments-new').click()
      await page.waitForURL(/\/appointments\/new/)
    },
  },
  // ── Inventory ────────────────────────────────────────────
  {
    name: 'Open create inventory dialog',
    route: '/inventory',
    run: async (page) => {
      await page.goto('/inventory')
      await page.getByTestId('inventory-new').click()
      // The dialog/form should appear
      await page.getByTestId('inventory-save').waitFor({ state: 'visible', timeout: 5_000 })
    },
  },
  // ── Staff ────────────────────────────────────────────────
  {
    name: 'Navigate to create staff',
    route: '/staff',
    run: async (page) => {
      await page.goto('/staff')
      await page.getByTestId('staff-new').click()
      await page.waitForURL(/\/staff\/new/)
    },
  },
  // ── Finances ─────────────────────────────────────────────
  {
    name: 'Navigate to add expense',
    route: '/finances',
    run: async (page) => {
      await page.goto('/finances')
      await page.getByTestId('finances-add-expense').click()
      await page.waitForURL(/\/finances\/add-expense/)
    },
  },
  {
    name: 'Navigate to record payment',
    route: '/finances',
    run: async (page) => {
      await page.goto('/finances')
      await page.getByTestId('finances-record-payment').click()
      await page.waitForURL(/\/finances\/record-payment/)
    },
  },
  // ── Settings ─────────────────────────────────────────────
  {
    name: 'Load settings page',
    route: '/settings',
    run: async (page) => {
      await page.goto('/settings')
      await page.getByTestId('page-settings').waitFor({ state: 'visible', timeout: 10_000 })
    },
  },
]
