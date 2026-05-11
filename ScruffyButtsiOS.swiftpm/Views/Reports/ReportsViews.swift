import SwiftUI

struct ReportsView: View {
    @EnvironmentObject private var data: DataStore

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                NavigationLink(destination: GroomerPerformanceReport()) {
                    SectionCard("Groomer performance") {
                        Text("Service revenue, completed appointments, and commission per staff member.")
                            .font(.subheadline).foregroundStyle(Theme.mutedText)
                    }
                }.buttonStyle(.plain)

                NavigationLink(destination: RevenueReport()) {
                    SectionCard("Revenue") {
                        Text("Receipts grouped by day for the last 30 days.")
                            .font(.subheadline).foregroundStyle(Theme.mutedText)
                    }
                }.buttonStyle(.plain)

                NavigationLink(destination: ClientsReport()) {
                    SectionCard("Clients") {
                        Text("Top clients by spend and frequency.")
                            .font(.subheadline).foregroundStyle(Theme.mutedText)
                    }
                }.buttonStyle(.plain)
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Reports")
    }
}

struct GroomerPerformanceReport: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        List(data.staff) { s in
            let cal = Calendar.current
            let monthStart = cal.dateInterval(of: .month, for: Date())?.start ?? Date()
            let appts = data.appointments(forStaff: s.id)
                .filter { $0.start >= monthStart && $0.status == .completed }
            let revenue = appts.compactMap { data.service($0.serviceId)?.priceCents }.reduce(0, +)
            HStack {
                AvatarCircle(initials: s.initials)
                VStack(alignment: .leading) {
                    Text(s.name).font(.subheadline.weight(.semibold))
                    Text("\(appts.count) appts").font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                Text(Money.format(cents: revenue)).monospacedDigit()
            }
        }
        .navigationTitle("Groomer performance")
    }
}

struct RevenueReport: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        let cal = Calendar.current
        let buckets: [(Date, Int)] = (0..<30).reversed().compactMap { offset in
            guard let day = cal.date(byAdding: .day, value: -offset, to: Date()) else { return nil }
            let total = data.receipts
                .filter { cal.isDate($0.date, inSameDayAs: day) }
                .reduce(0) { $0 + $1.totalCents }
            return (day, total)
        }
        let maxV = max(1, buckets.map(\.1).max() ?? 1)

        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SectionCard("Last 30 days") {
                    HStack(alignment: .bottom, spacing: 4) {
                        ForEach(buckets, id: \.0) { entry in
                            VStack {
                                Capsule()
                                    .fill(Theme.primary)
                                    .frame(width: 6, height: max(2, CGFloat(entry.1) / CGFloat(maxV) * 120))
                            }
                        }
                    }.frame(height: 130, alignment: .bottom)
                }
                SectionCard("Totals") {
                    let total = buckets.reduce(0) { $0 + $1.1 }
                    HStack { Text("Revenue"); Spacer(); Text(Money.format(cents: total)).monospacedDigit() }
                    HStack { Text("Days with sales"); Spacer(); Text("\(buckets.filter { $0.1 > 0 }.count)") }
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Revenue")
    }
}

struct ClientsReport: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        let totals: [(Client, Int)] = data.clients.map { c in
            let total = data.receipts.filter { $0.clientId == c.id }.reduce(0) { $0 + $1.totalCents }
            return (c, total)
        }.sorted { $0.1 > $1.1 }

        List(totals, id: \.0.id) { (c, total) in
            HStack {
                AvatarCircle(initials: c.initials)
                Text(c.name)
                Spacer()
                Text(Money.format(cents: total)).monospacedDigit()
            }
        }
        .navigationTitle("Top clients")
    }
}
