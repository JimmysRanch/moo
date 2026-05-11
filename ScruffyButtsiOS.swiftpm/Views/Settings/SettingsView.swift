import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var data: DataStore
    @EnvironmentObject private var appearance: AppearanceStore

    var body: some View {
        Form {
            Section("Account") {
                if let u = auth.user {
                    LabeledContent("Name",  value: "\(u.firstName) \(u.lastName)")
                    LabeledContent("Email", value: u.email)
                }
                Button("Sign out", role: .destructive) { auth.signOut() }
            }
            Section("Store") {
                if let s = data.stores.first(where: { $0.id == data.activeStoreId }) {
                    LabeledContent("Name",     value: s.name)
                    LabeledContent("Address",  value: s.address)
                    LabeledContent("Timezone", value: s.timezone)
                }
            }
            Section("Appearance") {
                Picker("Mode", selection: $appearance.mode) {
                    ForEach(AppearanceStore.Mode.allCases) { Text($0.label).tag($0) }
                }
                Picker("Theme", selection: $appearance.accent) {
                    ForEach(AppearanceStore.AccentTheme.allCases) { Text($0.label).tag($0) }
                }
            }
            Section("Payments") {
                NavigationLink("Stripe onboarding", destination: StripeOnboardingView())
            }
            Section("About") {
                LabeledContent("Version", value: "1.0 (1)")
                LabeledContent("Build",   value: "Native iOS – SwiftUI")
            }
        }
        .navigationTitle("Settings")
    }
}
