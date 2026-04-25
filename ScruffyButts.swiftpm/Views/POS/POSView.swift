import SwiftUI

struct POSView: View {
    @EnvironmentObject var data: DataStore
    @State private var cart: [PaymentLine] = []
    @State private var clientId: UUID?
    @State private var tip: Double = 0
    @State private var method: PaymentMethod = .card
    @State private var showReceipt = false
    @State private var lastPayment: Payment?

    var body: some View {
        VStack(spacing: 0) {
            menuSection
            Divider()
            cartSection
            checkoutBar
        }
        .navigationTitle("POS")
        .sheet(isPresented: $showReceipt) {
            if let p = lastPayment { ReceiptView(payment: p) }
        }
    }

    private var menuSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Services").font(.headline).padding(.horizontal)
                let cols = [GridItem(.flexible()), GridItem(.flexible())]
                LazyVGrid(columns: cols, spacing: 10) {
                    ForEach(data.services) { svc in
                        Button {
                            cart.append(PaymentLine(description: svc.name, amount: svc.price))
                        } label: {
                            VStack(alignment: .leading) {
                                Text(svc.name).font(.subheadline.bold())
                                Text(Format.money(svc.price)).font(.caption).foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card(padding: 12)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                Text("Retail").font(.headline).padding(.horizontal).padding(.top, 8)
                LazyVGrid(columns: cols, spacing: 10) {
                    ForEach(data.inventory) { item in
                        Button {
                            cart.append(PaymentLine(description: item.name, amount: item.unitPrice))
                            data.adjustInventory(itemId: item.id, delta: -1, kind: .sale, note: "POS sale")
                        } label: {
                            VStack(alignment: .leading) {
                                Text(item.name).font(.subheadline.bold())
                                HStack {
                                    Text(Format.money(item.unitPrice)).font(.caption).foregroundStyle(.secondary)
                                    Spacer()
                                    Text("Stock: \(item.quantity)")
                                        .font(.caption2)
                                        .foregroundStyle(item.lowStock ? Theme.danger : Theme.muted)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card(padding: 12)
                        }
                        .buttonStyle(.plain)
                        .disabled(item.quantity <= 0)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .padding(.vertical, 8)
        }
        .background(Theme.background)
    }

    private var cartSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Cart (\(cart.count))").font(.headline)
                Spacer()
                Picker("Client", selection: $clientId) {
                    Text("Walk-in").tag(UUID?.none)
                    ForEach(data.clients) { Text($0.fullName).tag(Optional($0.id)) }
                }
                .pickerStyle(.menu)
            }
            .padding(.horizontal)
            .padding(.top, 8)

            if cart.isEmpty {
                Text("Tap items above to add").foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(Array(cart.enumerated()), id: \.element.id) { idx, line in
                            HStack {
                                Text(line.description)
                                Spacer()
                                Text(Format.money(line.amount)).foregroundStyle(.secondary)
                                Button {
                                    cart.remove(at: idx)
                                } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                                    .buttonStyle(.plain)
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .frame(maxHeight: 140)
            }
        }
        .background(Theme.surface)
    }

    private var checkoutBar: some View {
        let preview = Payment(date: Date(), clientId: clientId, lines: cart, tip: tip, method: method)
        return VStack(spacing: 8) {
            HStack {
                Text("Subtotal"); Spacer(); Text(Format.money(preview.subtotal))
            }
            HStack {
                Text("Tax (8.25%)"); Spacer(); Text(Format.money(preview.tax))
            }
            HStack {
                Text("Tip"); Spacer()
                TextField("0", value: $tip, format: .number).keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
            HStack {
                Text("Total").bold(); Spacer()
                Text(Format.money(preview.total)).bold()
            }

            Picker("Method", selection: $method) {
                ForEach(PaymentMethod.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            Button {
                let p = Payment(date: Date(), clientId: clientId, lines: cart, tip: tip, method: method)
                data.recordPayment(p)
                lastPayment = p
                cart.removeAll()
                tip = 0
                showReceipt = true
            } label: {
                HStack { Spacer(); Text("Charge \(Format.money(preview.total))").font(.headline); Spacer() }
                    .padding(.vertical, 12)
            }
            .background(cart.isEmpty ? Theme.muted : Theme.accent)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .disabled(cart.isEmpty)
        }
        .padding()
        .background(Theme.surface.shadow(.drop(color: .black.opacity(0.06), radius: 6, y: -2)))
    }
}
