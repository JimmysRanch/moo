import SwiftUI

struct FinancesView: View {
    @EnvironmentObject var data: DataStore

    var body: some View {
        List {
            Section {
                summaryCard("Revenue (mo.)",   Format.money(data.revenueThisMonth()), .success)
                summaryCard("Expenses (mo.)",  Format.money(data.expensesThisMonth()), .warning)
                summaryCard("Net (mo.)",
                            Format.money(data.revenueThisMonth() - data.expensesThisMonth()),
                            data.revenueThisMonth() >= data.expensesThisMonth() ? .success : .danger)
            }
            Section {
                NavigationLink { AllExpensesView() } label: {
                    Label("All expenses", systemImage: "list.bullet")
                }
                NavigationLink { UpcomingBillsView() } label: {
                    Label("Upcoming bills", systemImage: "calendar.badge.clock")
                }
                NavigationLink { FinancesStaffPayrollBreakdownView() } label: {
                    Label("Staff payroll breakdown", systemImage: "person.text.rectangle")
                }
                NavigationLink { FileTaxesView() } label: {
                    Label("File taxes", systemImage: "doc.text.fill")
                }
            }
        }
        .navigationTitle("Finances")
    }

    private func summaryCard(_ title: String, _ value: String, _ tint: SemanticTint) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(title).font(.subheadline).foregroundStyle(.secondary)
                Text(value).font(.title3.bold()).foregroundStyle(tint.color)
            }
            Spacer()
            Image(systemName: tint.icon).font(.title2).foregroundStyle(tint.color)
        }
    }

    enum SemanticTint { case success, warning, danger
        var color: Color { switch self { case .success: return Theme.success
                                           case .warning: return Theme.warning
                                           case .danger:  return Theme.danger } }
        var icon: String { switch self { case .success: return "arrow.up.right.circle.fill"
                                         case .warning: return "arrow.down.right.circle.fill"
                                         case .danger:  return "exclamationmark.triangle.fill" } }
    }
}

struct AllExpensesView: View {
    @EnvironmentObject var data: DataStore
    @State private var showAdd = false

    var body: some View {
        List {
            ForEach(data.expenses.sorted(by: { $0.date > $1.date })) { e in
                NavigationLink {
                    ExpensesDetailView(expense: e)
                } label: {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(e.vendor.isEmpty ? e.category.label : e.vendor).font(.subheadline.bold())
                            Text("\(e.category.label) • \(Format.shortDate(e.date))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(Format.money(e.amount)).foregroundStyle(Theme.danger)
                    }
                }
            }
            .onDelete { idx in
                let sorted = data.expenses.sorted(by: { $0.date > $1.date })
                for i in idx { data.deleteExpense(sorted[i].id) }
            }
        }
        .navigationTitle("Expenses")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddExpenseView() }
    }
}

struct AddExpenseView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var amount: Double = 0
    @State private var category: ExpenseCategory = .supplies
    @State private var vendor = ""
    @State private var date = Date()
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    HStack {
                        Text("$")
                        TextField("0.00", value: $amount, format: .number).keyboardType(.decimalPad)
                    }
                }
                Section("Details") {
                    Picker("Category", selection: $category) {
                        ForEach(ExpenseCategory.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    TextField("Vendor", text: $vendor)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 70)
                }
            }
            .navigationTitle("Add expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        data.upsert(expense: Expense(date: date, amount: amount, category: category,
                                                     vendor: vendor, notes: notes))
                        dismiss()
                    }.disabled(amount <= 0)
                }
            }
        }
    }
}

struct ExpensesDetailView: View {
    var expense: Expense
    var body: some View {
        Form {
            Section {
                LabeledContent("Amount",  value: Format.money(expense.amount))
                LabeledContent("Category", value: expense.category.label)
                if !expense.vendor.isEmpty { LabeledContent("Vendor", value: expense.vendor) }
                LabeledContent("Date", value: Format.shortDate(expense.date))
            }
            if !expense.notes.isEmpty {
                Section("Notes") { Text(expense.notes) }
            }
        }
        .navigationTitle(expense.vendor.isEmpty ? expense.category.label : expense.vendor)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct UpcomingBillsView: View {
    @EnvironmentObject var data: DataStore

    var body: some View {
        List {
            ForEach(data.bills.sorted(by: { $0.dueDate < $1.dueDate })) { b in
                HStack {
                    VStack(alignment: .leading) {
                        Text(b.name).font(.subheadline.bold())
                        Text("Due \(Format.shortDate(b.dueDate))").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(Format.money(b.amount))
                        .foregroundStyle(b.paid ? Theme.success : Theme.warning)
                }
            }
        }
        .navigationTitle("Upcoming bills")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FinancesStaffPayrollBreakdownView: View {
    @EnvironmentObject var data: DataStore
    var body: some View {
        List {
            ForEach(data.staff) { s in
                HStack {
                    VStack(alignment: .leading) {
                        Text(s.fullName).font(.headline)
                        Text(s.compensationType.label).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    switch s.compensationType {
                    case .hourly:    Text("\(Format.money(s.rate))/hr")
                    case .salary:    Text(Format.money(s.rate / 26)).foregroundStyle(.secondary)
                    case .commission:Text("\(Int(s.commissionPct))%")
                    }
                }
            }
        }
        .navigationTitle("Payroll breakdown")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FileTaxesView: View {
    @EnvironmentObject var data: DataStore
    @State private var year = Calendar.current.component(.year, from: Date())

    var body: some View {
        Form {
            Section("Year") {
                Stepper(value: $year, in: 2020...Calendar.current.component(.year, from: Date())) {
                    Text("\(year)")
                }
            }
            Section("Summary") {
                LabeledContent("Total revenue",  value: Format.money(totals.revenue))
                LabeledContent("Total expenses", value: Format.money(totals.expenses))
                LabeledContent("Net",            value: Format.money(totals.revenue - totals.expenses))
            }
            Section {
                Button {
                    // Stub — real app would generate a PDF / call accountant API
                } label: {
                    HStack { Spacer(); Text("Export tax report").font(.headline); Spacer() }
                }
                .listRowBackground(Theme.accent)
                .foregroundStyle(.white)
            }
        }
        .navigationTitle("File taxes")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var totals: (revenue: Double, expenses: Double) {
        let cal = Calendar.current
        let r = data.payments.filter { cal.component(.year, from: $0.date) == year }
                              .reduce(0) { $0 + $1.total }
        let e = data.expenses.filter { cal.component(.year, from: $0.date) == year }
                              .reduce(0) { $0 + $1.amount }
        return (r, e)
    }
}
