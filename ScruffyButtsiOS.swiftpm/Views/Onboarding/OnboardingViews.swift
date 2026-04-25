import SwiftUI

struct CreateStoreView: View {
    @EnvironmentObject private var data: DataStore
    @State private var name = "Scruffy Butts"
    @State private var address = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PuppyMascot(size: 88)
                Text("Create your store")
                    .font(.title.weight(.bold))
                Text("This is the workspace your team will use day-to-day.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedText)
                    .multilineTextAlignment(.center)

                VStack(spacing: 12) {
                    TextField("Store name",  text: $name)
                        .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                    TextField("Street address", text: $address)
                        .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                    Button("Create store") {
                        data.createStore(name: name, address: address)
                    }
                    .buttonStyle(.primaryCTA)
                    .disabled(name.isEmpty)
                }
                .padding(20)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
            }
            .padding(24)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
    }
}

struct StaffOnboardingView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Welcome to the team!").font(.largeTitle.weight(.bold))
                Text("Let’s get your staff profile set up so you can clock in and start grooming.")
                    .foregroundStyle(Theme.mutedText)
                NavigationLink("Set up profile", destination: StaffProfileSetupView())
                    .buttonStyle(.primaryCTA)
            }
            .padding(20)
        }
        .navigationTitle("Staff onboarding")
    }
}

struct StaffProfileSetupView: View {
    @State private var first = ""
    @State private var last = ""
    @State private var phone = ""

    var body: some View {
        Form {
            Section("Your details") {
                TextField("First name", text: $first)
                TextField("Last name",  text: $last)
                TextField("Phone",      text: $phone).keyboardType(.phonePad)
            }
            Section {
                Button("Finish setup") { }.buttonStyle(.primaryCTA)
            }
        }
        .navigationTitle("Profile setup")
    }
}
