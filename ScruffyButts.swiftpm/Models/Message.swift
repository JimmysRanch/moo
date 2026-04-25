import Foundation

struct Conversation: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var clientId: UUID
    var lastMessageAt: Date
    var unreadCount: Int = 0
}

struct ChatMessage: Identifiable, Hashable, Codable {
    enum Direction: String, Codable { case incoming, outgoing }
    var id: UUID = UUID()
    var conversationId: UUID
    var direction: Direction
    var body: String
    var sentAt: Date
}
