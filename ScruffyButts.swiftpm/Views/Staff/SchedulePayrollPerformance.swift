import SwiftUI

struct StaffScheduleEditorView: View {
    @EnvironmentObject var data: DataStore
    @State private var weekStart: Date = Calendar.current.startOfDay(for: Date())

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(data.staff.filter { $0.active }) { s in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(s.fullName).font(.headline)
                        let weekShifts = data.shifts
                            .filter { $0.staffId == s.id }
                            .sorted(by: { $0.start < $1.start })
                        if weekShifts.isEmpty {
                            Text("No scheduled shifts").foregroundStyle(.secondary)
                        } else {
                            ForEach(weekShifts) { shift in
                                HStack {
                                    Text(shift.start.formatted(.dateTime.weekday(.abbreviated).month().day()))
                                        .font(.subheadline.bold())
                                    Spacer()
                                    Text("\(shift.start.formatted(.dateTime.hour().minute())) – \(shift.end.formatted(.dateTime.hour().minute()))")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .card()
                }
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Schedule")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct RunPayrollView: View {
    @EnvironmentObject var data: DataStore

    var body: some View {
        List {
            Section {
                ForEach(data.staff.filter { $0.active }) { s in
                    NavigationLink {
                        StaffPayrollBreakdownView(staff: s)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(s.fullName).font(.headline)
                                Text(s.role.label).font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(Format.money(estimatedPay(for: s)))
                                .font(.subheadline.bold())
                                .foregroundStyle(Theme.success)
                        }
                    }
                }
            } header: {
                Text("Estimated this period")
            }
            Section {
                Button {
                    // Simulate payroll run
                    data.addActivity(.expenseAdded,
                                     title: "Payroll run",
                                     subtitle: Format.money(totalPayroll))
                } label: {
                    HStack { Spacer(); Text("Run payroll • \(Format.money(totalPayroll))").font(.headline); Spacer() }
                }
                .listRowBackground(Theme.accent)
                .foregroundStyle(.white)
            }
        }
        .navigationTitle("Run payroll")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var totalPayroll: Double {
        data.staff.filter { $0.active }.reduce(0) { $0 + estimatedPay(for: $1) }
    }

    private func estimatedPay(for member: Staff) -> Double {
        switch member.compensationType {
        case .hourly:     return member.rate * 80    // 2-week period
        case .salary:     return member.rate / 26   // bi-weekly
        case .commission:
            let earned = data.payments.reduce(0) { $0 + $1.subtotal }
            return earned * (member.commissionPct / 100) / Double(max(data.staff.count, 1))
        }
    }
}

struct StaffPayrollBreakdownView: View {
    @EnvironmentObject var data: DataStore
    var staff: Staff

    var body: some View {
        Form {
            Section("Summary") {
                LabeledContent("Type", value: staff.compensationType.label)
                switch staff.compensationType {
                case .hourly:
                    LabeledContent("Hours (2 wk)", value: "80")
                    LabeledContent("Rate", value: "\(Format.money(staff.rate)) / hr")
                    LabeledContent("Gross", value: Format.money(staff.rate * 80))
                case .salary:
                    LabeledContent("Annual", value: Format.money(staff.rate))
                    LabeledContent("Bi-weekly", value: Format.money(staff.rate / 26))
                case .commission:
                    LabeledContent("Commission %", value: "\(Int(staff.commissionPct))%")
                }
            }
            Section("Recent shifts") {
                let shifts = data.shifts.filter { $0.staffId == staff.id }
                                        .sorted(by: { $0.start > $1.start })
                                        .prefix(10)
                if shifts.isEmpty {
                    Text("No shifts logged").foregroundStyle(.secondary)
                } else {
                    ForEach(Array(shifts)) { shift in
                        HStack {
                            Text(shift.start.formatted(.dateTime.month().day()))
                            Spacer()
                            Text("\(shift.start.formatted(.dateTime.hour().minute())) – \(shift.end.formatted(.dateTime.hour().minute()))")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("\(staff.fullName) — payroll")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StaffPerformanceView: View {
    @EnvironmentObject var data: DataStore

    var body: some View {
        List {
            ForEach(data.staff.filter { $0.role == .groomer || $0.role == .bather }) { s in
                let count = data.appointments.filter { $0.staffId == s.id }.count
                let completed = data.appointments.filter { $0.staffId == s.id && $0.status == .completed }.count
                VStack(alignment: .leading, spacing: 6) {
                    Text(s.fullName).font(.headline)
                    HStack(spacing: 16) {
                        StatChip(label: "Booked", value: "\(count)", tint: Theme.accent)
                        StatChip(label: "Done",   value: "\(completed)", tint: Theme.success)
                        StatChip(label: "Rate",
                                 value: count == 0 ? "—" : "\(Int(Double(completed)/Double(count)*100))%",
                                 tint: Theme.warning)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Performance")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StatChip: View {
    var label: String
    var value: String
    var tint: Color
    var body: some View {
        VStack {
            Text(value).font(.headline).foregroundStyle(tint)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tint.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
