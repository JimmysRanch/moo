import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack { DashboardView() }
                .tabItem { Label("Dashboard", systemImage: "chart.bar.fill") }

            NavigationStack { AppointmentsView() }
                .tabItem { Label("Appointments", systemImage: "calendar") }

            NavigationStack { ClientsListView() }
                .tabItem { Label("Clients", systemImage: "person.2.fill") }

            NavigationStack { POSView() }
                .tabItem { Label("POS", systemImage: "creditcard.fill") }

            NavigationStack { MoreMenuView() }
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
        }
    }
}

/// Aggregates the secondary feature areas (Staff, Inventory, Finances,
/// Messages, Settings) under a single tab so the bottom bar mirrors what
/// most native iOS business apps look like.
struct MoreMenuView: View {
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        List {
            Section {
                NavigationLink { StaffView() } label: {
                    Label("Staff", systemImage: "person.3.fill")
                }
                NavigationLink { InventoryView() } label: {
                    Label("Inventory", systemImage: "shippingbox.fill")
                }
                NavigationLink { FinancesView() } label: {
                    Label("Finances", systemImage: "dollarsign.circle.fill")
                }
                NavigationLink { MessagesView() } label: {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                }
            }
            Section {
                NavigationLink { SettingsView() } label: {
                    Label("Settings", systemImage: "gearshape.fill")
                }
            }
            Section {
                Button(role: .destructive) {
                    auth.logout()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("More")
    }
}
