import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var data: DataStore
    @EnvironmentObject private var auth: AuthStore

    private let columns = [GridItem(.adaptive(minimum: 160), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                LazyVGrid(columns: columns, spacing: 12) {
                    StatWidget(title: "Today’s appointments",
                               value: "\(data.todaysAppointments.count)",
                               trend: "+8% wk",
                               systemImage: "calendar.badge.clock",
                               tint: Theme.info)
                    StatWidget(title: "Booked %",
                               value: percent(data.bookedPercentage),
                               trend: "+4%",
                               systemImage: "gauge.with.needle",
                               tint: Theme.primary)
                    StatWidget(title: "Dogs groomed (MTD)",
                               value: "\(data.dogsGroomedThisMonth)",
                               systemImage: "pawprint.fill",
                               tint: Theme.accent)
                    StatWidget(title: "Active clients",
                               value: "\(data.clients.count)",
                               trend: "+\(min(3, data.clients.count))",
                               systemImage: "person.3.fill",
                               tint: Theme.success)
                    StatWidget(title: "Revenue (MTD)",
                               value: Money.format(cents: data.monthToDateRevenueCents),
                               systemImage: "dollarsign.circle.fill",
                               tint: Theme.success)
                    StatWidget(title: "Expenses (MTD)",
                               value: Money.format(cents: data.monthToDateExpensesCents),
                               systemImage: "creditcard.fill",
                               tint: Theme.danger)
                }

                groomersWorkload
                recentActivity
                expenseSummary
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Dashboard")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Sign out", role: .destructive) { auth.signOut() }
                } label: {
                    Image(systemName: "person.crop.circle")
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting()).font(.title2.weight(.bold))
            Text(DateFmt.weekdayDayMonth.string(from: Date()))
                .font(.subheadline).foregroundStyle(Theme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func greeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        let part = (5..<12).contains(hour) ? "Good morning" :
                   (12..<17).contains(hour) ? "Good afternoon" : "Good evening"
        let name = auth.user?.firstName ?? "there"
        return "\(part), \(name) 👋"
    }

    private func percent(_ v: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .percent; f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? "0%"
    }

    private var groomersWorkload: some View {
        SectionCard("Groomer workload (today)") {
            VStack(spacing: 10) {
                ForEach(data.staff.filter { $0.role.contains("Groomer") || $0.role.contains("Bather") }) { s in
                    let count = data.todaysAppointments.filter { $0.staffId == s.id }.count
                    HStack {
                        AvatarCircle(initials: s.initials)
                        VStack(alignment: .leading) {
                            Text(s.name).font(.subheadline.weight(.semibold))
                            Text(s.role).font(.caption).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        ProgressView(value: Double(min(count, 8)), total: 8)
                            .frame(width: 90)
                        Text("\(count)/8").font(.caption).monospacedDigit()
                            .foregroundStyle(Theme.mutedText)
                    }
                }
            }
        }
    }

    private var recentActivity: some View {
        SectionCard("Recent activity",
                    trailing: NavigationLink("See all", destination: RecentActivityView())) {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(data.activity.prefix(5)) { e in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: e.icon)
                            .foregroundStyle(Theme.primary)
                            .frame(width: 28, height: 28)
                            .background(Theme.primary.opacity(0.15), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.title).font(.subheadline.weight(.semibold))
                            Text(e.subtitle).font(.caption).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        Text(DateFmt.relative(e.date))
                            .font(.caption2)
                            .foregroundStyle(Theme.mutedText)
                    }
                }
            }
        }
    }

    private var expenseSummary: some View {
        SectionCard("Expenses this month",
                    trailing: NavigationLink("Details", destination: ExpensesDetailView())) {
            HStack(alignment: .firstTextBaseline) {
                Text(Money.format(cents: data.monthToDateExpensesCents))
                    .font(.title.weight(.bold))
                Spacer()
                Text("\(data.expenses.count) entries")
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
        }
    }
}

struct RecentActivityView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        List(data.activity) { e in
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: e.icon)
                    .foregroundStyle(Theme.primary)
                    .frame(width: 30, height: 30)
                    .background(Theme.primary.opacity(0.15), in: Circle())
                VStack(alignment: .leading) {
                    Text(e.title).font(.subheadline.weight(.semibold))
                    Text(e.subtitle).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                Text(DateFmt.relative(e.date))
                    .font(.caption2).foregroundStyle(Theme.mutedText)
            }
        }
        .navigationTitle("Recent activity")
    }
}
