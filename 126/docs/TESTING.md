# Testing

Two layers of tests live in the repo:

- **Vitest** unit / component tests in `src/test/` (109 files today)
- **Playwright** E2E tests in `e2e/`

## Vitest

- Config: `vitest.config.ts` (jsdom environment, setup file `src/test/setup.ts`,
  excludes `node_modules`, `dist`, `e2e`)
- Commands:

  ```bash
  npm test              # vitest run
  npm run test:watch    # vitest in watch mode
  ```

- The suite covers data mappers, query hooks, UI behavior, payroll logic,
  inventory costing, messaging helpers, appointment/finance flows, regression
  tests, and more. See `src/test/` for the full list.

## Playwright

- Config: `playwright.config.ts`
  - `testDir: './e2e'`, `workers: 1`, `fullyParallel: false`
  - `baseURL` defaults to `http://127.0.0.1:5173` (override via `E2E_BASE_URL`)
  - Global setup: `e2e/global-setup.ts` logs in once and saves storage state to
    `e2e/.auth/state.json` (gitignored)
  - Trace / video / screenshot are retained only on failure
- Layout:
  - `e2e/smoke.routes.spec.ts` — route smoke tests
  - `e2e/actions.spec.ts` and `e2e/actions/` — action-map tests
  - `e2e/journeys.spec.ts` — longer user journeys
  - `e2e/helpers/` — auth, guards, utils
- Commands:

  ```bash
  npm run e2e           # playwright test against E2E_BASE_URL
  npm run e2e:ui        # Playwright UI mode
  npm run e2e:ci        # start-server-and-test wrapper: vite preview + playwright
  npm run e2e:report    # open the last HTML report
  ```

### Required environment for E2E

| Variable | Required | Purpose |
|---|---|---|
| `E2E_EMAIL` | Yes | Login account |
| `E2E_PASSWORD` | Yes | |
| `VITE_SUPABASE_URL` | Yes | Baked into the built app |
| `VITE_SUPABASE_ANON_KEY` | Yes | Baked into the built app |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (for seeding) | Needed by `scripts/seed-e2e-user.ts` |
| `E2E_BASE_URL` | No | Defaults to `http://127.0.0.1:5173` |

### Seeding the E2E user

`scripts/seed-e2e-user.ts` is idempotent. It ensures a confirmed Supabase auth
user exists, creates a store, and inserts a `store_memberships` row with role
`owner` plus an active `staff` record so the protected routes (`/settings`,
`/recent-activity`, `/finances`, `/reports`) stay accessible.

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
E2E_EMAIL=<email> \
E2E_PASSWORD=<password> \
npx tsx scripts/seed-e2e-user.ts
```

### Running locally

```bash
# Build the app and run preview on port 5173 (strict)
npm run build
npm run preview:ci &

# In another terminal
E2E_EMAIL=<email> E2E_PASSWORD=<password> npm run e2e
```

Or let `start-server-and-test` handle both:

```bash
npm run build
E2E_EMAIL=<email> E2E_PASSWORD=<password> npm run e2e:ci
```

### CI

`.github/workflows/e2e.yml` runs on pushes to `main` and on manual dispatch. It:

1. Validates that all required secrets are present and fails early otherwise.
2. `npm ci`, installs Playwright Chromium.
3. Builds the app with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Runs `scripts/seed-e2e-user.ts` to ensure the E2E user + store exist.
5. Runs `npm run e2e:ci`.
6. Uploads `playwright-report/` and `test-results/` on every run.

`.github/workflows/ci.yml` runs on push/PR and does:

- `lint-changed` — lints only changed `.ts`/`.tsx` files on PRs
- `lint-baseline` — full repo lint on push, non-blocking
- `test-build` — matrix of Node 18.x and 20.x running `npm test` and
  `npm run build`, uploading `dist/` on Node 20

### Backend-dependent tests and caveats

- `npm run e2e:ci` runs the app through `vite preview`, which **does not** start
  the Express API server. Any page that calls `/api/stripe/...` or
  `/api/staff/...` in that context will receive a 404 from the static preview
  server; the page renders a graceful error and E2E guards allowlist the
  `/api/` 404s. Features that require real Stripe processing cannot be
  validated via this preview-based E2E path.
- The Vitest suite does not start the Express server either; it exercises
  request helpers and data-mapping logic directly.
