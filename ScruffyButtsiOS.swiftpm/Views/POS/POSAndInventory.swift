import SwiftUI

// MARK: - POS

struct POSView: View {
    @EnvironmentObject private var data: DataStore
    @State private var lines: [ReceiptLine] = []
    @State private var selectedClient: UUID?
    @State private var paymentMethod: PaymentMethod = .card
    @State private var tipPercent: Double = 0.18
    @State private var lastReceipt: Receipt?
    @State private var showSuccess = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                catalog
                cart
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Point of sale")
        .sheet(isPresented: $showSuccess) {
            if let r = lastReceipt {
                NavigationStack { PaymentSuccessView(receipt: r) }
            }
        }
    }

    private var catalog: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Services").font(.headline)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
                    ForEach(data.services) { s in
                        Button { add(name: s.name, priceCents: s.priceCents) } label: {
                            VStack(alignment: .leading) {
                                Text(s.name).font(.subheadline.weight(.semibold))
                                Text(s.price).font(.caption).foregroundStyle(Theme.mutedText)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(10)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                        }.buttonStyle(.plain)
                    }
                }
                Text("Retail").font(.headline).padding(.top, 8)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
                    ForEach(data.inventory) { item in
                        Button { add(name: item.name, priceCents: item.unitPriceCents) } label: {
                            VStack(alignment: .leading) {
                                Text(item.name).font(.subheadline.weight(.semibold)).lineLimit(2)
                                Text(Money.format(cents: item.unitPriceCents))
                                    .font(.caption).foregroundStyle(Theme.mutedText)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(10)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var subtotalCents: Int { lines.reduce(0) { $0 + $1.totalCents } }
    private var taxCents: Int { Int(Double(subtotalCents) * 0.0825) }
    private var tipCents: Int { Int(Double(subtotalCents) * tipPercent) }
    private var totalCents: Int { subtotalCents + taxCents + tipCents }

    private var cart: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Order").font(.headline)
            Picker("Client", selection: $selectedClient) {
                Text("Walk-in").tag(UUID?.none)
                ForEach(data.clients) { c in Text(c.name).tag(Optional(c.id)) }
            }
            ScrollView {
                VStack(spacing: 6) {
                    ForEach(lines) { line in
                        HStack {
                            Text(line.description).font(.subheadline)
                            Spacer()
                            Text("× \(line.quantity)").font(.caption).foregroundStyle(Theme.mutedText)
                            Text(Money.format(cents: line.totalCents)).monospacedDigit()
                        }
                        .padding(8).background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
                    }
                    if lines.isEmpty {
                        EmptyState(title: "Cart empty", message: "Tap items to add.",
                                   systemImage: "cart")
                    }
                }
            }
            Picker("Tip", selection: $tipPercent) {
                Text("0%").tag(0.0); Text("15%").tag(0.15); Text("18%").tag(0.18); Text("20%").tag(0.20)
            }.pickerStyle(.segmented)

            Picker("Payment", selection: $paymentMethod) {
                ForEach(PaymentMethod.allCases, id: \.self) { Text($0.label).tag($0) }
            }.pickerStyle(.menu)

            VStack(spacing: 4) {
                line("Subtotal", subtotalCents)
                line("Tax",       taxCents)
                line("Tip",       tipCents)
                Divider()
                line("Total",     totalCents).font(.headline)
            }

            Button("Charge \(Money.format(cents: totalCents))") { charge() }
                .buttonStyle(.primaryCTA)
                .disabled(lines.isEmpty)
        }
        .padding(12)
        .frame(maxWidth: 320)
        .background(Theme.card.opacity(0.5), in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }

    @ViewBuilder
    private func line(_ k: String, _ v: Int) -> some View {
        HStack { Text(k); Spacer(); Text(Money.format(cents: v)).monospacedDigit() }
            .font(.subheadline)
    }

    private func add(name: String, priceCents: Int) {
        if let i = lines.firstIndex(where: { $0.description == name && $0.unitPriceCents == priceCents }) {
            lines[i].quantity += 1
        } else {
            lines.append(ReceiptLine(id: UUID(), description: name, quantity: 1, unitPriceCents: priceCents))
        }
    }

    private func charge() {
        let r = Receipt(id: UUID(), clientId: selectedClient, staffId: nil,
                        date: Date(), lines: lines,
                        taxCents: taxCents, tipCents: tipCents,
                        paymentMethod: paymentMethod, notes: "")
        data.addReceipt(r)
        lastReceipt = r
        lines.removeAll()
        showSuccess = true
    }
}

// MARK: - Receipt / payments

struct ReceiptView: View {
    @EnvironmentObject private var data: DataStore
    let receiptId: UUID

    var body: some View {
        if let r = data.receipts.first(where: { $0.id == receiptId }) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Scruffy Butts").font(.title2.weight(.bold))
                    Text(DateFmt.dayMonthYear.string(from: r.date)).foregroundStyle(Theme.mutedText)
                    Divider()
                    ForEach(r.lines) { l in
                        HStack {
                            Text("\(l.quantity)× \(l.description)")
                            Spacer()
                            Text(Money.format(cents: l.totalCents)).monospacedDigit()
                        }
                    }
                    Divider()
                    row("Subtotal", r.subtotalCents)
                    row("Tax",      r.taxCents)
                    row("Tip",      r.tipCents)
                    row("Total",    r.totalCents).font(.headline)
                    Text("Paid via \(r.paymentMethod.label)")
                        .font(.caption).foregroundStyle(Theme.mutedText)
                }
                .padding(20)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Receipt")
        } else {
            EmptyState(title: "Receipt not found", message: "It may have been removed.",
                       systemImage: "doc.questionmark")
        }
    }

    @ViewBuilder
    private func row(_ k: String, _ v: Int) -> some View {
        HStack { Text(k); Spacer(); Text(Money.format(cents: v)).monospacedDigit() }
    }
}

struct PaymentSuccessView: View {
    @Environment(\.dismiss) private var dismiss
    let receipt: Receipt

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(Theme.success)
            Text("Payment received").font(.title2.weight(.bold))
            Text(Money.format(cents: receipt.totalCents))
                .font(.system(size: 36, weight: .bold, design: .rounded))
            NavigationLink("View receipt", destination: ReceiptView(receiptId: receipt.id))
            Button("Done") { dismiss() }.buttonStyle(.primaryCTA).padding(.horizontal, 60)
        }
        .padding(24)
        .navigationTitle("Success")
    }
}

struct PaymentCancelView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "xmark.octagon.fill").font(.system(size: 64))
                .foregroundStyle(Theme.danger)
            Text("Payment cancelled").font(.title2.weight(.bold))
            Text("No charge was made.")
                .foregroundStyle(Theme.mutedText)
        }
        .navigationTitle("Cancelled")
    }
}

// MARK: - Inventory

struct InventoryView: View {
    @EnvironmentObject private var data: DataStore

    var body: some View {
        List {
            Section("Low stock") {
                let low = data.inventory.filter(\.lowStock)
                if low.isEmpty {
                    Text("All items above threshold").foregroundStyle(Theme.mutedText)
                } else {
                    ForEach(low) { item in InventoryRow(item: item) }
                }
            }
            Section("All items") {
                ForEach(data.inventory) { item in InventoryRow(item: item) }
            }
        }
        .navigationTitle("Inventory")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(destination: InventoryHistoryView()) {
                    Image(systemName: "clock.arrow.circlepath")
                }
            }
        }
    }
}

struct InventoryRow: View {
    let item: InventoryItem
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(item.name).font(.subheadline.weight(.semibold))
                Text("\(item.category) • SKU \(item.sku)")
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text("\(item.quantityOnHand)").font(.subheadline.weight(.semibold)).monospacedDigit()
                if item.lowStock {
                    StatusPill(text: "Low", tint: Theme.warning)
                }
            }
        }
    }
}

struct InventoryHistoryView: View {
    @EnvironmentObject private var data: DataStore
    var body: some View {
        List(data.inventoryMovements.sorted { $0.date > $1.date }) { m in
            HStack {
                let item = data.inventory.first { $0.id == m.itemId }
                VStack(alignment: .leading) {
                    Text(item?.name ?? "Unknown").font(.subheadline.weight(.semibold))
                    Text(m.reason).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                Text(m.delta > 0 ? "+\(m.delta)" : "\(m.delta)")
                    .monospacedDigit()
                    .foregroundStyle(m.delta > 0 ? Theme.success : Theme.danger)
                Text(DateFmt.dayMonth.string(from: m.date))
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
        }
        .navigationTitle("History")
    }
}
