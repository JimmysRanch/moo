import SwiftUI

struct StaffView: View {
    @EnvironmentObject private var data: DataStore
    @State private var showingNew = false
    @State private var showingInvite = false

    var body: some View {
        List(data.staff) { s in
            NavigationLink(destination: StaffProfileView(staffId: s.id)) {
                HStack(spacing: 12) {
                    AvatarCircle(initials: s.initials)
                    VStack(alignment: .leading) {
                        Text(s.name).font(.subheadline.weight(.semibold))
                        Text(s.role).font(.caption).foregroundStyle(Theme.mutedText)
                    }
                    Spacer()
                    if !s.active { StatusPill(text: "Inactive", tint: Theme.mutedText) }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Staff")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Add staff member")  { showingNew    = true }
                    Button("Invite staff")      { showingInvite = true }
                } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingNew)    { NavigationStack { CreateStaffMemberView() } }
        .sheet(isPresented: $showingInvite) { NavigationStack { InviteStaffView() } }
    }
}

struct StaffProfileView: View {
    @EnvironmentObject private var data: DataStore
    let staffId: UUID

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let s = data.staffMember(staffId) {
                    HStack(spacing: 14) {
                        AvatarCircle(initials: s.initials, size: 64)
                        VStack(alignment: .leading) {
                            Text(s.name).font(.title3.weight(.semibold))
                            Text(s.role).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                    }.cardStyle()

                    SectionCard("Contact") {
                        VStack(alignment: .leading, spacing: 6) {
                            Label(s.email, systemImage: "envelope")
                            Label(s.phone, systemImage: "phone")
                            Label("Hired \(DateFmt.dayMonthYear.string(from: s.hireDate))",
                                  systemImage: "calendar")
                        }.font(.subheadline)
                    }

                    SectionCard("Compensation") {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Hourly: \(Money.format(cents: s.hourlyRateCents))",
                                  systemImage: "clock")
                            Label("Commission: \(Int(s.commissionPercent * 100))%",
                                  systemImage: "percent")
                        }.font(.subheadline)
                    }

                    SectionCard("Today") {
                        let today = data.appointments(forStaff: s.id)
                            .filter { Calendar.current.isDateInToday($0.start) }
                            .sorted { $0.start < $1.start }
                        if today.isEmpty {
                            EmptyState(title: "No appointments today",
                                       message: "Their schedule is open.",
                                       systemImage: "calendar")
                        } else {
                            VStack(spacing: 6) {
                                ForEach(today) { a in AppointmentRow(appointment: a) }
                            }
                        }
                    }

                    HStack {
                        NavigationLink("Edit schedule",
                                       destination: StaffScheduleEditorView(staffId: s.id))
                        Spacer()
                        NavigationLink("Payroll",
                                       destination: StaffPayrollBreakdownView(staffId: s.id))
                    }.padding(.horizontal, 4)
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(data.staffMember(staffId)?.name ?? "Staff")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let s = data.staffMember(staffId) {
                    NavigationLink(destination: EditStaffView(staff: s)) {
                        Image(systemName: "pencil")
                    }
                }
            }
        }
    }
}

struct CreateStaffMemberView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var first = ""
    @State private var last  = ""
    @State private var role  = "Groomer"
    @State private var email = ""
    @State private var phone = ""
    @State private var hourly: Double = 20
    @State private var commission: Double = 0.30

    var body: some View {
        Form {
            Section("Name") {
                TextField("First", text: $first)
                TextField("Last",  text: $last)
            }
            Section("Role") {
                TextField("Title", text: $role)
            }
            Section("Contact") {
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Phone", text: $phone).keyboardType(.phonePad)
            }
            Section("Compensation") {
                Stepper("Hourly: $\(String(format: "%.2f", hourly))",
                        value: $hourly, in: 0...200, step: 0.5)
                Stepper("Commission: \(Int(commission * 100))%",
                        value: $commission, in: 0...0.6, step: 0.05)
            }
        }
        .navigationTitle("New staff member")
        .toolbar {
            ToolbarItem(placement: .topBarLeading)  { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    data.addStaff(StaffMember(
                        id: UUID(), firstName: first, lastName: last, role: role,
                        email: email, phone: phone, hireDate: Date(),
                        hourlyRateCents: Int(hourly * 100),
                        commissionPercent: commission,
                        active: true,
                        avatarSystemImage: "person.crop.circle.fill"))
                    dismiss()
                }
                .disabled(first.isEmpty)
            }
        }
    }
}

struct EditStaffView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State var staff: StaffMember

    var body: some View {
        Form {
            Section("Name") {
                TextField("First", text: $staff.firstName)
                TextField("Last",  text: $staff.lastName)
            }
            Section("Role") {
                TextField("Title", text: $staff.role)
                Toggle("Active", isOn: $staff.active)
            }
            Section("Contact") {
                TextField("Email", text: $staff.email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Phone", text: $staff.phone).keyboardType(.phonePad)
            }
            Section("Compensation") {
                let hourly = Double(staff.hourlyRateCents) / 100
                Stepper("Hourly: \(Money.format(cents: staff.hourlyRateCents))",
                        value: Binding(
                            get: { hourly },
                            set: { staff.hourlyRateCents = Int($0 * 100) }
                        ), in: 0...200, step: 0.5)
                Stepper("Commission: \(Int(staff.commissionPercent * 100))%",
                        value: $staff.commissionPercent, in: 0...0.6, step: 0.05)
            }
        }
        .navigationTitle("Edit staff")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") { data.updateStaff(staff); dismiss() }
            }
        }
    }
}

struct InviteStaffView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var role = "Groomer"
    @State private var sent = false

    var body: some View {
        Form {
            if sent {
                Section { Label("Invite sent to \(email)", systemImage: "checkmark.circle.fill") }
            } else {
                Section("Invite by email") {
                    TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    TextField("Role",  text: $role)
                }
                Section {
                    Button("Send invite") { sent = true }
                        .buttonStyle(.primaryCTA)
                        .disabled(email.isEmpty)
                }
            }
        }
        .navigationTitle("Invite staff")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
        }
    }
}

struct StaffScheduleEditorView: View {
    @EnvironmentObject private var data: DataStore
    let staffId: UUID
    @State private var hours: [Double] = Array(repeating: 8, count: 7)
    private let days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        Form {
            Section("Weekly hours") {
                ForEach(0..<7, id: \.self) { i in
                    Stepper("\(days[i]): \(Int(hours[i]))h",
                            value: Binding(get: { hours[i] }, set: { hours[i] = $0 }),
                            in: 0...12)
                }
            }
            Section { Text("Total: \(Int(hours.reduce(0, +)))h / week").font(.subheadline.weight(.semibold)) }
        }
        .navigationTitle(data.staffMember(staffId)?.name ?? "Schedule")
    }
}

struct StaffPayrollBreakdownView: View {
    @EnvironmentObject private var data: DataStore
    let staffId: UUID

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let s = data.staffMember(staffId) {
                    let cal = Calendar.current
                    let monthStart = cal.dateInterval(of: .month, for: Date())?.start ?? Date()
                    let appts = data.appointments(forStaff: s.id)
                        .filter { $0.start >= monthStart && $0.status == .completed }
                    let serviceCents = appts.compactMap { data.service($0.serviceId)?.priceCents }.reduce(0, +)
                    let commission = Int(Double(serviceCents) * s.commissionPercent)
                    let estHours = appts.reduce(0) { $0 + $1.durationMinutes } / 60
                    let hourly = estHours * s.hourlyRateCents

                    SectionCard("\(s.name) – this month") {
                        VStack(alignment: .leading, spacing: 8) {
                            row("Completed appointments", "\(appts.count)")
                            row("Service revenue",        Money.format(cents: serviceCents))
                            row("Commission (\(Int(s.commissionPercent * 100))%)",
                                Money.format(cents: commission))
                            row("Estimated hours",        "\(estHours)h")
                            row("Hourly pay",             Money.format(cents: hourly))
                            Divider()
                            row("Estimated total", Money.format(cents: commission + hourly))
                                .font(.subheadline.weight(.bold))
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Payroll")
    }

    @ViewBuilder
    private func row(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k).foregroundStyle(Theme.mutedText)
            Spacer()
            Text(v).monospacedDigit()
        }
        .font(.subheadline)
    }
}
