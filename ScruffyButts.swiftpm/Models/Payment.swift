import Foundation

enum PaymentMethod: String, CaseIterable, Codable {
    case cash, card, terminal, other
    var label: String { rawValue.capitalized }
}

struct PaymentLine: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var description: String
    var amount: Double
    var quantity: Int = 1

    var subtotal: Double { amount * Double(quantity) }
}

struct Payment: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var date: Date
    var clientId: UUID?
    var appointmentId: UUID?
    var lines: [PaymentLine]
    var taxRate: Double = 0.0825
    var tip: Double = 0
    var method: PaymentMethod = .card

    var subtotal: Double { lines.reduce(0) { $0 + $1.subtotal } }
    var tax: Double { subtotal * taxRate }
    var total: Double { subtotal + tax + tip }
}
