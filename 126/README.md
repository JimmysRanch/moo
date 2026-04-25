# Scruffy Butts

Pet-grooming business management app — appointments, clients/pets, staff,
POS, inventory, finances, messaging, and reports.

**Stack (what is actually in the repo):**

- React 19 + TypeScript + Vite 7 (SPA, `src/`)
- Tailwind CSS v4, Radix UI, shadcn-style components
- React Router v7 (`src/App.tsx`)
- TanStack Query for server state (`src/lib/queryClient.ts`)
- Supabase (auth + Postgres + RLS) — `src/lib/supabase.ts`, migrations in `supabase/migrations/`
- Two backend surfaces:
  - **Vercel serverless functions** in `api/` — Stripe endpoints, onboarding, staff invite, health
  - **Express API** in `server/` — onboarding and staff invite routes, run locally via `npm run dev:api`
- Stripe Connect + Terminal + Checkout (`api/stripe/*`) and a separate platform SaaS subscription flow (`api/stripe/billing.ts`)
- Twilio for SMS messaging (`supabase/functions/twilio-messages/index.ts`)
- Playwright E2E (`e2e/`) and Vitest unit tests (`src/test/`)
- Sentry (`@sentry/react`) and Vercel Speed Insights
- Built on top of a `@github/spark` Vite template; `useKV` is a stub that only holds in-memory state (see `src/lib/spark-hooks.ts`)

## Quick start

```bash
npm install
cp .env.example .env        # fill in Supabase + Stripe values
npm run dev                 # runs vite (web) and tsx watch (api) together
```

- Web dev server: http://localhost:5173 (Vite)
- API dev server: http://localhost:4242 (Express, proxied from `/api` by Vite)

## Scripts (from `package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Runs `dev:web` and `dev:api` concurrently |
| `npm run dev:web` | `vite` |
| `npm run dev:api` | `tsx watch server/index.ts` |
| `npm run build` | `tsc -b --noCheck && npm run typecheck:backend && vite build` |
| `npm run typecheck:backend` | `tsc -p tsconfig.backend.json --noEmit` |
| `npm run start:api` | `node server/dist/index.js` |
| `npm run lint` | `eslint .` |
| `npm test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run e2e` | `playwright test` |
| `npm run e2e:ci` | `start-server-and-test preview:ci http://127.0.0.1:5173 e2e` |
| `npm run e2e:ui` | Playwright UI mode |
| `npm run e2e:report` | `playwright show-report` |
| `npm run preview` | `vite preview` |
| `npm run preview:ci` | `vite preview --host 0.0.0.0 --port 5173 --strictPort` |
| `npm run optimize` | `vite optimize` |
| `npm run kill` | Kill anything on port 5000 |

## Documentation

Only five docs are maintained. Anything else is historical.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — routes, API surfaces, data flow
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — every environment variable the code actually reads
- [`docs/TESTING.md`](docs/TESTING.md) — Vitest + Playwright, required secrets, seeding the E2E user
- [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md) — what must be verified before go-live
- [`docs/KNOWN-RISKS.md`](docs/KNOWN-RISKS.md) — partial / placeholder / brittle areas of the codebase

## License

See [LICENSE](LICENSE) (proprietary).
