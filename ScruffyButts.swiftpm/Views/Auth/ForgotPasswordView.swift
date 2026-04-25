import SwiftUI

struct ForgotPasswordView: View {
    @EnvironmentObject var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var sent = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Reset your password") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                if sent {
                    Section { Label("Reset email sent (simulated).", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(Theme.success) }
                }
                Section {
                    Button {
                        Task {
                            await auth.sendPasswordReset(email: email)
                            sent = true
                        }
                    } label: {
                        HStack { Spacer(); Text("Send reset link").font(.headline); Spacer() }
                    }
                    .listRowBackground(Theme.accent)
                    .foregroundStyle(.white)
                    .disabled(email.isEmpty)
                }
            }
            .navigationTitle("Forgot password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }
}
