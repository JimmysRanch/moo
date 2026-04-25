import SwiftUI

struct EditAppointmentView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss

    @State var appointment: Appointment
    @State private var selectedServiceIds: Set<UUID> = []

    var body: some View {
        Form {
            Section("Status") {
                Picker("Status", selection: $appointment.status) {
                    ForEach(AppointmentStatus.allCases, id: \.self) { s in
                        Text(s.label).tag(s)
                    }
                }
            }
            Section("Client & pet") {
                LabeledContent("Client", value: data.client(appointment.clientId)?.fullName ?? "—")
                LabeledContent("Pet", value: data.pet(appointment.petId)?.name ?? "—")
            }
            Section("When") {
                DatePicker("Start", selection: $appointment.start)
                Stepper(value: $appointment.durationMinutes, in: 15...300, step: 15) {
                    Text("Duration: \(appointment.durationMinutes) min")
                }
                LabeledContent("End", value: appointment.end.formatted(date: .abbreviated, time: .shortened))
            }
            Section("Staff") {
                Picker("Assigned to", selection: $appointment.staffId) {
                    Text("Unassigned").tag(UUID?.none)
                    ForEach(data.staff) { s in
                        Text(s.fullName).tag(Optional(s.id))
                    }
                }
            }
            Section("Services") {
                ForEach(data.services) { svc in
                    Toggle(isOn: Binding(
                        get: { selectedServiceIds.contains(svc.id) },
                        set: { on in
                            if on { selectedServiceIds.insert(svc.id) }
                            else  { selectedServiceIds.remove(svc.id) }
                        })) {
                        HStack {
                            Text(svc.name)
                            Spacer()
                            Text(Format.money(svc.price)).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            Section("Notes") {
                TextEditor(text: $appointment.notes).frame(minHeight: 80)
            }
            Section {
                Button(role: .destructive) {
                    data.deleteAppointment(appointment.id)
                    dismiss()
                } label: {
                    Label("Delete appointment", systemImage: "trash")
                }
            }
        }
        .navigationTitle("Edit appointment")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    appointment.serviceIds = Array(selectedServiceIds)
                    data.upsert(appointment: appointment)
                    dismiss()
                }
            }
        }
        .onAppear {
            selectedServiceIds = Set(appointment.serviceIds)
        }
    }
}
