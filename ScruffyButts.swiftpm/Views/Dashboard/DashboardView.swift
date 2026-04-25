import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var data: DataStore
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                statGrid
                todaySection
                revenueSection
                activitySection
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Dashboard")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    RecentActivityView()
                } label: {
                    Image(systemName: "bell.fill")
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            PuppyMascot(size: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text("Welcome back")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(auth.currentUser?.businessName ?? "Scruffy Butts")
                    .font(.title2.bold())
            }
            Spacer()
        }
    }

    private var statGrid: some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 12) {
            StatWidget(title: "Today's appts",
                       value: "\(data.appointmentsToday().count)",
                       systemImage: "calendar",
                       tint: Theme.accent)
            StatWidget(title: "Revenue (mo.)",
                       value: Format.money(data.revenueThisMonth()),
                       systemImage: "dollarsign.circle.fill",
                       tint: Theme.success)
            StatWidget(title: "Expenses (mo.)",
                       value: Format.money(data.expensesThisMonth()),
                       systemImage: "minus.circle.fill",
                       tint: Theme.warning)
            StatWidget(title: "Low stock",
                       value: "\(data.lowStockCount())",
                       systemImage: "exclamationmark.triangle.fill",
                       tint: Theme.danger)
        }
    }

    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Today's schedule").font(.headline)
                Spacer()
                NavigationLink("View all") { AppointmentsView() }
                    .font(.subheadline)
            }
            let today = data.appointmentsToday()
            if today.isEmpty {
                EmptyStateView(systemImage: "calendar.badge.exclamationmark",
                               title: "No appointments today",
                               subtitle: "Tap + on the Appointments tab to book one.")
                    .card()
            } else {
                VStack(spacing: 8) {
                    ForEach(today) { appt in
                        NavigationLink {
                            EditAppointmentView(appointment: appt)
                        } label: {
                            AppointmentRow(appointment: appt)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var revenueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Last 10 days revenue").font(.headline)
            RevenueSparkline(payments: data.payments)
                .frame(height: 120)
                .card()
        }
    }

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent activity").font(.headline)
                Spacer()
                NavigationLink("See more") { RecentActivityView() }
                    .font(.subheadline)
            }
            if data.activity.isEmpty {
                EmptyStateView(systemImage: "tray", title: "Nothing yet").card()
            } else {
                VStack(spacing: 0) {
                    ForEach(data.activity.prefix(5)) { e in
                        ActivityRow(event: e)
                        if e.id != data.activity.prefix(5).last?.id { Divider() }
                    }
                }
                .card(padding: 0)
            }
        }
    }
}

struct StatWidget: View {
    var title: String
    var value: String
    var systemImage: String
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: systemImage)
                    .foregroundStyle(tint)
                    .font(.headline)
                Spacer()
            }
            Text(value).font(.title2.bold())
            Text(title).font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}

struct AppointmentRow: View {
    @EnvironmentObject var data: DataStore
    var appointment: Appointment

    var body: some View {
        HStack(spacing: 12) {
            VStack {
                Text(appointment.start.formatted(.dateTime.hour().minute()))
                    .font(.subheadline.bold())
                Text(appointment.start.formatted(.dateTime.month(.abbreviated).day()))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 64)
            Rectangle().fill(Theme.accent).frame(width: 3).cornerRadius(1.5)
            VStack(alignment: .leading, spacing: 2) {
                Text(data.pet(appointment.petId)?.name ?? "Pet")
                    .font(.headline)
                Text(data.client(appointment.clientId)?.fullName ?? "Client")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                let svc = appointment.serviceIds
                    .compactMap { data.service($0)?.name }
                    .joined(separator: " • ")
                if !svc.isEmpty {
                    Text(svc).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            StatusBadge(status: appointment.status)
        }
        .card()
    }
}

struct StatusBadge: View {
    var status: AppointmentStatus
    var body: some View {
        Text(status.label)
            .font(.caption.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
    private var color: Color {
        switch status {
        case .scheduled: return Theme.accent
        case .inProgress: return Theme.warning
        case .completed: return Theme.success
        case .cancelled: return Theme.danger
        case .noShow: return Theme.muted
        }
    }
}

struct ActivityRow: View {
    var event: ActivityEvent
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: event.systemImage)
                .frame(width: 32, height: 32)
                .background(Theme.accentSoft)
                .foregroundStyle(Theme.accent)
                .clipShape(Circle())
            VStack(alignment: .leading) {
                Text(event.title).font(.subheadline.bold())
                Text(event.subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(event.date, style: .relative)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
    }
}

/// Tiny line-chart for revenue trend. Avoids importing the iOS-16-only
/// `Charts` framework so the package builds on the broadest range of
/// Xcode/Swift Playgrounds versions.
struct RevenueSparkline: View {
    var payments: [Payment]

    var body: some View {
        GeometryReader { geo in
            let totals = bucketed()
            let maxV = max(totals.max() ?? 1, 1)
            let minV = totals.min() ?? 0
            let range = max(maxV - minV, 1)
            Path { path in
                guard !totals.isEmpty else { return }
                let stepX = geo.size.width / CGFloat(max(totals.count - 1, 1))
                for (i, v) in totals.enumerated() {
                    let x = CGFloat(i) * stepX
                    let y = geo.size.height - CGFloat((v - minV) / range) * geo.size.height
                    if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else      { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Theme.accent, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        }
    }

    private func bucketed() -> [Double] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return (0..<10).reversed().map { offset -> Double in
            let day = cal.date(byAdding: .day, value: -offset, to: today)!
            return payments
                .filter { cal.isDate($0.date, inSameDayAs: day) }
                .reduce(0) { $0 + $1.total }
        }
    }
}

struct RecentActivityView: View {
    @EnvironmentObject var data: DataStore
    var body: some View {
        List {
            ForEach(data.activity) { e in ActivityRow(event: e) }
        }
        .listStyle(.plain)
        .navigationTitle("Recent activity")
    }
}
