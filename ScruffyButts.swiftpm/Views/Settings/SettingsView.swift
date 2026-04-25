import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var data: DataStore

    @State private var businessName: String = ""
    @State private var taxRate: Double = 8.25

    var body: some View {
        Form {
            Section("Profile") {
                LabeledContent("Email", value: auth.currentUser?.email ?? "—")
                TextField("Business name", text: $businessName)
                    .onAppear { businessName = auth.currentUser?.businessName ?? "Scruffy Butts" }
            }
            Section("Operations") {
                HStack {
                    Text("Default tax rate")
                    Spacer()
                    TextField("Rate", value: $taxRate, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                    Text("%").foregroundStyle(.secondary)
                }
            }
            Section {
                NavigationLink { NotificationSettingsView() } label: {
                    Label("Notifications", systemImage: "bell.badge")
                }
                NavigationLink { LogsSettingsView() } label: {
                    Label("Activity log", systemImage: "doc.text.magnifyingglass")
                }
            }
            Section {
                Button(role: .destructive) {
                    auth.logout()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
            Section {
                Text("Backed by an in-memory data store. Wire up Supabase / Stripe / Twilio in production.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Settings")
    }
}

struct NotificationSettingsView: View {
    @State private var apptReminders = true
    @State private var lowStockAlerts = true
    @State private var marketingDigest = false

    var body: some View {
        Form {
            Toggle("Appointment reminders", isOn: $apptReminders)
            Toggle("Low-stock alerts", isOn: $lowStockAlerts)
            Toggle("Weekly marketing digest", isOn: $marketingDigest)
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct LogsSettingsView: View {
    @EnvironmentObject var data: DataStore
    var body: some View {
        List {
            ForEach(data.activity) { e in ActivityRow(event: e) }
        }
        .navigationTitle("Activity log")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if data.activity.isEmpty {
                EmptyStateView(systemImage: "doc.text", title: "No activity yet")
            }
        }
    }
}
