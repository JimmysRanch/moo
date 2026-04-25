import SwiftUI

// MARK: - Clients list

struct ClientsListView: View {
    @EnvironmentObject private var data: DataStore
    @State private var search = ""
    @State private var showingAdd = false

    var body: some View {
        List {
            ForEach(filtered) { c in
                NavigationLink(destination: ClientProfileView(clientId: c.id)) {
                    ClientRow(client: c)
                }
            }
            .onDelete { idx in
                for i in idx { data.deleteClient(filtered[i].id) }
            }
        }
        .listStyle(.plain)
        .searchable(text: $search, prompt: "Search clients")
        .navigationTitle("Clients")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingAdd) {
            NavigationStack { AddClientView() }
        }
        .overlay { if data.clients.isEmpty {
            EmptyState(title: "No clients yet", message: "Tap + to add your first client.",
                       systemImage: "person.2.slash")
        }}
    }

    private var filtered: [Client] {
        let q = search.lowercased()
        let base = data.clients.sorted { $0.name < $1.name }
        guard !q.isEmpty else { return base }
        return base.filter {
            $0.name.lowercased().contains(q) ||
            $0.email.lowercased().contains(q) ||
            $0.phone.contains(q)
        }
    }
}

struct ClientRow: View {
    @EnvironmentObject private var data: DataStore
    let client: Client
    var body: some View {
        HStack(spacing: 12) {
            AvatarCircle(initials: client.initials)
            VStack(alignment: .leading, spacing: 2) {
                Text(client.name).font(.subheadline.weight(.semibold))
                let pets = data.pets(forClient: client.id).map(\.name).joined(separator: ", ")
                if !pets.isEmpty {
                    Text(pets).font(.caption).foregroundStyle(Theme.mutedText)
                }
            }
            Spacer()
            Text(client.phone).font(.caption2).foregroundStyle(Theme.mutedText)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Client profile

struct ClientProfileView: View {
    @EnvironmentObject private var data: DataStore
    let clientId: UUID

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let c = data.client(clientId) {
                    SectionCard("Contact") {
                        VStack(alignment: .leading, spacing: 6) {
                            Label(c.email, systemImage: "envelope")
                            Label(c.phone, systemImage: "phone")
                            if !c.notes.isEmpty {
                                Label(c.notes, systemImage: "note.text")
                            }
                        }.font(.subheadline)
                    }
                    SectionCard("Pets",
                                trailing: NavigationLink("Add pet", destination: AddPetView(clientId: clientId))) {
                        VStack(spacing: 8) {
                            ForEach(data.pets(forClient: clientId)) { p in
                                NavigationLink(destination: EditPetView(pet: p)) {
                                    PetCard(pet: p)
                                }.buttonStyle(.plain)
                            }
                            if data.pets(forClient: clientId).isEmpty {
                                EmptyState(title: "No pets", message: "Add a pet to start booking.",
                                           systemImage: "pawprint")
                            }
                        }
                    }
                    SectionCard("Recent appointments") {
                        VStack(spacing: 8) {
                            let recent = data.appointments(forClient: clientId)
                                .sorted { $0.start > $1.start }.prefix(5)
                            ForEach(Array(recent)) { a in AppointmentRow(appointment: a) }
                            if recent.isEmpty {
                                EmptyState(title: "No appointments yet", message: "Booked appointments will appear here.",
                                           systemImage: "calendar")
                            }
                        }
                    }
                    HStack {
                        NavigationLink("Payment history",
                                       destination: PaymentHistoryView(clientId: clientId))
                        Spacer()
                        NavigationLink("Contact info",
                                       destination: ContactInfoView(clientId: clientId))
                    }
                    .padding(.horizontal, 4)
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(data.client(clientId)?.name ?? "Client")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let c = data.client(clientId) {
                    NavigationLink(destination: EditClientView(client: c)) {
                        Image(systemName: "pencil")
                    }
                }
            }
        }
    }
}

struct PetCard: View {
    let pet: Pet
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.accent.opacity(0.18))
                Image(systemName: pet.photoSystemImage).foregroundStyle(Theme.accent)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(pet.name).font(.subheadline.weight(.semibold))
                Text("\(pet.breed) • \(Int(pet.weightLbs)) lb")
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Theme.mutedText).font(.caption)
        }
        .padding(8)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Add / edit client

struct AddClientView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var first = ""
    @State private var last  = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var notes = ""

    var body: some View {
        Form {
            Section("Name") {
                TextField("First", text: $first)
                TextField("Last",  text: $last)
            }
            Section("Contact") {
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Phone", text: $phone).keyboardType(.phonePad)
            }
            Section("Notes") {
                TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...6)
            }
        }
        .navigationTitle("New client")
        .toolbar {
            ToolbarItem(placement: .topBarLeading)  { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    data.addClient(Client(id: UUID(), firstName: first, lastName: last,
                                          email: email, phone: phone, notes: notes,
                                          createdAt: Date()))
                    dismiss()
                }
                .disabled(first.isEmpty)
            }
        }
    }
}

struct EditClientView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State var client: Client

    var body: some View {
        Form {
            Section("Name") {
                TextField("First", text: $client.firstName)
                TextField("Last",  text: $client.lastName)
            }
            Section("Contact") {
                TextField("Email", text: $client.email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Phone", text: $client.phone).keyboardType(.phonePad)
            }
            Section("Notes") {
                TextField("Notes", text: $client.notes, axis: .vertical).lineLimit(3...6)
            }
            Section {
                Button("Delete client", role: .destructive) {
                    data.deleteClient(client.id); dismiss()
                }
            }
        }
        .navigationTitle("Edit client")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") { data.updateClient(client); dismiss() }
            }
        }
    }
}

// MARK: - Pet add / edit

struct AddPetView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    let clientId: UUID
    @State private var name = ""
    @State private var breed = ""
    @State private var weight: Double = 25
    @State private var notes = ""
    @State private var grooming = ""
    @State private var medical = ""

    var body: some View {
        Form {
            Section("Basics") {
                TextField("Name", text: $name)
                TextField("Breed", text: $breed)
                Stepper("Weight: \(Int(weight)) lb", value: $weight, in: 1...250)
            }
            Section("Care") {
                TextField("Grooming preferences", text: $grooming, axis: .vertical).lineLimit(2...4)
                TextField("Medical notes",        text: $medical,  axis: .vertical).lineLimit(2...4)
                TextField("General notes",        text: $notes,    axis: .vertical).lineLimit(2...4)
            }
        }
        .navigationTitle("Add pet")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    data.addPet(Pet(id: UUID(), clientId: clientId, name: name, breed: breed,
                                    weightLbs: weight, birthday: nil, notes: notes,
                                    groomingPreferences: grooming, medicalNotes: medical,
                                    photoSystemImage: "pawprint.fill"))
                    dismiss()
                }
                .disabled(name.isEmpty)
            }
        }
    }
}

struct EditPetView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State var pet: Pet

    var body: some View {
        Form {
            Section("Basics") {
                TextField("Name", text: $pet.name)
                TextField("Breed", text: $pet.breed)
                Stepper("Weight: \(Int(pet.weightLbs)) lb",
                        value: $pet.weightLbs, in: 1...250)
            }
            Section("Care") {
                TextField("Grooming preferences", text: $pet.groomingPreferences, axis: .vertical).lineLimit(2...4)
                TextField("Medical notes",        text: $pet.medicalNotes, axis: .vertical).lineLimit(2...4)
                TextField("General notes",        text: $pet.notes, axis: .vertical).lineLimit(2...4)
            }
            Section {
                Button("Delete pet", role: .destructive) {
                    data.deletePet(pet.id); dismiss()
                }
            }
        }
        .navigationTitle("Edit pet")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") { data.updatePet(pet); dismiss() }
            }
        }
    }
}

// MARK: - Contact info & payment history

struct ContactInfoView: View {
    @EnvironmentObject private var data: DataStore
    let clientId: UUID
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let c = data.client(clientId) {
                    SectionCard("Email") { Text(c.email) }
                    SectionCard("Phone") { Text(c.phone) }
                    SectionCard("Notes") { Text(c.notes.isEmpty ? "—" : c.notes) }
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Contact info")
    }
}

struct PaymentHistoryView: View {
    @EnvironmentObject private var data: DataStore
    let clientId: UUID
    var body: some View {
        let receipts = data.receipts.filter { $0.clientId == clientId }
            .sorted { $0.date > $1.date }
        List(receipts) { r in
            HStack {
                VStack(alignment: .leading) {
                    Text(DateFmt.dayMonthYear.string(from: r.date)).font(.subheadline.weight(.semibold))
                    Text(r.paymentMethod.label).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                Text(Money.format(cents: r.totalCents)).monospacedDigit()
            }
        }
        .overlay { if receipts.isEmpty {
            EmptyState(title: "No payments", message: "Receipts will appear here once issued.",
                       systemImage: "creditcard")
        }}
        .navigationTitle("Payment history")
    }
}
