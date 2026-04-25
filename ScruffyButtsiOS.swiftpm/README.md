# Scruffy Butts – iOS (Swift / SwiftUI)

A native iOS recreation of the [Scruffy Butts](../126/README.md) pet-grooming
business management web app.

The original `126/` app is a React 19 + TypeScript SPA backed by Supabase /
Stripe / Twilio.  This `ScruffyButtsiOS.swiftpm/` package is a **100 % Swift**
rewrite of the same product as a real native iOS application.

It targets **iOS 17+** and is shipped as a **Swift Playgrounds App package**,
which means the same folder opens directly in **both** Xcode 15+ **and** Swift
Playgrounds 4+ (iPadOS 16.4+ / macOS 13.3+) with no extra setup.

---

## How to open the project

### Option A — Xcode (recommended for App Store distribution)

1. Download or clone this repository.
2. In Finder, double-click `ScruffyButtsiOS.swiftpm`. Xcode will open it as an
   **App** project.
3. Choose an iPhone or iPad simulator (or your own device) in the scheme
   selector at the top of the Xcode window.
4. Press **⌘R** to build and run.

There is no `pod install`, `xcodegen`, or `tuist` step — Swift Playgrounds App
packages are first-class in Xcode and resolve everything automatically from
`Package.swift`.

### Option B — Swift Playgrounds 4+ (iPad or Mac)

1. Copy the `ScruffyButtsiOS.swiftpm` folder onto your iPad (Files app /
   AirDrop / iCloud Drive) or your Mac.
2. Open Swift Playgrounds and tap/click the package — it appears as a regular
   App project.
3. Tap the ▶︎ Play button to run it directly on the iPad, or build & deploy
   from a Mac.

### Option C — Upload directly into Swift Playgrounds on iPad

Zip the folder, AirDrop the zip to your iPad, tap to extract, then long-press
the `ScruffyButtsiOS.swiftpm` folder and choose **Open in Swift Playgrounds**.

---

## What is implemented

Every navigation surface from the original web app has a corresponding native
SwiftUI screen:

| Section          | Screens                                                                                                                               |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Auth             | Login, Sign up, Forgot password, Check email, Reset password                                                                          |
| Onboarding       | Create store, Staff onboarding, Staff profile setup                                                                                   |
| Dashboard        | Greeting, KPI tiles, groomer workload, recent activity, expense summary                                                               |
| Appointments     | Calendar list, New appointment sheet, Edit appointment                                                                                |
| Messages         | Threads list, conversation view with send                                                                                             |
| Clients          | List + search, Profile, Add / Edit, Add pet, Edit pet, Contact info, Payment history                                                  |
| Staff            | List, Profile, Edit, Create, Invite, Schedule editor, Payroll breakdown                                                               |
| POS              | Catalog (services + retail), cart, tax/tip, payment, receipt, success/cancel                                                          |
| Inventory        | List with low-stock highlighting, History                                                                                             |
| Finances         | Overview, Expenses detail, All expenses, Add expense, Upcoming bills, File taxes, Run payroll, Staff payroll breakdown                 |
| Reports          | Groomer performance, Revenue (last 30d sparkline), Top clients                                                                        |
| Settings         | Account, Store info, Appearance, Stripe onboarding link                                                                               |
| Stripe           | 3-step Connect onboarding stand-in                                                                                                    |

All data is provided by an in-memory `DataStore` (`Stores/DataStore.swift`)
that ships with realistic seed data (8 clients with pets, 4 staff members, 5
services, ~28 appointments across past/today/future, inventory with low-stock
items, expenses, bills, receipts, messages, and an activity feed).

## What is **not** implemented

The original web app integrates with three external services:

- **Supabase** (auth + Postgres + RLS)
- **Stripe** (Connect, Terminal, Checkout, billing)
- **Twilio** (SMS messaging)

Real network calls to those services are intentionally **not** included in
this Swift port — they require API keys, accounts and platform-specific
SDKs.  The matching screens (auth, payments, messaging) all exist with
mocked behaviour so the app runs end-to-end on a fresh simulator.

To wire up real backends later, the natural extension points are:

- `Stores/AuthStore.swift` — replace the mock `signIn` / `signUp` /
  `sendPasswordReset` with calls to the [supabase-swift](https://github.com/supabase/supabase-swift) SDK.
- `Stores/DataStore.swift` — replace the seeded arrays with calls to
  Supabase tables.  The struct shapes already align with the underlying
  Postgres schema in `126/supabase/migrations/`.
- `Views/POS/POSAndInventory.swift` (`charge` function) — swap the
  mock `Receipt` creation for a real Stripe Terminal / Stripe Checkout
  payment intent.
- `Views/Messages/MessagesView.swift` — swap the in-memory append for a
  request to your Twilio messaging endpoint.

## Project layout

```
ScruffyButtsiOS.swiftpm/
├── Package.swift                # iOS application product (Swift Playgrounds App)
├── ScruffyButtsApp.swift        # @main entry
├── RootView.swift               # Auth gate + sidebar/tab shell + AppSection enum
├── Theme.swift                  # Colours, card style, radii
├── Models/
│   └── Models.swift             # Client, Pet, Appointment, StaffMember, … + Money helper
├── Stores/
│   ├── AuthStore.swift          # Mock sign-in / sign-up / reset
│   ├── DataStore.swift          # All app data, in-memory + seeded
│   └── AppearanceStore.swift    # Theme / colour scheme
├── Components/
│   └── Components.swift         # StatWidget, SectionCard, AvatarCircle, EmptyState, …
└── Views/
    ├── Auth/AuthViews.swift
    ├── Onboarding/OnboardingViews.swift
    ├── Dashboard/DashboardView.swift
    ├── Appointments/AppointmentsView.swift
    ├── Messages/MessagesView.swift
    ├── Clients/ClientsViews.swift
    ├── Staff/StaffViews.swift
    ├── POS/POSAndInventory.swift   # POS, Receipt, PaymentSuccess, PaymentCancel, Inventory
    ├── Finances/FinancesViews.swift
    ├── Reports/ReportsViews.swift
    ├── Settings/SettingsView.swift
    └── Stripe/StripeOnboardingView.swift
```

## Try the demo flow

1. Launch the app — you’ll see the **Welcome back** screen.
2. Type any email and any 6+ character password and tap **Sign in**.
3. The sidebar shows the same 10 sections as the web app: Dashboard,
   Appointments, Messages, Clients, Staff, POS, Inventory, Finances, Reports
   and Settings.
4. Tap around — every screen is wired up against the seeded data store, so
   adding clients, ringing up a sale at the POS, marking bills paid and so on
   all reflect immediately across the rest of the app.

## License

Same proprietary licence as the rest of this repository — see `LICENSE.md` at
the repo root.
