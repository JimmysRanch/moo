# Scruffy Butts — iOS (Swift)

A native, **100 % Swift / SwiftUI** port of the `126/` web app
("Scruffy Butts" — pet-grooming business management). It is shipped as a
**Swift Playgrounds App Package (`.swiftpm`)** so you can open it directly in
either **Xcode 14+** or **Swift Playgrounds 4+ on iPad / Mac**.

## What's inside

```text
ScruffyButts.swiftpm/
├── Package.swift          # App manifest (.iOSApplication)
├── App.swift              # @main entry point
├── Theme.swift            # Colours, card style, formatters
├── Models/                # Pure-Swift value types (Client, Pet, Appointment, …)
├── Store/
│   ├── AuthStore.swift    # In-memory auth (replaces Supabase auth)
│   ├── DataStore.swift    # ObservableObject backing all screens
│   └── SampleData.swift   # Seed data so the app is populated on first launch
└── Views/
    ├── Root/              # RootView (auth gate) + MainTabView
    ├── Auth/              # Login, Signup, Forgot password
    ├── Dashboard/         # Stats, today's schedule, sparkline, activity feed
    ├── Appointments/      # Day list, New, Edit
    ├── Clients/           # List, Profile, Add/Edit Client, Add/Edit Pet
    ├── Staff/             # List, Profile, Create, Invite, Schedule, Payroll, Performance
    ├── POS/               # Point-of-sale cart + Receipt
    ├── Inventory/         # Items, Detail, History
    ├── Finances/          # Expenses, Bills, Payroll breakdown, Taxes
    ├── Messages/          # Conversations + Thread
    ├── Settings/          # Profile, Notifications, Activity log
    └── Common/            # Shared mascot / placeholders
```

## Open it

### Option 1 — Swift Playgrounds (iPad or Mac)

1. Copy / AirDrop the entire `ScruffyButts.swiftpm` folder to the device.
2. In Swift Playgrounds, choose **See All → My Playgrounds**, then tap the `+`
   button and pick **From Files…** to import the `.swiftpm` folder.
3. Tap the ▶︎ Run button. The simulator will launch the iOS app.

### Option 2 — Xcode 14 or later (Mac)

1. In Finder, double-click `ScruffyButts.swiftpm`. Xcode opens it as a
   regular App project.
2. Pick a simulator (any iPhone or iPad) at the top of the window.
3. Press ⌘R. The app will build and launch.

> No CocoaPods, SPM dependencies, or extra setup required — the package only
> uses **SwiftUI / Foundation / Combine** which ship with iOS 16+.

## How it maps to the original web app

| Web app (`126/…`)              | iOS Swift port                                                |
| ------------------------------ | ------------------------------------------------------------- |
| `App.tsx`, React Router        | `App.swift` + `RootView` + `MainTabView` (TabView nav)        |
| `Login.tsx`, `Signup.tsx`, …   | `Views/Auth/*`                                                |
| `Dashboard.tsx`, `StatWidget`  | `Views/Dashboard/DashboardView.swift`                         |
| `Appointments.tsx`, `New/Edit` | `Views/Appointments/*`                                        |
| `ClientsList`, `ClientProfile` | `Views/Clients/*`                                             |
| `Staff*`, `RunPayroll`, …      | `Views/Staff/*`                                               |
| `POS.tsx`, `Receipt.tsx`       | `Views/POS/*`                                                 |
| `Inventory*.tsx`               | `Views/Inventory/*`                                           |
| `Finances*`, `FileTaxes`, etc. | `Views/Finances/*`                                            |
| `Messages.tsx`                 | `Views/Messages/*`                                            |
| `Settings.tsx`, `Logs…`        | `Views/Settings/*`                                            |
| Supabase (auth + Postgres)     | `AuthStore` + `DataStore` (in-memory; seeded sample data)     |
| Stripe Connect / Terminal      | Stubbed `Payment` model — wire up StripeTerminal SDK to ship  |
| Twilio SMS                     | Stubbed in `MessagesView` — call your own SMS endpoint        |

The data layer is intentionally swappable: anywhere `DataStore` is used you
can replace its in-memory arrays with a real backend (e.g. the
[`supabase-swift`](https://github.com/supabase-community/supabase-swift)
package or the Stripe iOS SDK) without touching the views.

## Sample login

The first launch shows a sign-in screen. Any email / password is accepted —
the auth store simulates a successful login and seeds sample clients,
pets, staff, appointments, inventory, expenses, and revenue so the
Dashboard, POS, and other screens are immediately populated.
