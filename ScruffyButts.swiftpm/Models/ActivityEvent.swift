import Foundation

struct ActivityEvent: Identifiable, Hashable, Codable {
    enum Kind: String, Codable {
        case appointmentCreated, appointmentCompleted
        case paymentReceived, expenseAdded
        case clientAdded, petAdded, staffAdded
        case messageReceived
    }
    var id: UUID = UUID()
    var kind: Kind
    var title: String
    var subtitle: String
    var date: Date

    var systemImage: String {
        switch kind {
        case .appointmentCreated, .appointmentCompleted: return "calendar"
        case .paymentReceived: return "creditcard.fill"
        case .expenseAdded: return "minus.circle"
        case .clientAdded: return "person.crop.circle.badge.plus"
        case .petAdded: return "pawprint.fill"
        case .staffAdded: return "person.2.fill"
        case .messageReceived: return "bubble.left.fill"
        }
    }
}
