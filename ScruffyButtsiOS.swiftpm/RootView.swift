import SwiftUI

/// Top-level routing: shows auth flow if signed out, otherwise the main shell.
struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var data: DataStore

    var body: some View {
        Group {
            if !auth.isSignedIn {
                AuthFlowView()
            } else if data.activeStoreId == nil {
                CreateStoreView()
            } else {
                MainShellView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.isSignedIn)
        .animation(.easeInOut(duration: 0.25), value: data.activeStoreId)
    }
}

// MARK: - Auth flow router

struct AuthFlowView: View {
    @State private var screen: AuthScreen = .login

    enum AuthScreen: Hashable {
        case login, signup, forgotPassword, checkEmail, resetPassword
    }

    var body: some View {
        NavigationStack {
            switch screen {
            case .login:           LoginView(go: { screen = $0 })
            case .signup:          SignupView(go: { screen = $0 })
            case .forgotPassword:  ForgotPasswordView(go: { screen = $0 })
            case .checkEmail:      CheckEmailView(go: { screen = $0 })
            case .resetPassword:   ResetPasswordView(go: { screen = $0 })
            }
        }
    }
}

// MARK: - Main app shell with sidebar / tab navigation

struct MainShellView: View {
    @State private var section: AppSection = .dashboard

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $section) { item in
                NavigationLink(value: item) {
                    Label(item.title, systemImage: item.systemImage)
                }
            }
            .navigationTitle("Scruffy Butts")
            .listStyle(.sidebar)
        } detail: {
            NavigationStack {
                switch section {
                case .dashboard:    DashboardView()
                case .appointments: AppointmentsView()
                case .messages:     MessagesView()
                case .clients:      ClientsListView()
                case .staff:        StaffView()
                case .pos:          POSView()
                case .inventory:    InventoryView()
                case .finances:     FinancesView()
                case .reports:      ReportsView()
                case .settings:     SettingsView()
                }
            }
        }
    }
}

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case dashboard, appointments, messages, clients, staff, pos, inventory, finances, reports, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard:    return "Dashboard"
        case .appointments: return "Appointments"
        case .messages:     return "Messages"
        case .clients:      return "Clients"
        case .staff:        return "Staff"
        case .pos:          return "POS"
        case .inventory:    return "Inventory"
        case .finances:     return "Finances"
        case .reports:      return "Reports"
        case .settings:     return "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .dashboard:    return "rectangle.grid.2x2"
        case .appointments: return "calendar"
        case .messages:     return "bubble.left.and.bubble.right"
        case .clients:      return "person.2"
        case .staff:        return "person.badge.shield.checkmark"
        case .pos:          return "creditcard"
        case .inventory:    return "shippingbox"
        case .finances:     return "chart.line.uptrend.xyaxis"
        case .reports:      return "doc.text.magnifyingglass"
        case .settings:     return "gearshape"
        }
    }
}
