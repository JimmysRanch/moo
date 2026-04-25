import Foundation
import Combine

/// Lightweight in-memory authentication store. Replaces the Supabase
/// auth used by the original web app so the iOS port runs offline.
@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var currentUser: AppUser?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    var isAuthenticated: Bool { currentUser != nil }

    func login(email: String, password: String) async {
        errorMessage = nil
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Email and password are required."
            return
        }
        isLoading = true
        defer { isLoading = false }
        // Simulate network round-trip.
        try? await Task.sleep(nanoseconds: 250_000_000)
        currentUser = AppUser(
            email: email,
            displayName: email.split(separator: "@").first.map(String.init) ?? "Owner"
        )
    }

    func signup(email: String, password: String, businessName: String) async {
        errorMessage = nil
        guard password.count >= 6 else {
            errorMessage = "Password must be at least 6 characters."
            return
        }
        isLoading = true
        defer { isLoading = false }
        try? await Task.sleep(nanoseconds: 250_000_000)
        currentUser = AppUser(
            email: email,
            displayName: email.split(separator: "@").first.map(String.init) ?? "Owner",
            businessName: businessName.isEmpty ? "Scruffy Butts" : businessName
        )
    }

    func sendPasswordReset(email: String) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        try? await Task.sleep(nanoseconds: 250_000_000)
        // No-op locally — would call Supabase.
    }

    func logout() {
        currentUser = nil
    }
}
