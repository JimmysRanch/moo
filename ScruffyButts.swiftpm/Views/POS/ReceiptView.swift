import SwiftUI

struct ReceiptView: View {
    @EnvironmentObject var data: DataStore
    @Environment(\.dismiss) private var dismiss
    var payment: Payment

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    PuppyMascot(size: 64)
                    Text("Scruffy Butts").font(.title2.bold())
                    Text(Format.dayTime(payment.date)).font(.caption).foregroundStyle(.secondary)
                    if let id = payment.clientId, let c = data.client(id) {
                        Text("Customer: \(c.fullName)").font(.subheadline)
                    }
                    Divider()
                    VStack(spacing: 6) {
                        ForEach(payment.lines) { line in
                            HStack {
                                Text(line.description)
                                Spacer()
                                Text(Format.money(line.subtotal))
                            }
                        }
                    }
                    Divider()
                    rowGroup
                    HStack {
                        Text("Total").bold()
                        Spacer()
                        Text(Format.money(payment.total)).bold()
                    }
                    .font(.title3)

                    Text("Paid via \(payment.method.label)")
                        .font(.caption).foregroundStyle(.secondary)
                        .padding(.top, 8)

                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(Theme.success)
                        .padding(.top, 16)
                    Text("Payment successful").font(.headline)
                }
                .padding()
            }
            .navigationTitle("Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var rowGroup: some View {
        VStack(spacing: 4) {
            HStack { Text("Subtotal"); Spacer(); Text(Format.money(payment.subtotal)) }
            HStack { Text("Tax");      Spacer(); Text(Format.money(payment.tax)) }
            HStack { Text("Tip");      Spacer(); Text(Format.money(payment.tip)) }
        }
        .foregroundStyle(.secondary)
        .font(.subheadline)
    }
}
