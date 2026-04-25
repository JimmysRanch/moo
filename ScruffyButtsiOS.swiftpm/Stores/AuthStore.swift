import Foundation
import SwiftUI

/// Mock authentication store. In the original web app this is backed by Supabase.
/// Here it is in-memory only so the app runs without any backend.
@MainActor
final class AuthStore: ObservableObject {
    struct CurrentUser: Equatable {
        let id: UUID
        var email: String
        var firstName: String
        var lastName: String
    }

    @Published private(set) var user: CurrentUser?
    @Published private(set) var isLoading: Bool = false

    var isSignedIn: Bool { user != nil }

    func signIn(email: String, password: String) async throws {
        try await simulate()
        guard !email.isEmpty, password.count >= 6 else {
            throw AuthError.invalidCredentials
        }
        user = CurrentUser(
            id: UUID(),
            email: email,
            firstName: "Owner",
            lastName: "Scruffy"
        )
    }

    func signUp(email: String, password: String, firstName: String, lastName: String) async throws {
        try await simulate()
        guard !email.isEmpty, password.count >= 6 else {
            throw AuthError.invalidCredentials
        }
        user = CurrentUser(id: UUID(), email: email, firstName: firstName, lastName: lastName)
    }

    func sendPasswordReset(email: String) async throws {
        try await simulate()
        guard !email.isEmpty else { throw AuthError.invalidCredentials }
    }

    func resetPassword(newPassword: String) async throws {
        try await simulate()
        guard newPassword.count >= 6 else { throw AuthError.invalidCredentials }
    }

    func signOut() {
        user = nil
    }

    private func simulate() async throws {
        isLoading = true
        defer { isLoading = false }
        try await Task.sleep(nanoseconds: 350_000_000)
    }

    enum AuthError: LocalizedError {
        case invalidCredentials
        var errorDescription: String? {
            switch self {
            case .invalidCredentials: return "Please enter a valid email and password (6+ characters)."
            }
        }
    }
}
