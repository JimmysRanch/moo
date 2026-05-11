import SwiftUI

struct AppointmentsView: View {
    @EnvironmentObject private var data: DataStore
    @State private var showingNew = false
    @State private var date = Date()

    var body: some View {
        VStack(spacing: 12) {
            DatePicker("", selection: $date, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding(.horizontal, 16)

            List {
                let day = appointmentsForDay
                if day.isEmpty {
                    EmptyState(title: "No appointments",
                               message: "Nothing booked for this day.",
                               systemImage: "calendar.badge.exclamationmark")
                } else {
                    ForEach(day) { a in
                        NavigationLink {
                            EditAppointmentView(appointment: a)
                        } label: {
                            AppointmentRow(appointment: a)
                        }
                    }
                    .onDelete { idx in
                        for i in idx { data.deleteAppointment(day[i].id) }
                    }
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Appointments")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingNew = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingNew) {
            NavigationStack { NewAppointmentView() }
        }
    }

    private var appointmentsForDay: [Appointment] {
        let cal = Calendar.current
        return data.appointments
            .filter { cal.isDate($0.start, inSameDayAs: date) }
            .sorted { $0.start < $1.start }
    }
}

struct AppointmentRow: View {
    @EnvironmentObject private var data: DataStore
    let appointment: Appointment

    var body: some View {
        HStack(spacing: 12) {
            VStack {
                Text(DateFmt.time.string(from: appointment.start))
                    .font(.footnote.weight(.semibold))
                Text("\(appointment.durationMinutes)m")
                    .font(.caption2).foregroundStyle(Theme.mutedText)
            }
            .frame(width: 60)

            Rectangle()
                .fill(appointment.status.tint)
                .frame(width: 3)
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: 2) {
                if let pet = data.pet(appointment.petId), let client = data.client(appointment.clientId) {
                    Text("\(pet.name) – \(client.name)").font(.subheadline.weight(.semibold))
                }
                if let svc = data.service(appointment.serviceId) {
                    Text(svc.name).font(.caption).foregroundStyle(Theme.mutedText)
                }
                if let staff = data.staffMember(appointment.staffId) {
                    Text("with \(staff.name)").font(.caption2).foregroundStyle(Theme.mutedText)
                }
            }
            Spacer()
            StatusPill(text: appointment.status.label, tint: appointment.status.tint)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Edit / New shared form

struct AppointmentForm: View {
    @EnvironmentObject private var data: DataStore
    @Binding var clientId: UUID?
    @Binding var petId: UUID?
    @Binding var staffId: UUID?
    @Binding var serviceId: UUID?
    @Binding var start: Date
    @Binding var durationMinutes: Int
    @Binding var status: AppointmentStatus
    @Binding var notes: String

    var body: some View {
        Form {
            Section("Client & pet") {
                Picker("Client", selection: Binding($clientId, default: data.clients.first?.id ?? UUID())) {
                    ForEach(data.clients) { c in Text(c.name).tag(c.id) }
                }
                Picker("Pet", selection: Binding($petId, default: pets.first?.id ?? UUID())) {
                    ForEach(pets) { p in Text(p.name).tag(p.id) }
                }
            }
            Section("Service") {
                Picker("Service", selection: Binding($serviceId, default: data.services.first?.id ?? UUID())) {
                    ForEach(data.services) { s in Text("\(s.name) – \(s.price)").tag(s.id) }
                }
                Stepper("Duration: \(durationMinutes)m", value: $durationMinutes, in: 15...240, step: 15)
            }
            Section("When") {
                DatePicker("Starts", selection: $start)
            }
            Section("Staff") {
                Picker("Groomer", selection: Binding($staffId, default: data.staff.first?.id ?? UUID())) {
                    ForEach(data.staff) { s in Text(s.name).tag(s.id) }
                }
            }
            Section("Status") {
                Picker("Status", selection: $status) {
                    ForEach(AppointmentStatus.allCases, id: \.self) { Text($0.label).tag($0) }
                }.pickerStyle(.menu)
            }
            Section("Notes") {
                TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...6)
            }
        }
    }

    private var pets: [Pet] {
        guard let cid = clientId else { return [] }
        return data.pets(forClient: cid)
    }
}

struct NewAppointmentView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var clientId: UUID?
    @State private var petId: UUID?
    @State private var staffId: UUID?
    @State private var serviceId: UUID?
    @State private var start = Date().addingTimeInterval(3600)
    @State private var durationMinutes = 60
    @State private var status: AppointmentStatus = .scheduled
    @State private var notes = ""

    var body: some View {
        AppointmentForm(clientId: $clientId, petId: $petId, staffId: $staffId,
                        serviceId: $serviceId, start: $start, durationMinutes: $durationMinutes,
                        status: $status, notes: $notes)
            .navigationTitle("New appointment")
            .toolbar {
                ToolbarItem(placement: .topBarLeading)  { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("Save") { save() }.disabled(!canSave) }
            }
            .onAppear {
                clientId  = clientId  ?? data.clients.first?.id
                petId     = petId     ?? data.pets.first(where: { $0.clientId == clientId })?.id
                staffId   = staffId   ?? data.staff.first?.id
                serviceId = serviceId ?? data.services.first?.id
            }
    }

    private var canSave: Bool { clientId != nil && petId != nil && staffId != nil && serviceId != nil }

    private func save() {
        guard let c = clientId, let p = petId, let st = staffId, let sv = serviceId else { return }
        data.addAppointment(Appointment(id: UUID(), clientId: c, petId: p, staffId: st,
                                        serviceId: sv, start: start,
                                        durationMinutes: durationMinutes,
                                        status: status, notes: notes))
        dismiss()
    }
}

struct EditAppointmentView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var working: Appointment

    init(appointment: Appointment) { _working = State(initialValue: appointment) }

    var body: some View {
        AppointmentForm(
            clientId:  Binding(get: { working.clientId  }, set: { working.clientId = $0 ?? working.clientId }),
            petId:     Binding(get: { working.petId     }, set: { working.petId = $0 ?? working.petId }),
            staffId:   Binding(get: { working.staffId   }, set: { working.staffId = $0 ?? working.staffId }),
            serviceId: Binding(get: { working.serviceId }, set: { working.serviceId = $0 ?? working.serviceId }),
            start:           $working.start,
            durationMinutes: $working.durationMinutes,
            status:          $working.status,
            notes:           $working.notes
        )
        .navigationTitle("Edit appointment")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    data.updateAppointment(working)
                    dismiss()
                }
            }
        }
    }
}

// MARK: - Optional binding helper

private extension Binding where Value: Equatable {
    init(_ source: Binding<Value?>, default value: Value) {
        self.init(
            get: { source.wrappedValue ?? value },
            set: { source.wrappedValue = $0 }
        )
    }
}
