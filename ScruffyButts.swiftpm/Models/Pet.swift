import Foundation

struct Pet: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var clientId: UUID
    var name: String
    var species: String = "Dog"
    var breed: String = ""
    var weightLb: Double = 0
    var birthday: Date? = nil
    var notes: String = ""
    var groomingPreferences: String = ""
    var medicalNotes: String = ""
}
