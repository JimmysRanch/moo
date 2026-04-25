import Foundation

struct AppUser: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var email: String
    var displayName: String
    var role: StaffRole = .owner
    var businessName: String = "Scruffy Butts"
}
