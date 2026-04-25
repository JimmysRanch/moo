import SwiftUI

struct AddClientView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    @State private var firstName = ""
    @State private var lastName  = ""
    @State private var phone     = ""
    @State private var email     = ""
    @State private var address   = ""
    @State private var notes     = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("First name", text: $firstName)
                    TextField("Last name", text: $lastName)
                }
                Section("Contact") {
                    TextField("Phone", text: $phone).keyboardType(.phonePad)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Address", text: $address, axis: .vertical)
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 80)
                }
            }
            .navigationTitle("Add client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let c = Client(firstName: firstName, lastName: lastName,
                                       phone: phone, email: email, address: address, notes: notes)
                        data.upsert(client: c)
                        dismiss()
                    }
                    .disabled(firstName.isEmpty && lastName.isEmpty)
                }
            }
        }
    }
}

struct EditClientView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    @State var client: Client

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("First name", text: $client.firstName)
                    TextField("Last name", text: $client.lastName)
                }
                Section("Contact") {
                    TextField("Phone", text: $client.phone).keyboardType(.phonePad)
                    TextField("Email", text: $client.email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    TextField("Address", text: $client.address, axis: .vertical)
                }
                Section("Notes") {
                    TextEditor(text: $client.notes).frame(minHeight: 80)
                }
                Section {
                    Button(role: .destructive) {
                        data.deleteClient(client.id)
                        dismiss()
                    } label: { Label("Delete client", systemImage: "trash") }
                }
            }
            .navigationTitle("Edit client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        data.upsert(client: client)
                        dismiss()
                    }
                }
            }
        }
    }
}
