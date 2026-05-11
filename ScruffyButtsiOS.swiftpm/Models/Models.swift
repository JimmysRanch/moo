import Foundation

struct Store: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var address: String
    var timezone: String
}

struct Client: Identifiable, Hashable, Codable {
    let id: UUID
    var firstName: String
    var lastName: String
    var email: String
    var phone: String
    var notes: String
    var createdAt: Date

    var name: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
    var initials: String {
        let f = firstName.first.map(String.init) ?? ""
        let l = lastName.first.map(String.init) ?? ""
        return (f + l).uppercased()
    }
}

struct Pet: Identifiable, Hashable, Codable {
    let id: UUID
    var clientId: UUID
    var name: String
    var breed: String
    var weightLbs: Double
    var birthday: Date?
    var notes: String
    var groomingPreferences: String
    var medicalNotes: String
    var photoSystemImage: String
}

struct Service: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var category: String
    var priceCents: Int
    var durationMinutes: Int

    var price: String { Money.format(cents: priceCents) }
}

enum AppointmentStatus: String, CaseIterable, Codable, Hashable {
    case scheduled, inProgress = "in_progress", completed, cancelled, noShow = "no_show"

    var label: String {
        switch self {
        case .scheduled:  return "Scheduled"
        case .inProgress: return "In progress"
        case .completed:  return "Completed"
        case .cancelled:  return "Cancelled"
        case .noShow:     return "No-show"
        }
    }
}

struct Appointment: Identifiable, Hashable, Codable {
    let id: UUID
    var clientId: UUID
    var petId: UUID
    var staffId: UUID
    var serviceId: UUID
    var start: Date
    var durationMinutes: Int
    var status: AppointmentStatus
    var notes: String

    var end: Date { start.addingTimeInterval(TimeInterval(durationMinutes * 60)) }
}

struct StaffMember: Identifiable, Hashable, Codable {
    let id: UUID
    var firstName: String
    var lastName: String
    var role: String
    var email: String
    var phone: String
    var hireDate: Date
    var hourlyRateCents: Int
    var commissionPercent: Double
    var active: Bool
    var avatarSystemImage: String

    var name: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
    var initials: String {
        let f = firstName.first.map(String.init) ?? ""
        let l = lastName.first.map(String.init) ?? ""
        return (f + l).uppercased()
    }
}

struct InventoryItem: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var sku: String
    var category: String
    var quantityOnHand: Int
    var reorderThreshold: Int
    var unitCostCents: Int
    var unitPriceCents: Int

    var lowStock: Bool { quantityOnHand <= reorderThreshold }
}

struct InventoryMovement: Identifiable, Hashable, Codable {
    let id: UUID
    var itemId: UUID
    var delta: Int        // +received, -sold/used
    var reason: String
    var date: Date
}

enum ExpenseCategory: String, CaseIterable, Codable, Hashable {
    case supplies, rent, utilities, payroll, marketing, equipment, software, other

    var label: String { rawValue.capitalized }
}

struct Expense: Identifiable, Hashable, Codable {
    let id: UUID
    var date: Date
    var vendor: String
    var category: ExpenseCategory
    var amountCents: Int
    var notes: String
    var recurring: Bool
}

struct Bill: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var dueDate: Date
    var amountCents: Int
    var paid: Bool
}

enum PaymentMethod: String, CaseIterable, Codable, Hashable {
    case cash, card, terminal, applePay = "apple_pay", other

    var label: String {
        switch self {
        case .cash:     return "Cash"
        case .card:     return "Card"
        case .terminal: return "Card terminal"
        case .applePay: return "Apple Pay"
        case .other:    return "Other"
        }
    }
}

struct ReceiptLine: Identifiable, Hashable, Codable {
    let id: UUID
    var description: String
    var quantity: Int
    var unitPriceCents: Int

    var totalCents: Int { quantity * unitPriceCents }
}

struct Receipt: Identifiable, Hashable, Codable {
    let id: UUID
    var clientId: UUID?
    var staffId: UUID?
    var date: Date
    var lines: [ReceiptLine]
    var taxCents: Int
    var tipCents: Int
    var paymentMethod: PaymentMethod
    var notes: String

    var subtotalCents: Int { lines.reduce(0) { $0 + $1.totalCents } }
    var totalCents: Int    { subtotalCents + taxCents + tipCents }
}

struct Message: Identifiable, Hashable, Codable {
    let id: UUID
    var clientId: UUID
    var inbound: Bool
    var body: String
    var sentAt: Date
}

struct ActivityEvent: Identifiable, Hashable, Codable {
    let id: UUID
    var date: Date
    var icon: String
    var title: String
    var subtitle: String
}

// MARK: - Helpers

enum Money {
    static func format(cents: Int, currencyCode: String = "USD") -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = currencyCode
        return f.string(from: NSNumber(value: Double(cents) / 100.0)) ?? "$0.00"
    }
}
