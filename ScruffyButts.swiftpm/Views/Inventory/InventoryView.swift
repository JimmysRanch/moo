import SwiftUI

struct InventoryView: View {
    @EnvironmentObject var data: DataStore
    @State private var search = ""
    @State private var showOnlyLow = false

    var body: some View {
        List {
            Toggle("Show only low stock", isOn: $showOnlyLow)
            ForEach(filtered) { item in
                NavigationLink {
                    InventoryDetailView(item: item)
                } label: {
                    InventoryRow(item: item)
                }
            }
            Section {
                NavigationLink { InventoryHistoryView() } label: {
                    Label("Restock & adjustment history", systemImage: "clock.arrow.circlepath")
                }
            }
        }
        .searchable(text: $search, prompt: "Search inventory")
        .navigationTitle("Inventory")
    }

    private var filtered: [InventoryItem] {
        let q = search.lowercased()
        return data.inventory.filter { item in
            (!showOnlyLow || item.lowStock) &&
            (q.isEmpty || item.name.lowercased().contains(q) || item.sku.lowercased().contains(q))
        }
    }
}

struct InventoryRow: View {
    var item: InventoryItem
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(item.name).font(.headline)
                Text(item.sku).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text("\(item.quantity)").font(.headline)
                    .foregroundStyle(item.lowStock ? Theme.danger : .primary)
                Text(Format.money(item.unitPrice)).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

struct InventoryDetailView: View {
    @EnvironmentObject var data: DataStore
    var item: InventoryItem
    @State private var restockBy: Int = 5

    var body: some View {
        Form {
            Section("Stock") {
                LabeledContent("On hand", value: "\(item.quantity)")
                LabeledContent("Reorder at", value: "\(item.reorderLevel)")
                if let last = item.lastRestockedAt {
                    LabeledContent("Last restocked", value: Format.shortDate(last))
                }
            }
            Section("Pricing") {
                LabeledContent("Unit cost",  value: Format.money(item.unitCost))
                LabeledContent("Unit price", value: Format.money(item.unitPrice))
                LabeledContent("Margin",     value: margin)
            }
            Section("Restock") {
                Stepper(value: $restockBy, in: 1...100) {
                    Text("Add \(restockBy) units")
                }
                Button {
                    data.adjustInventory(itemId: item.id, delta: restockBy, kind: .restock, note: "Manual restock")
                } label: {
                    HStack { Spacer(); Text("Restock").font(.headline); Spacer() }
                }
                .listRowBackground(Theme.accent)
                .foregroundStyle(.white)
            }
        }
        .navigationTitle(item.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var margin: String {
        guard item.unitPrice > 0 else { return "—" }
        let m = (item.unitPrice - item.unitCost) / item.unitPrice * 100
        return "\(Int(m))%"
    }
}

struct InventoryHistoryView: View {
    @EnvironmentObject var data: DataStore
    var body: some View {
        List(data.inventoryEvents) { e in
            HStack {
                Image(systemName: icon(for: e.kind))
                    .frame(width: 32)
                    .foregroundStyle(color(for: e.kind))
                VStack(alignment: .leading) {
                    Text(name(for: e.itemId)).font(.subheadline.bold())
                    Text("\(e.kind.rawValue.capitalized) • \(e.delta > 0 ? "+\(e.delta)" : "\(e.delta)")")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(Format.shortDate(e.date)).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("History")
        .overlay {
            if data.inventoryEvents.isEmpty {
                EmptyStateView(systemImage: "shippingbox", title: "No history yet")
            }
        }
    }

    private func name(for id: UUID) -> String {
        data.inventory.first(where: { $0.id == id })?.name ?? "Item"
    }
    private func icon(for kind: InventoryEvent.Kind) -> String {
        switch kind { case .restock: return "arrow.down.circle.fill"
                      case .sale:    return "cart.fill"
                      case .adjustment: return "slider.horizontal.3" }
    }
    private func color(for kind: InventoryEvent.Kind) -> Color {
        switch kind { case .restock: return Theme.success
                      case .sale:    return Theme.accent
                      case .adjustment: return Theme.warning }
    }
}
