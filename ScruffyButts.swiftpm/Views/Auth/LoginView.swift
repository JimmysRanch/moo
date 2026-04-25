import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var showSignup = false
    @State private var showForgot = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    PuppyMascot(size: 96)
                        .padding(.top, 40)
                    VStack(spacing: 4) {
                        Text("Scruffy Butts")
                            .font(.largeTitle.bold())
                        Text("Pet grooming, organised.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding()
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .padding()
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        if let err = auth.errorMessage {
                            Text(err).font(.footnote).foregroundStyle(Theme.danger)
                        }

                        Button {
                            Task { await auth.login(email: email, password: password) }
                        } label: {
                            HStack {
                                if auth.isLoading { ProgressView().tint(.white) }
                                Text("Sign in")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .background(Theme.accent)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .disabled(auth.isLoading)

                        Button("Forgot password?") { showForgot = true }
                            .font(.footnote)
                    }
                    .padding(.horizontal)

                    HStack {
                        Text("Don't have an account?")
                            .foregroundStyle(.secondary)
                        Button("Create one") { showSignup = true }
                            .fontWeight(.semibold)
                    }
                    .font(.footnote)

                    Spacer(minLength: 40)
                }
                .padding(.horizontal)
            }
            .background(Theme.background.ignoresSafeArea())
            .sheet(isPresented: $showSignup) { SignupView() }
            .sheet(isPresented: $showForgot) { ForgotPasswordView() }
        }
    }
}
