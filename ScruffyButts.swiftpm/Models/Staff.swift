import Foundation

enum StaffRole: String, CaseIterable, Codable {
    case owner, manager, groomer, bather, receptionist

    var label: String { rawValue.capitalized }
}

enum CompensationType: String, CaseIterable, Codable {
    case hourly, salary, commission

    var label: String { rawValue.capitalized }
}

struct Staff: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var firstName: String
    var lastName: String
    var role: StaffRole
    var email: String
    var phone: String = ""
    var compensationType: CompensationType = .hourly
    var rate: Double = 18         // $/hr or % depending on type
    var commissionPct: Double = 0 // when type == .commission
    var hireDate: Date = Date()
    var active: Bool = true

    var fullName: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
    var initials: String {
        let f = firstName.first.map { String($0) } ?? ""
        let l = lastName.first.map { String($0) } ?? ""
        return (f + l).uppercased()
    }
}

struct ShiftBlock: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var staffId: UUID
    var start: Date
    var end: Date
    var note: String = ""
}
