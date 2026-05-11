import SwiftUI

private struct AuthBackground: View {
    var body: some View {
        LinearGradient(colors: [Theme.sweetBlueTop, Theme.sweetBlueBottom],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
            .ignoresSafeArea()
            .overlay(BubbleField().opacity(0.5))
    }
}

private struct BubbleField: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(0..<16, id: \.self) { i in
                    let size = CGFloat(24 + i * 6)
                    Circle()
                        .fill(Color.white.opacity(0.18 + Double(i) * 0.01))
                        .frame(width: size, height: size)
                        .position(
                            x: geo.size.width  * CGFloat((i * 13) % 90) / 100,
                            y: geo.size.height * CGFloat(10 + (i * 5) % 70) / 100
                        )
                }
            }
        }
    }
}

private struct AuthCard<Content: View>: View {
    let title: String
    let subtitle: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PuppyMascot(size: 88)
                Text(title).font(.title.weight(.bold))
                    .foregroundStyle(.white)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                }
                VStack(spacing: 14) { content() }
                    .padding(20)
                    .background(.ultraThinMaterial,
                                in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .padding(24)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Login

struct LoginView: View {
    var go: (AuthFlowView.AuthScreen) -> Void
    @EnvironmentObject private var auth: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var working = false

    var body: some View {
        ZStack {
            AuthBackground()
            AuthCard(title: "Welcome back", subtitle: "Sign in to manage your grooming business.") {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                if let error {
                    Text(error).font(.footnote).foregroundStyle(Theme.danger)
                }
                Button {
                    Task { await submit() }
                } label: {
                    if working { ProgressView().tint(.white) }
                    else       { Text("Sign in") }
                }
                .buttonStyle(.primaryCTA)
                .disabled(working)

                HStack {
                    Button("Forgot password?") { go(.forgotPassword) }
                    Spacer()
                    Button("Create account")  { go(.signup) }
                }
                .font(.footnote)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
    }

    private func submit() async {
        error = nil; working = true
        defer { working = false }
        do { try await auth.signIn(email: email, password: password) }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - Signup

struct SignupView: View {
    var go: (AuthFlowView.AuthScreen) -> Void
    @EnvironmentObject private var auth: AuthStore
    @State private var first = ""
    @State private var last = ""
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var working = false

    var body: some View {
        ZStack {
            AuthBackground()
            AuthCard(title: "Create your account", subtitle: "Start running your shop in minutes.") {
                HStack {
                    TextField("First name", text: $first)
                        .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                    TextField("Last name", text: $last)
                        .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                }
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                SecureField("Password (6+ characters)", text: $password)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                if let error { Text(error).font(.footnote).foregroundStyle(Theme.danger) }
                Button {
                    Task { await submit() }
                } label: {
                    if working { ProgressView().tint(.white) } else { Text("Create account") }
                }
                .buttonStyle(.primaryCTA)
                .disabled(working)

                Button("Already have an account? Sign in") { go(.login) }
                    .font(.footnote)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func submit() async {
        error = nil; working = true
        defer { working = false }
        do { try await auth.signUp(email: email, password: password, firstName: first, lastName: last) }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - Forgot / Check email / Reset

struct ForgotPasswordView: View {
    var go: (AuthFlowView.AuthScreen) -> Void
    @EnvironmentObject private var auth: AuthStore
    @State private var email = ""
    @State private var working = false
    @State private var error: String?

    var body: some View {
        ZStack {
            AuthBackground()
            AuthCard(title: "Reset your password",
                     subtitle: "We’ll email you a link to set a new password.") {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                if let error { Text(error).font(.footnote).foregroundStyle(Theme.danger) }
                Button {
                    Task {
                        working = true; error = nil
                        do { try await auth.sendPasswordReset(email: email); go(.checkEmail) }
                        catch { self.error = error.localizedDescription }
                        working = false
                    }
                } label: {
                    if working { ProgressView().tint(.white) } else { Text("Send reset link") }
                }
                .buttonStyle(.primaryCTA)
                .disabled(working)

                Button("Back to sign in") { go(.login) }.font(.footnote)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct CheckEmailView: View {
    var go: (AuthFlowView.AuthScreen) -> Void
    var body: some View {
        ZStack {
            AuthBackground()
            AuthCard(title: "Check your email",
                     subtitle: "We sent you a link to continue. You can close this window.") {
                Button("Open password reset") { go(.resetPassword) }.buttonStyle(.primaryCTA)
                Button("Back to sign in") { go(.login) }.font(.footnote)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct ResetPasswordView: View {
    var go: (AuthFlowView.AuthScreen) -> Void
    @EnvironmentObject private var auth: AuthStore
    @State private var password = ""
    @State private var confirm = ""
    @State private var error: String?

    var body: some View {
        ZStack {
            AuthBackground()
            AuthCard(title: "Choose a new password", subtitle: nil) {
                SecureField("New password", text: $password)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                SecureField("Confirm password", text: $confirm)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                if let error { Text(error).font(.footnote).foregroundStyle(Theme.danger) }
                Button("Update password") {
                    Task {
                        guard password == confirm else { error = "Passwords do not match."; return }
                        do { try await auth.resetPassword(newPassword: password); go(.login) }
                        catch { self.error = error.localizedDescription }
                    }
                }
                .buttonStyle(.primaryCTA)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
