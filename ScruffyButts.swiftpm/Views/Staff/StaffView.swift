import SwiftUI

struct StaffView: View {
    @EnvironmentObject var data: DataStore
    @State private var showInvite = false
    @State private var showAdd = false

    var body: some View {
        List {
            ForEach(data.staff) { s in
                NavigationLink {
                    StaffProfileView(staffId: s.id)
                } label: {
                    StaffRow(member: s)
                }
            }
            .onDelete { idx in
                for i in idx { data.deleteStaff(data.staff[i].id) }
            }

            Section {
                NavigationLink { StaffScheduleEditorView() } label: {
                    Label("Schedule", systemImage: "calendar.badge.clock")
                }
                NavigationLink { RunPayrollView() } label: {
                    Label("Run payroll", systemImage: "dollarsign.square.fill")
                }
                NavigationLink { StaffPerformanceView() } label: {
                    Label("Performance", systemImage: "chart.line.uptrend.xyaxis")
                }
            }
        }
        .navigationTitle("Staff")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { showAdd = true }    label: { Label("Create member", systemImage: "person.badge.plus") }
                    Button { showInvite = true } label: { Label("Invite by email", systemImage: "envelope") }
                } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { CreateStaffMemberView() }
        .sheet(isPresented: $showInvite) { InviteStaffView() }
    }
}

struct StaffRow: View {
    var member: Staff
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.accentSoft).frame(width: 42, height: 42)
                Text(member.initials).font(.subheadline.bold()).foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading) {
                HStack(spacing: 6) {
                    Text(member.fullName).font(.headline)
                    if !member.active {
                        Text("Inactive").font(.caption2)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.muted.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                Text(member.role.label).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}
