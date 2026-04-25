import { test } from '@playwright/test'
import { attachGuards } from './helpers/guards'
import { actionRegistry } from './actions/registry'

test.describe('Action Map — click everything meaningful', () => {
  for (const action of actionRegistry) {
    test(`Action: ${action.name}`, async ({ page }) => {
      const guards = attachGuards(page)
      await action.run(page)
      guards.assertNoFailures()
    })
  }
})
