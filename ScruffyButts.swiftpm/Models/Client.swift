import Foundation

struct Client: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var firstName: String
    var lastName: String
    var phone: String
    var email: String
    var address: String = ""
    var notes: String = ""
    var createdAt: Date = Date()
    var petIds: [UUID] = []

    var fullName: String { "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces) }
    var initials: String {
        let f = firstName.first.map { String($0) } ?? ""
        let l = lastName.first.map { String($0) } ?? ""
        return (f + l).uppercased()
    }
}
