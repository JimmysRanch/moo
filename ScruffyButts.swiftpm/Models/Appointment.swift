import Foundation

struct ServiceItem: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var name: String
    var price: Double
    var durationMinutes: Int
}

enum AppointmentStatus: String, CaseIterable, Codable {
    case scheduled, inProgress = "in_progress", completed, cancelled, noShow = "no_show"

    var label: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        case .noShow: return "No Show"
        }
    }
}

struct Appointment: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var clientId: UUID
    var petId: UUID
    var staffId: UUID?
    var serviceIds: [UUID] = []
    var start: Date
    var durationMinutes: Int = 60
    var status: AppointmentStatus = .scheduled
    var notes: String = ""

    var end: Date { start.addingTimeInterval(TimeInterval(durationMinutes * 60)) }
}
