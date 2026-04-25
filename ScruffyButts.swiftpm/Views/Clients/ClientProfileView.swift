import SwiftUI

struct ClientProfileView: View {
    @EnvironmentObject var data: DataStore
    var clientId: UUID

    @State private var showEdit = false
    @State private var showAddPet = false

    private var client: Client? { data.client(clientId) }

    var body: some View {
        Group {
            if let client {
                List {
                    Section {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().fill(Theme.accentSoft).frame(width: 60, height: 60)
                                Text(client.initials).font(.title3.bold()).foregroundStyle(Theme.accent)
                            }
                            VStack(alignment: .leading) {
                                Text(client.fullName).font(.title2.bold())
                                Text(client.phone).foregroundStyle(.secondary)
                                Text(client.email).foregroundStyle(.secondary).font(.subheadline)
                            }
                        }
                        if !client.address.isEmpty {
                            LabeledContent("Address", value: client.address)
                        }
                        if !client.notes.isEmpty {
                            VStack(alignment: .leading) {
                                Text("Notes").font(.caption).foregroundStyle(.secondary)
                                Text(client.notes)
                            }
                        }
                    }

                    Section {
                        ForEach(data.pets(for: client.id)) { pet in
                            NavigationLink {
                                EditPetView(pet: pet)
                            } label: {
                                PetRow(pet: pet)
                            }
                        }
                        Button { showAddPet = true } label: {
                            Label("Add pet", systemImage: "plus.circle.fill")
                        }
                    } header: { Text("Pets") }

                    Section {
                        ForEach(upcoming) { appt in
                            NavigationLink {
                                EditAppointmentView(appointment: appt)
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(data.pet(appt.petId)?.name ?? "Pet").font(.subheadline.bold())
                                    Text(Format.dayTime(appt.start)).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if upcoming.isEmpty { Text("No upcoming appointments").foregroundStyle(.secondary) }
                    } header: { Text("Upcoming appointments") }
                }
                .navigationTitle(client.fullName)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Edit") { showEdit = true }
                    }
                }
                .sheet(isPresented: $showEdit) { EditClientView(client: client) }
                .sheet(isPresented: $showAddPet) { AddPetView(clientId: client.id) }
            } else {
                EmptyStateView(systemImage: "person.crop.circle.badge.xmark",
                               title: "Client not found")
            }
        }
    }

    private var upcoming: [Appointment] {
        data.appointments
            .filter { $0.clientId == clientId && $0.start >= Calendar.current.startOfDay(for: Date()) }
            .sorted(by: { $0.start < $1.start })
    }
}

struct PetRow: View {
    var pet: Pet
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "pawprint.fill")
                .frame(width: 38, height: 38)
                .background(Theme.accentSoft).foregroundStyle(Theme.accent)
                .clipShape(Circle())
            VStack(alignment: .leading) {
                Text(pet.name).font(.headline)
                Text("\(pet.breed) • \(Int(pet.weightLb)) lb")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}
