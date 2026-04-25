import SwiftUI

/// A scaled-down stand-in for the Stripe Connect onboarding flow.
/// In the original web app this hands off to Stripe's hosted onboarding;
/// here it walks through a simple 3-step UI so the screen exists end-to-end.
struct StripeOnboardingView: View {
    @State private var step = 0
    private let steps = ["Business details", "Bank account", "Verify identity"]

    var body: some View {
        VStack(spacing: 18) {
            HStack(spacing: 8) {
                ForEach(0..<steps.count, id: \.self) { i in
                    Capsule().fill(i <= step ? Theme.primary : Theme.border)
                        .frame(height: 4)
                }
            }
            .padding(.horizontal)

            Text(steps[step]).font(.title2.weight(.bold))

            Group {
                switch step {
                case 0: BusinessDetailsForm()
                case 1: BankAccountForm()
                default: IdentityForm()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .padding(.horizontal)

            HStack {
                if step > 0 {
                    Button("Back") { step -= 1 }
                }
                Spacer()
                if step < steps.count - 1 {
                    Button("Next") { step += 1 }.buttonStyle(.borderedProminent)
                } else {
                    Button("Finish") { step = 0 }.buttonStyle(.primaryCTA).frame(maxWidth: 180)
                }
            }
            .padding(.horizontal)

            Spacer()
        }
        .padding(.top)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Stripe onboarding")
    }
}

private struct BusinessDetailsForm: View {
    @State private var legalName = ""
    @State private var ein = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Legal business name", text: $legalName)
                .textFieldStyle(.roundedBorder)
            TextField("EIN / Tax ID", text: $ein)
                .textFieldStyle(.roundedBorder)
        }
    }
}

private struct BankAccountForm: View {
    @State private var routing = ""
    @State private var account = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Routing number", text: $routing).textFieldStyle(.roundedBorder)
            TextField("Account number", text: $account).textFieldStyle(.roundedBorder)
        }
    }
}

private struct IdentityForm: View {
    @State private var ssnLast4 = ""
    @State private var dob = Date()
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Last 4 of SSN", text: $ssnLast4).textFieldStyle(.roundedBorder)
            DatePicker("Date of birth", selection: $dob, displayedComponents: .date)
        }
    }
}
