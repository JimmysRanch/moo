import SwiftUI

struct CreateStaffMemberView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var role: StaffRole = .groomer
    @State private var email = ""
    @State private var phone = ""
    @State private var compType: CompensationType = .hourly
    @State private var rate: Double = 18
    @State private var commissionPct: Double = 40

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("First name", text: $firstName)
                    TextField("Last name", text: $lastName)
                    Picker("Role", selection: $role) {
                        ForEach(StaffRole.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                }
                Section("Contact") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Phone", text: $phone).keyboardType(.phonePad)
                }
                Section("Compensation") {
                    Picker("Type", selection: $compType) {
                        ForEach(CompensationType.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    switch compType {
                    case .hourly:
                        HStack { Text("Rate $/hr"); Spacer(); TextField("Rate", value: $rate, format: .number)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    case .salary:
                        HStack { Text("Annual"); Spacer(); TextField("Salary", value: $rate, format: .number)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    case .commission:
                        Stepper(value: $commissionPct, in: 0...100, step: 5) { Text("Commission \(Int(commissionPct))%") }
                    }
                }
            }
            .navigationTitle("New staff member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let m = Staff(firstName: firstName, lastName: lastName, role: role,
                                      email: email, phone: phone,
                                      compensationType: compType, rate: rate, commissionPct: commissionPct)
                        data.upsert(staff: m)
                        dismiss()
                    }
                    .disabled(firstName.isEmpty || email.isEmpty)
                }
            }
        }
    }
}

struct EditStaffView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State var member: Staff

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("First name", text: $member.firstName)
                    TextField("Last name",  text: $member.lastName)
                    Picker("Role", selection: $member.role) {
                        ForEach(StaffRole.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    Toggle("Active", isOn: $member.active)
                }
                Section("Contact") {
                    TextField("Email", text: $member.email)
                    TextField("Phone", text: $member.phone)
                }
                Section("Compensation") {
                    Picker("Type", selection: $member.compensationType) {
                        ForEach(CompensationType.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    switch member.compensationType {
                    case .hourly:
                        HStack { Text("Rate $/hr"); Spacer()
                            TextField("Rate", value: $member.rate, format: .number)
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    case .salary:
                        HStack { Text("Annual"); Spacer()
                            TextField("Salary", value: $member.rate, format: .number)
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    case .commission:
                        Stepper(value: $member.commissionPct, in: 0...100, step: 5) {
                            Text("Commission \(Int(member.commissionPct))%")
                        }
                    }
                }
                Section {
                    Button(role: .destructive) {
                        data.deleteStaff(member.id)
                        dismiss()
                    } label: { Label("Delete staff member", systemImage: "trash") }
                }
            }
            .navigationTitle("Edit staff")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        data.upsert(staff: member)
                        dismiss()
                    }
                }
            }
        }
    }
}

struct InviteStaffView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var role: StaffRole = .groomer
    @State private var sent = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Send invitation") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Picker("Role", selection: $role) {
                        ForEach(StaffRole.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                }
                if sent {
                    Section {
                        Label("Invitation sent (simulated).", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(Theme.success)
                    }
                }
                Section {
                    Button {
                        sent = true
                    } label: {
                        HStack { Spacer(); Text("Send invite").font(.headline); Spacer() }
                    }
                    .listRowBackground(Theme.accent)
                    .foregroundStyle(.white)
                    .disabled(email.isEmpty)
                }
            }
            .navigationTitle("Invite staff")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }
}
