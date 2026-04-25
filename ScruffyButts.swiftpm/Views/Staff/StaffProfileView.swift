import SwiftUI

struct StaffProfileView: View {
    @EnvironmentObject var data: DataStore
    var staffId: UUID
    @State private var showEdit = false

    private var member: Staff? { data.staffMember(staffId) }

    var body: some View {
        Group {
            if let member {
                Form {
                    Section {
                        HStack {
                            ZStack {
                                Circle().fill(Theme.accentSoft).frame(width: 60, height: 60)
                                Text(member.initials).font(.title3.bold()).foregroundStyle(Theme.accent)
                            }
                            VStack(alignment: .leading) {
                                Text(member.fullName).font(.title2.bold())
                                Text(member.role.label).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Section("Contact") {
                        LabeledContent("Email", value: member.email)
                        if !member.phone.isEmpty {
                            LabeledContent("Phone", value: member.phone)
                        }
                    }
                    Section("Compensation") {
                        LabeledContent("Type", value: member.compensationType.label)
                        switch member.compensationType {
                        case .hourly:    LabeledContent("Rate", value: "\(Format.money(member.rate)) / hr")
                        case .salary:    LabeledContent("Annual", value: Format.money(member.rate))
                        case .commission:LabeledContent("Commission", value: "\(Int(member.commissionPct))%")
                        }
                    }
                    Section("Status") {
                        LabeledContent("Active", value: member.active ? "Yes" : "No")
                        LabeledContent("Hired", value: Format.shortDate(member.hireDate))
                    }
                }
                .navigationTitle(member.fullName)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Edit") { showEdit = true }
                    }
                }
                .sheet(isPresented: $showEdit) { EditStaffView(member: member) }
            } else {
                EmptyStateView(systemImage: "person.crop.circle.badge.xmark",
                               title: "Staff member not found")
            }
        }
    }
}
