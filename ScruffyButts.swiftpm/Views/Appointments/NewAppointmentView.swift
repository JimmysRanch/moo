import SwiftUI

struct NewAppointmentView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    var defaultDate: Date = Date()

    @State private var clientId: UUID?
    @State private var petId: UUID?
    @State private var staffId: UUID?
    @State private var start: Date = Date()
    @State private var duration: Int = 60
    @State private var selectedServiceIds: Set<UUID> = []
    @State private var notes: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Client & pet") {
                    Picker("Client", selection: $clientId) {
                        Text("Choose…").tag(UUID?.none)
                        ForEach(data.clients) { c in
                            Text(c.fullName).tag(Optional(c.id))
                        }
                    }
                    Picker("Pet", selection: $petId) {
                        Text("Choose…").tag(UUID?.none)
                        ForEach(petsForSelectedClient()) { p in
                            Text(p.name).tag(Optional(p.id))
                        }
                    }
                    .disabled(clientId == nil)
                }
                Section("When") {
                    DatePicker("Start", selection: $start)
                    Stepper(value: $duration, in: 15...300, step: 15) {
                        Text("Duration: \(duration) min")
                    }
                }
                Section("Staff") {
                    Picker("Assigned to", selection: $staffId) {
                        Text("Unassigned").tag(UUID?.none)
                        ForEach(data.staff.filter { $0.active }) { s in
                            Text("\(s.fullName) — \(s.role.label)").tag(Optional(s.id))
                        }
                    }
                }
                Section("Services") {
                    ForEach(data.services) { svc in
                        Button {
                            if selectedServiceIds.contains(svc.id) { selectedServiceIds.remove(svc.id) }
                            else { selectedServiceIds.insert(svc.id) }
                        } label: {
                            HStack {
                                Image(systemName: selectedServiceIds.contains(svc.id) ? "checkmark.square.fill" : "square")
                                    .foregroundStyle(Theme.accent)
                                Text(svc.name)
                                Spacer()
                                Text(Format.money(svc.price)).foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 80)
                }
            }
            .navigationTitle("New appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(clientId == nil || petId == nil)
                }
            }
            .onAppear { start = defaultDate }
        }
    }

    private func petsForSelectedClient() -> [Pet] {
        guard let clientId else { return [] }
        return data.pets(for: clientId)
    }

    private func save() {
        guard let clientId, let petId else { return }
        let appt = Appointment(
            clientId: clientId,
            petId: petId,
            staffId: staffId,
            serviceIds: Array(selectedServiceIds),
            start: start,
            durationMinutes: duration,
            notes: notes
        )
        data.upsert(appointment: appt)
        dismiss()
    }
}
