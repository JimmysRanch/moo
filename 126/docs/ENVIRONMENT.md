# Environment variables

This list is taken from the actual code — every variable below is read somewhere in
`src/`, `server/`, `api/`, `scripts/`, or `.github/workflows/`. Anything not here
is not used by the app today.

## Frontend (`VITE_*`, read via `import.meta.env`)

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | `src/lib/supabase.ts` | Supabase project URL. Also baked into the build for Vercel. |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | `src/lib/supabase.ts` | Supabase anon key. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes for card UI | `src/stripe/*` | Needed to render any Stripe.js / Connect / Terminal UI. Without it card flows will fail. |
| `VITE_SENTRY_DSN` | No | `src/lib/sentry.ts` | Enables Sentry in the browser when set. |
| `VITE_API_BASE_URL` | No | frontend API client | Overrides the default `/api` base URL (used when the Express backend is on a different origin). |
| `VITE_APP_OWNER_USER_ID` | No (legacy) | `src/pages/Settings.tsx`, `src/components/LogsSettingsTab.tsx` | Legacy fallback for Settings → Logs visibility. Prefer the `platform_admins` table. |

## Backend (`process.env`) — used by Express (`server/`) and Vercel functions (`api/`)

### Supabase

| Variable | Required | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | `api/stripe/_lib.ts` (serverless), `server/supabaseAdmin.ts` (via `SUPABASE_URL` fallback) |
| `SUPABASE_URL` | **Yes** (Express + seed script) | `server/supabaseAdmin.ts`, `scripts/seed-e2e-user.ts`. The Vercel `api/` side reads `VITE_SUPABASE_URL` instead. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Any privileged server call (admin client in `server/`, `api/stripe/_lib.ts`, `scripts/seed-e2e-user.ts`) |
| `VITE_SUPABASE_ANON_KEY` | **Yes** in CI | Used by the E2E workflow for the build step |

### Stripe

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | **Yes** | `api/stripe/_lib.ts` | Server-side Stripe client. |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | `api/stripe/webhook.ts` | Signature verification. |
| `STRIPE_PLATFORM_PRICE_ID_MONTHLY` | Only if platform SaaS billing is on | `api/stripe/billing.ts` | Price ID for the app-owner subscription (separate from connected-account POS). |
| `STRIPE_BILLING_PORTAL_RETURN_URL` | No | `api/stripe/billing.ts` | Falls back to `APP_BASE_URL`. |

### App + API base URLs

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `APP_BASE_URL` | **Yes** in prod | `server/index.ts` (CORS), `api/stripe/billing.ts`, invite email links, Stripe success/cancel redirects | Defaults to `http://localhost:5173` for local dev. Vercel falls back to `VERCEL_URL` automatically in some paths. |
| `PORT` | No | `server/index.ts` | Express port, default `4242`. |

### Twilio (SMS messaging)

| Variable | Required | Used by |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes if messaging is used | `supabase/functions/twilio-messages/index.ts` |
| `TWILIO_AUTH_TOKEN` | Yes if messaging is used | `supabase/functions/twilio-messages/index.ts`, webhook signature validation in `supabase/functions/twilio-messages/shared.ts` |
| `TWILIO_WEBHOOK_BASE_URL` | Yes if Twilio is configured | `supabase/functions/twilio-messages/index.ts` — public base URL that Twilio will POST inbound/status webhooks to |
| `SUPABASE_FUNCTIONS_BASE_URL` | Optional fallback | `supabase/functions/twilio-messages/index.ts` fallback base for `/functions/v1` webhook URLs when `TWILIO_WEBHOOK_BASE_URL` is not set |

### E2E test environment (consumed by Playwright + `scripts/seed-e2e-user.ts`)

| Variable | Required | Notes |
|---|---|---|
| `E2E_EMAIL` | **Yes** | Account the test suite logs in as |
| `E2E_PASSWORD` | **Yes** | |
| `E2E_BASE_URL` | No | Defaults to `http://127.0.0.1:5173` |
| `E2E_USER_NAME` | No | Used by `seed-e2e-user.ts` |
| `E2E_STORE_NAME` | No | Used by `seed-e2e-user.ts` |

## `.env.example` completeness

`.env.example` covers the minimum for local development: Stripe keys,
`APP_BASE_URL`, Supabase URL + anon + service-role keys, and the legacy
`VITE_APP_OWNER_USER_ID`. It is **missing** these variables that the code
actually reads, and you must add them locally if you exercise those paths:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_BASE_URL` — SMS
- `SUPABASE_FUNCTIONS_BASE_URL` — optional Twilio webhook base fallback
- `VITE_SENTRY_DSN` — Sentry (optional)
- `VITE_API_BASE_URL` — only if the Express API is on a different origin
- `E2E_EMAIL`, `E2E_PASSWORD` — only for running E2E tests

See `docs/KNOWN-RISKS.md` for the full list of gaps.
