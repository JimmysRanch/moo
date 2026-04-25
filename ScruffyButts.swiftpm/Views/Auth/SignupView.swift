import SwiftUI

struct SignupView: View {
    @EnvironmentObject var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var businessName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Your business") {
                    TextField("Business name", text: $businessName)
                }
                Section("Account") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                    SecureField("Confirm password", text: $confirm)
                }
                if let err = auth.errorMessage {
                    Section { Text(err).foregroundStyle(Theme.danger) }
                }
                if password != confirm && !confirm.isEmpty {
                    Section { Text("Passwords don't match.").foregroundStyle(Theme.danger) }
                }
                Section {
                    Button {
                        Task {
                            await auth.signup(email: email, password: password, businessName: businessName)
                            if auth.isAuthenticated { dismiss() }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if auth.isLoading { ProgressView().tint(.white) }
                            Text("Create account").font(.headline)
                            Spacer()
                        }
                    }
                    .listRowBackground(Theme.accent)
                    .foregroundStyle(.white)
                    .disabled(password != confirm || password.isEmpty)
                }
            }
            .navigationTitle("Create account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
