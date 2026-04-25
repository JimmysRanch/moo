# Architecture

This is a single-repo, single-tenant-per-store grooming SaaS. The app runs as a
Vite SPA plus two backend surfaces: Vercel serverless routes in `api/` and a
Node/Express server in `server/`.

Everything below is grounded in the current `package.json`, `src/App.tsx`,
`api/`, `server/`, `supabase/`, and `vercel.json`. When something is partial or
unwired, it is marked.

## Frontend (`src/`)

- Entry: `src/main.tsx` → `src/App.tsx`
- Routing: `react-router-dom` v7 inside a single `createBrowserRouter` with
  `<AppLayout />`. All app pages live under `<RequireAuth>` and a store-membership
  guard; auth-only pages (staff onboarding) use `<RequireAuthOnly>`.
- Auth + tenant context: `AuthContext` (`src/contexts/AuthContext.tsx`) and
  `StoreContext` (`src/contexts/StoreContext.tsx`), wrapped in `QueryClientProvider`.
- Data hooks: `src/hooks/data/` — TanStack Query hooks for clients, appointments,
  staff, services, inventory, transactions, payments, payroll, business
  settings, messages, pet photos, recent activity.
- Spark template artifacts: `src/main.tsx` imports `@github/spark/spark`; the
  `useKV` hook (`src/lib/spark-hooks.ts`) is an **in-memory stub** that keeps the
  old API working but no longer persists. Do not treat `useKV` as storage.
- Observability: `src/lib/sentry.ts` initializes Sentry if `VITE_SENTRY_DSN` is
  set; `src/lib/appLogger.ts` writes to the `app_logs` Supabase table.

### Routes (from `src/App.tsx`)

Public / auth:
- `/login`, `/create-account`, `/forgot-password`, `/reset-password`
- `/auth/callback`, `/auth/check-email`
- `/payments/success`, `/payments/cancel` (Stripe checkout redirects — no auth required)
- `/dev/login` (preview-mode login)

Store bootstrapping (authenticated, store not yet selected):
- `/onboarding/create-store`, `/dev/onboarding/create-store`
- `/onboarding/staff`, `/onboarding/staff/profile`
- `/dev/staff-onboarding`, `/dev/staff-profile-setup`

App (authenticated + store membership required):
- `/dashboard`
- `/appointments`, `/appointments/new`, `/appointments/:appointmentId/edit`
- `/messages`
- `/clients`, `/clients/new`, `/clients/:clientId`, `/clients/:clientId/edit`,
  `/clients/:clientId/add-pet`, `/clients/:clientId/pets/:petId/edit`,
  `/clients/:clientId/payment-history`, `/clients/:clientId/contact`
- `/staff`, `/staff/new`, `/staff/invite`, `/staff/:staffId`,
  `/staff/:staffId/edit`, `/staff/:staffId/schedule/edit`,
  `/staff/:staffId/payroll-breakdown`
- `/pos`, `/inventory`, `/inventory/history`, `/receipts/:receiptId`
- `/finances`, `/finances/expenses`, `/finances/all-expenses`,
  `/finances/add-expense`, `/finances/upcoming-bills`, `/finances/file-taxes`,
  `/finances/run-payroll`, `/finances/staff/:staffId/payroll-breakdown`
- `/reports/*`, `/recent-activity`, `/settings`, `/stripe/onboarding`

The home route (`/`) redirects to `/dashboard` when logged in, otherwise to
`/login`.

## Backend surfaces

### 1. Vercel serverless (`api/`)

Deployed as Vercel functions (`vercel.json` sets `maxDuration: 60` for
`api/**/*.ts` and rewrites `/api/:path*` to itself; everything else falls back
to `index.html` for SPA routing).

| Route | File | Purpose |
|---|---|---|
| `GET /api/health` | `api/health/index.ts` | Health check |
| `POST /api/onboarding/create-store` | `api/onboarding/create-store.ts` | Atomic first-store provisioning |
| `POST /api/staff/accept-invite` | `api/staff/accept-invite.ts` | Staff invite acceptance |
| `POST /api/staff/invite/...` | `api/staff/invite/*.ts` | Staff invite lookup/management |
| `POST /api/stripe/connect` | `api/stripe/connect.ts` | Connect onboarding + status, payouts, disputes |
| `POST /api/stripe/terminal` | `api/stripe/terminal.ts` | Connection tokens, PaymentIntents, locations, reader registration |
| `POST /api/stripe/payments` | `api/stripe/payments.ts` | Manual card intents, captures, refunds, Checkout links, `finalize_sale` |
| `POST /api/stripe/settings` | `api/stripe/settings.ts` | POS + card settings |
| `POST /api/stripe/billing` | `api/stripe/billing.ts` | **Platform** SaaS subscription (separate from connected-account POS) |
| `GET /api/stripe/checkout` | `api/stripe/checkout.ts` | Public resolution of Checkout Session for success redirect |
| `POST /api/stripe/webhook` | `api/stripe/webhook.ts` | Stripe event ingestion (signature-verified, idempotent via `webhook_events`) |

All Stripe handlers resolve the caller's tenant via
`authenticated user → store_memberships → stripe_connections → stripe_account_id`
using helpers in `api/stripe/_lib.ts`. Fulfillment is centralized in
`api/stripe/_fulfillment.ts`.

### 2. Express API (`server/`)

Started by `tsx watch server/index.ts` on port 4242 (configurable via `PORT`).
Mounted routers:

| Mount | File | Endpoints include |
|---|---|---|
| `GET /health` | `server/index.ts` | Health check |
| `/api/onboarding` | `server/routes/onboarding.ts` | `POST /provision-owner` (RPC-backed) |
| `/api/staff` | `server/routes/staffInvite.ts` | Staff invite send/accept/lookup |

CORS origin is `APP_BASE_URL` (defaults to `http://localhost:5173`). Supabase
service-role admin client lives in `server/supabaseAdmin.ts`. Twilio client

> The **Vercel** and **Express** backends overlap on onboarding and staff
> invite. In production on Vercel the serverless routes in `api/` are used; the
> Express server is used in local development and when deploying the Node
> backend separately. Be aware of the duplication before editing either side.

## Supabase

- Client: `src/lib/supabase.ts` (uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- Admin client on the backend: `server/supabaseAdmin.ts` and
  `api/stripe/_lib.ts` (uses `SUPABASE_SERVICE_ROLE_KEY`)
- Migrations: `supabase/migrations/001_…` through `050_stripe_dispute_audit.sql`
  (~59 files). Core tables: `stores`, `store_memberships`, `staff`,
  `staff_invites`, `clients`, `pets`, `appointments`, `services`, `add_ons`,
  `transactions`, `transaction_items`, `payment_intents`, `refunds`,
  `stripe_connections`, `stripe_checkout_sessions`, `webhook_events`,
  `terminal_locations`, `terminal_devices`, `payment_settings`,
  `business_settings`, `inventory_items`, `inventory_ledger`, `audit_log`,
  `app_logs`, `platform_admins`, `platform_subscriptions`, `messages`,
  `message_conversations`, `message_provider_profiles`, `message_sender_inventory`, …
- Access control: RLS using helpers like `is_store_member()` and
  `is_store_owner()`; the `platform_admins` table gates app-wide admin views
  (Settings → Logs).
- Edge function: `supabase/functions/reconcile-payments/index.ts` — compares
  Stripe PaymentIntents against the local `payment_intents` table. Scheduled
  separately; run manually as needed.

## Stripe

Two separate Stripe flows coexist:

1. **Connected-account POS/checkout** — each store onboards its own Stripe
   Connect account. POS uses Terminal, manual card entry, or Stripe Checkout
   Sessions; refunds and webhook-driven status updates flow through
   `api/stripe/webhook.ts` and persist to `payment_intents`, `transactions`,
   `refunds`, and appointment pickup state.
2. **Platform SaaS subscription** — `api/stripe/billing.ts` drives the
   salon-owner subscription via Stripe Checkout + the customer billing portal,
   gated by `STRIPE_PLATFORM_PRICE_ID_MONTHLY`. Stored in
   `platform_subscriptions`.

## Messaging (Twilio)

- All Twilio usage is server-side in `supabase/functions/twilio-messages/index.ts`.
- Runtime endpoint is `/functions/v1/twilio-messages` (with webhook subpaths `/webhooks/inbound` and `/webhooks/status`).
- Webhook URLs are computed from `TWILIO_WEBHOOK_BASE_URL` or `SUPABASE_FUNCTIONS_BASE_URL`.
- Frontend uses Supabase-backed hooks in `src/hooks/data/useMessages.ts` and
  the `/messages` page — there is **no direct Twilio call from the browser**.
- Per-store provider config is in `message_provider_profiles` + `message_sender_inventory` (migration
  `043_twilio_messaging_provider.sql`).

## Build & deploy

- `npm run build` runs the frontend TS project references (`tsc -b --noCheck`),
  the backend typecheck (`tsconfig.backend.json`), and `vite build`. Output goes
  to `dist/`.
- Vercel serves `dist/` statically and runs `api/**/*.ts` as serverless
  functions (see `vercel.json`).
- The Express server (`server/dist/index.js` after a separate compile via
  `tsc -p tsconfig.backend.json`) is **not** what Vercel runs. If you need the
  Express routes in production, they must be deployed separately (e.g. as a
  long-running Node service) and pointed at by `API_BASE_URL` /
  `VITE_API_BASE_URL`.

## Testing

See [`TESTING.md`](TESTING.md).
