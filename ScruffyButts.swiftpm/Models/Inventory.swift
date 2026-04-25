import Foundation

struct InventoryItem: Identifiable, Hashable, Codable {
    var id: UUID = UUID()
    var name: String
    var sku: String
    var quantity: Int
    var reorderLevel: Int = 5
    var unitCost: Double
    var unitPrice: Double
    var lastRestockedAt: Date? = nil

    var lowStock: Bool { quantity <= reorderLevel }
}

struct InventoryEvent: Identifiable, Hashable, Codable {
    enum Kind: String, Codable { case restock, sale, adjustment }
    var id: UUID = UUID()
    var itemId: UUID
    var kind: Kind
    var delta: Int
    var date: Date
    var note: String = ""
}
