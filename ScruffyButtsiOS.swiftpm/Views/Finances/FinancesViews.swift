import SwiftUI

struct FinancesView: View {
    @EnvironmentObject private var data: DataStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                    StatWidget(title: "Revenue (MTD)",
                               value: Money.format(cents: data.monthToDateRevenueCents),
                               systemImage: "dollarsign.circle.fill", tint: Theme.success)
                    StatWidget(title: "Expenses (MTD)",
                               value: Money.format(cents: data.monthToDateExpensesCents),
                               systemImage: "creditcard.fill", tint: Theme.danger)
                    StatWidget(title: "Net (MTD)",
                               value: Money.format(cents: data.monthToDateRevenueCents - data.monthToDateExpensesCents),
                               systemImage: "chart.line.uptrend.xyaxis", tint: Theme.primary)
                    StatWidget(title: "Bills due (30d)",
                               value: "\(data.bills.filter { $0.dueDate <= Date().addingTimeInterval(30*24*3600) && !$0.paid }.count)",
                               systemImage: "calendar.badge.exclamationmark", tint: Theme.warning)
                }

                SectionCard("Quick actions") {
                    VStack(spacing: 8) {
                        NavigationLink("Expense detail",     destination: ExpensesDetailView())
                        NavigationLink("All expenses",       destination: AllExpensesView())
                        NavigationLink("Add expense",        destination: AddExpenseView())
                        NavigationLink("Upcoming bills",     destination: UpcomingBillsView())
                        NavigationLink("File taxes",         destination: FileTaxesView())
                        NavigationLink("Run payroll",        destination: RunPayrollView())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Finances")
    }
}

struct ExpensesDetailView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        let byCategory = Dictionary(grouping: data.expenses) { $0.category }
            .map { (cat: $0.key, total: $0.value.reduce(0) { $0 + $1.amountCents }) }
            .sorted { $0.total > $1.total }
        List {
            Section("By category") {
                ForEach(byCategory, id: \.cat) { entry in
                    HStack {
                        Text(entry.cat.label)
                        Spacer()
                        Text(Money.format(cents: entry.total)).monospacedDigit()
                    }
                }
            }
        }
        .navigationTitle("Expenses detail")
    }
}

struct AllExpensesView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        List(data.expenses.sorted { $0.date > $1.date }) { e in
            HStack {
                VStack(alignment: .leading) {
                    Text(e.vendor).font(.subheadline.weight(.semibold))
                    Text(e.category.label).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text(Money.format(cents: e.amountCents)).monospacedDigit()
                    Text(DateFmt.dayMonth.string(from: e.date))
                        .font(.caption2).foregroundStyle(Theme.mutedText)
                }
            }
        }
        .navigationTitle("All expenses")
    }
}

struct AddExpenseView: View {
    @EnvironmentObject private var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var vendor = ""
    @State private var category: ExpenseCategory = .supplies
    @State private var amount: Double = 0
    @State private var date = Date()
    @State private var notes = ""
    @State private var recurring = false

    var body: some View {
        Form {
            Section("Expense") {
                TextField("Vendor", text: $vendor)
                Picker("Category", selection: $category) {
                    ForEach(ExpenseCategory.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                TextField("Amount", value: $amount, format: .currency(code: "USD"))
                    .keyboardType(.decimalPad)
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Toggle("Recurring", isOn: $recurring)
            }
            Section("Notes") {
                TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...6)
            }
        }
        .navigationTitle("Add expense")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    data.addExpense(Expense(id: UUID(), date: date, vendor: vendor,
                                            category: category, amountCents: Int(amount * 100),
                                            notes: notes, recurring: recurring))
                    dismiss()
                }.disabled(vendor.isEmpty || amount <= 0)
            }
        }
    }
}

struct UpcomingBillsView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        let sortedIds = data.bills
            .sorted { $0.dueDate < $1.dueDate }
            .map(\.id)
        List {
            ForEach(sortedIds, id: \.self) { id in
                if let idx = data.bills.firstIndex(where: { $0.id == id }) {
                    let bill = data.bills[idx]
                    HStack {
                        VStack(alignment: .leading) {
                            Text(bill.name).font(.subheadline.weight(.semibold))
                            Text("Due \(DateFmt.dayMonthYear.string(from: bill.dueDate))")
                                .font(.caption).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        Text(Money.format(cents: bill.amountCents)).monospacedDigit()
                        Toggle("", isOn: Binding(
                            get: { data.bills[idx].paid },
                            set: { data.bills[idx].paid = $0 }
                        )).labelsHidden()
                    }
                }
            }
        }
        .navigationTitle("Upcoming bills")
    }
}

struct FileTaxesView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SectionCard("Year-to-date") {
                    let cal = Calendar.current
                    let yearStart = cal.dateInterval(of: .year, for: Date())?.start ?? Date()
                    let revenue = data.receipts.filter { $0.date >= yearStart }.reduce(0) { $0 + $1.totalCents }
                    let expenses = data.expenses.filter { $0.date >= yearStart }.reduce(0) { $0 + $1.amountCents }
                    let net = revenue - expenses
                    let estTax = max(0, Int(Double(net) * 0.21))
                    VStack(alignment: .leading, spacing: 6) {
                        row("Revenue",        Money.format(cents: revenue))
                        row("Expenses",       Money.format(cents: expenses))
                        row("Net",            Money.format(cents: net))
                        Divider()
                        row("Estimated tax (21%)", Money.format(cents: estTax))
                            .font(.subheadline.weight(.bold))
                    }
                }
                SectionCard("Helpful next steps") {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Export expense CSV",    systemImage: "square.and.arrow.up")
                        Label("Export receipts CSV",   systemImage: "square.and.arrow.up")
                        Label("Schedule with CPA",     systemImage: "person.crop.circle.badge.checkmark")
                    }
                    .foregroundStyle(Theme.primary)
                }
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("File taxes")
    }

    @ViewBuilder
    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).foregroundStyle(Theme.mutedText); Spacer(); Text(v).monospacedDigit() }
    }
}

struct RunPayrollView: View {
    @EnvironmentObject private var data: DataStore

    var body: some View {
        List {
            Section("This pay period") {
                ForEach(data.staff) { s in
                    NavigationLink(destination: FinancesStaffPayrollBreakdownView(staffId: s.id)) {
                        HStack {
                            AvatarCircle(initials: s.initials)
                            VStack(alignment: .leading) {
                                Text(s.name).font(.subheadline.weight(.semibold))
                                Text(s.role).font(.caption).foregroundStyle(Theme.mutedText)
                            }
                            Spacer()
                            Text(Money.format(cents: estimatedPay(for: s))).monospacedDigit()
                        }
                    }
                }
            }
            Section {
                Button("Submit payroll") { }.buttonStyle(.primaryCTA)
            }
        }
        .navigationTitle("Run payroll")
    }

    private func estimatedPay(for s: StaffMember) -> Int {
        let cal = Calendar.current
        let start = cal.date(byAdding: .day, value: -14, to: Date()) ?? Date()
        let appts = data.appointments(forStaff: s.id)
            .filter { $0.start >= start && $0.status == .completed }
        let hours = appts.reduce(0) { $0 + $1.durationMinutes } / 60
        let serviceCents = appts.compactMap { data.service($0.serviceId)?.priceCents }.reduce(0, +)
        return hours * s.hourlyRateCents + Int(Double(serviceCents) * s.commissionPercent)
    }
}

struct FinancesStaffPayrollBreakdownView: View {
    let staffId: UUID
    var body: some View { StaffPayrollBreakdownView(staffId: staffId) }
}
