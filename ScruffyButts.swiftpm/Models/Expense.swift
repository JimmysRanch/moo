import Foundation

enum ExpenseCategory: String, CaseIterable, Codable {
    case supplies, payroll, rent, utilities, marketing, equipment, taxes, other

    var label: String { rawValue.capitalized }
}

struct Expense: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var date: Date
    var amount: Double
    var category: ExpenseCategory
    var vendor: String = ""
    var notes: String = ""
}

struct UpcomingBill: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var name: String
    var amount: Double
    var dueDate: Date
    var paid: Bool = false
}
