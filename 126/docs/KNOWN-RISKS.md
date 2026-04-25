# Known risks

Items below are partial, placeholder, duplicated, or otherwise brittle in the
current codebase. They are not hypothetical — each one is grounded in code in
the repo today. Treat this as the "you can't trust this yet" list.

## Backend architecture

- **Two overlapping backends.** Onboarding and staff-invite logic exists in
  both `api/` (Vercel serverless) and `server/routes/` (Express). Production on
  Vercel uses `api/`; local `npm run dev` uses Express. Behavior can drift.
  Any change to invite / onboarding should be made in both places or one of
  them should be removed.
- **Express server is not deployed by `vercel.json`.** The `server/` code is
  compiled via `tsconfig.backend.json` and started by `npm run start:api`, but
  Vercel only runs `api/**/*.ts`. If you need `/api/onboarding/provision-owner` in production, deploy the Express server
  separately (e.g. a Node host) and point the frontend at it via
  `VITE_API_BASE_URL` — this is not currently wired in CI or in `vercel.json`.
  Twilio messaging is not served from Express; it runs in `/functions/v1/twilio-messages`.
- **E2E CI runs without the Express server.** `npm run e2e:ci` uses
  `vite preview`, so any test that exercises `/api/staff/*`,
  `/api/onboarding/*`, or Stripe-authoritative flows gets 404s (treated as
  soft-failures by the guards allowlist). Real Twilio `/functions/v1/twilio-messages` and Stripe flows are
  not covered by the automated E2E suite.

## Spark template residue

- `src/main.tsx` imports `@github/spark/spark`, `vite.config.ts` loads
  `sparkPlugin` and `createIconImportProxy`, and the project still ships
  `runtime.config.json` and `spark.meta.json`. The app runs fine without Spark
  services, but removing Spark cleanly would require deleting these imports,
  plugins, and the alias that maps `@github/spark/hooks` to
  `src/lib/spark-hooks.ts`.
- `src/lib/spark-hooks.ts` is a **stub `useKV` that keeps values only in
  memory**. It is still called from a handful of places (Settings appearance,
  notifications tab, reports filters/data hooks, tests). Do not rely on
  `useKV` for persistence — anything important must go through a Supabase
  data hook in `src/hooks/data/`.
- On startup `src/main.tsx` removes any legacy `localStorage` keys starting
  with `kv:`. That one-time cleanup can be removed once all installs have
  upgraded.

## Env + config gaps

- `.env.example` is incomplete. It does **not** mention
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_BASE_URL`,
  `VITE_SENTRY_DSN`, `VITE_API_BASE_URL`, `E2E_EMAIL`, or `E2E_PASSWORD`.
  Anyone running messaging, Sentry, or the E2E suite locally has to discover
  these by reading the code.
- `VITE_APP_OWNER_USER_ID` is a **legacy** mechanism for gating the Settings
  → Logs tab. The code already prefers the `platform_admins` table. The env
  var should be retired once all deployments have at least one
  `platform_admins` row.

## Stripe

- `api/stripe/payments.ts` removed the legacy `create_link` action in favor
  of `create_checkout_link`. Any external integration or script still calling
  `create_link` will 400.
- Refunds: the code intentionally does **not** create a duplicate local row
  for Stripe card refunds — it waits for the webhook to persist. If the
  webhook is not delivered or not signature-valid, refund state will be
  wrong.
- `stripe_connections` persistence of capability state depends on
  `account.updated` webhook delivery. Missing webhook config will silently
  leave `charges_enabled` / `payouts_enabled` stale.
- `STRIPE_BILLING_PORTAL_RETURN_URL` is read in `api/stripe/billing.ts` but
  not in `.env.example`.

## Messaging

- The Messages UI in `src/pages/Messages.tsx` is backed by real Supabase
  tables (`messages`, `message_conversations`, `message_provider_profiles`, `message_sender_inventory`).
  Send and inbound are wired through `supabase/functions/twilio-messages/index.ts`, but:
  - Automations / templates tables exist in migrations but the UI surfaces
    around them are small. Confirm coverage before advertising "automations".
  - There is no rate-limiting or abuse guard on outbound send in the current
    edge function.
  - Per-store provider readiness is exposed via `getProviderReadinessStatus`
    in `supabase/functions/twilio-messages/shared.ts`; the UI may render a Messages page
    even when the store has no Twilio provider configured.

## Inventory

- `useKV`-era inventory persistence is gone; current inventory uses Supabase
  hooks. However, the regression test `src/test/inventory.test.ts` covers
  `DEFAULT_INVENTORY` default-load behavior only — it does not validate
  ledger costing end-to-end. Costing logic has its own tests
  (`inventory-costing.test.ts`, `weighted_average_costing.sql`), but do a
  manual full POS → inventory-deduct cycle before launch.

## Multi-tenant / RLS

- Migrations have iterated heavily on `store_memberships` RLS (see migrations
  `028`, `029`, `039`, `040`). Re-verify that a user in store A cannot read
  from store B on every critical table after any further migration.
- `platform_admins` bypass paths exist for logs. Any new admin-scoped view
  should also respect `is_store_member` / `is_store_owner` or it will be
  globally readable.

## Auth + onboarding

- The staff-invite flow accepts both `staff` and `front_desk` roles at the API
  and DB level for backward compatibility (see migration `030` + server
  validation). If you remove the compat path, make sure no older clients are
  still posting `staff`.
- Route guards in `src/App.tsx` redirect any authenticated user without a
  store membership to `/onboarding/create-store` — unless they have a
  `staff_invite_id` / `staff_invite_token` in their auth metadata, in which
  case they go to `/onboarding/staff`. That branching is subtle; breaking it
  stops new staff from ever reaching the app.

## Observability

- `src/lib/sentry.ts` only initializes if `VITE_SENTRY_DSN` is present. It's
  easy to ship a build without it and silently lose error reporting.
- `app_logs` is written to from `src/lib/appLogger.ts`. Unlike Sentry, there
  is no alerting on this table — someone has to actively check Settings →
  Logs.

## Deletions performed during this cleanup

The following docs were deleted because they were stale audits, completed
migration writeups, generated planning docs, or Spark boilerplate. If anyone
links to them from outside the repo, those links are now dead:

- `CHANGES.md`, `CHECKLIST.md`, `PRD.md`, `STRIPE_INTEGRATION.md`,
  `SUPABASE_REWIRING_GUIDE.md`, the entire `_archive/` folder, and most of
  `docs/` (see the PR description for the full list).
