# Launch checklist

Before putting this app in front of paying salons, walk through every item
below. Anything unchecked is a release blocker.

## Secrets + environment

- [ ] All production variables from [`ENVIRONMENT.md`](ENVIRONMENT.md) are
      present in the deployment target (Vercel, Express host, Supabase).
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **live-mode**, not test.
- [ ] `STRIPE_PLATFORM_PRICE_ID_MONTHLY` is set if the SaaS subscription flow is
      offered, and points at the live price.
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` is the live publishable key.
- [ ] `APP_BASE_URL` is the real production URL (used for Stripe redirects and
      invite email links).
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WEBHOOK_BASE_URL`
      are set if SMS messaging is enabled. `TWILIO_WEBHOOK_BASE_URL` must be
      publicly reachable.
- [ ] `VITE_SENTRY_DSN` is set in production builds.

## Supabase

- [ ] All migrations in `supabase/migrations/` have been applied in order.
- [ ] RLS is on for every store-scoped table.
- [ ] `platform_admins` contains the user IDs of people who should see global
      admin views (Settings → Logs).
- [ ] `reconcile-payments` edge function is deployed and scheduled.
- [ ] Service-role key is only used server-side and never shipped to the browser.

## Stripe Connect (POS)

- [ ] Webhook endpoint `https://<APP_BASE_URL>/api/stripe/webhook` is
      registered in the Stripe Dashboard and subscribed to at least:
      `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `charge.refunded`, `refund.updated`, `account.updated`,
      `checkout.session.completed`.
- [ ] Owner completes Connect onboarding end-to-end from within the app
      (`/stripe/onboarding`) and the resulting `stripe_connections` row shows
      `charges_enabled` and `payouts_enabled`.
- [ ] Manual card charge → `payment_intents` and `transactions` rows created.
- [ ] Terminal charge on a real reader → `payment_intents` and `transactions`
      rows created.
- [ ] Checkout Session (payment link) success redirect resolves via
      `GET /api/stripe/checkout` and finalizes the sale server-side via
      `checkout.session.completed`.
- [ ] Full refund and partial refund both land in `refunds` and in the
      connected account.
- [ ] Reconciliation function run catches no outstanding discrepancies.

## Stripe platform subscription (only if enabled)

- [ ] `POST /api/stripe/billing` `create_checkout_session` redirects owners
      into a real subscription flow that returns to the app.
- [ ] `create_billing_portal` opens the customer billing portal.
- [ ] `platform_subscriptions` reflects subscription state.

## Messaging (only if Twilio is enabled)

- [ ] Twilio messaging service number is provisioned and configured on the
      per-store `twilio_messaging_providers` row.
- [ ] Inbound webhook (`/api/messages/webhooks/inbound`) and status webhook
      (`/api/messages/webhooks/status`) are reachable from Twilio.
- [ ] Outbound send from `/messages` delivers to a real phone.
- [ ] Inbound reply appears in the conversation thread.
- [ ] Status callbacks update message delivery state.

## Auth + onboarding

- [ ] New user can sign up, confirm email, and land on `/onboarding/create-store`.
- [ ] Store creation succeeds and `store_memberships` row is created as `owner`.
- [ ] Staff invite email is received; link lands on
      `/onboarding/staff?token=<id>` and finishes onboarding to the dashboard.
- [ ] Role backward-compatibility: sending `role: "staff"` to the invite API is
      normalized to `front_desk` and doesn't break the DB constraint.
- [ ] Forgot password + reset flows work against production Supabase.

## App smoke (logged-in owner)

- [ ] `/dashboard`, `/appointments`, `/clients`, `/staff`, `/inventory`,
      `/pos`, `/finances`, `/reports/*`, `/messages`, `/settings`,
      `/recent-activity` all load without console errors.
- [ ] Creating an appointment, saving it, and editing it works without RLS
      permission errors.
- [ ] Saving a staff schedule twice on the same day updates the existing row
      (no duplicate-key toast).
- [ ] `audit_log` rows appear for write actions and are visible in the app.

## Build, deploy, CI

- [ ] `npm run build` succeeds with production env vars.
- [ ] Vercel preview deploys load and `/api/health` returns `{ ok: true }`.
- [ ] `CI` workflow (`.github/workflows/ci.yml`) is green on `main`.
- [ ] `E2E Tests` workflow (`.github/workflows/e2e.yml`) is green on `main`.

## Risk review

- [ ] Walked through [`KNOWN-RISKS.md`](KNOWN-RISKS.md) and accepted each item
      or opened a follow-up.
