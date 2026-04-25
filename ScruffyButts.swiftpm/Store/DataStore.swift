import Foundation
import Combine

/// In-memory data store seeded with sample data so the app runs immediately
/// on launch. In production this would be backed by Supabase / Postgres.
@MainActor
final class DataStore: ObservableObject {
    // MARK: - Collections
    @Published var clients: [Client] = []
    @Published var pets: [Pet] = []
    @Published var staff: [Staff] = []
    @Published var appointments: [Appointment] = []
    @Published var services: [ServiceItem] = []
    @Published var expenses: [Expense] = []
    @Published var bills: [UpcomingBill] = []
    @Published var inventory: [InventoryItem] = []
    @Published var inventoryEvents: [InventoryEvent] = []
    @Published var conversations: [Conversation] = []
    @Published var messages: [ChatMessage] = []
    @Published var payments: [Payment] = []
    @Published var activity: [ActivityEvent] = []
    @Published var shifts: [ShiftBlock] = []

    // MARK: - Lookups

    func client(_ id: UUID?) -> Client? {
        guard let id = id else { return nil }
        return clients.first(where: { $0.id == id })
    }
    func pet(_ id: UUID?) -> Pet? {
        guard let id = id else { return nil }
        return pets.first(where: { $0.id == id })
    }
    func staffMember(_ id: UUID?) -> Staff? {
        guard let id = id else { return nil }
        return staff.first(where: { $0.id == id })
    }
    func service(_ id: UUID) -> ServiceItem? {
        services.first(where: { $0.id == id })
    }
    func pets(for clientId: UUID) -> [Pet] {
        pets.filter { $0.clientId == clientId }
    }
    func appointments(on day: Date) -> [Appointment] {
        let cal = Calendar.current
        return appointments
            .filter { cal.isDate($0.start, inSameDayAs: day) }
            .sorted(by: { $0.start < $1.start })
    }
    func appointmentsUpcoming() -> [Appointment] {
        appointments
            .filter { $0.start >= Date() && $0.status != .cancelled }
            .sorted(by: { $0.start < $1.start })
    }
    func messages(in conversationId: UUID) -> [ChatMessage] {
        messages.filter { $0.conversationId == conversationId }
            .sorted(by: { $0.sentAt < $1.sentAt })
    }

    // MARK: - Mutations

    func addActivity(_ kind: ActivityEvent.Kind, title: String, subtitle: String) {
        activity.insert(.init(kind: kind, title: title, subtitle: subtitle, date: Date()), at: 0)
    }

    func upsert(client: Client) {
        if let i = clients.firstIndex(where: { $0.id == client.id }) {
            clients[i] = client
        } else {
            clients.append(client)
            addActivity(.clientAdded, title: "New client added", subtitle: client.fullName)
        }
    }

    func deleteClient(_ id: UUID) {
        clients.removeAll { $0.id == id }
        let petIds = pets.filter { $0.clientId == id }.map(\.id)
        pets.removeAll { $0.clientId == id }
        appointments.removeAll { $0.clientId == id || petIds.contains($0.petId) }
    }

    func upsert(pet: Pet) {
        if let i = pets.firstIndex(where: { $0.id == pet.id }) {
            pets[i] = pet
        } else {
            pets.append(pet)
            if let i = clients.firstIndex(where: { $0.id == pet.clientId }) {
                clients[i].petIds.append(pet.id)
            }
            addActivity(.petAdded, title: "New pet added", subtitle: pet.name)
        }
    }

    func deletePet(_ id: UUID) {
        pets.removeAll { $0.id == id }
        appointments.removeAll { $0.petId == id }
    }

    func upsert(appointment: Appointment) {
        if let i = appointments.firstIndex(where: { $0.id == appointment.id }) {
            appointments[i] = appointment
        } else {
            appointments.append(appointment)
            let petName = pet(appointment.petId)?.name ?? "Pet"
            addActivity(.appointmentCreated,
                        title: "Appointment booked",
                        subtitle: "\(petName) — \(Format.dayTime(appointment.start))")
        }
    }

    func deleteAppointment(_ id: UUID) {
        appointments.removeAll { $0.id == id }
    }

    func upsert(staff member: Staff) {
        if let i = staff.firstIndex(where: { $0.id == member.id }) {
            staff[i] = member
        } else {
            staff.append(member)
            addActivity(.staffAdded, title: "Staff added", subtitle: member.fullName)
        }
    }

    func deleteStaff(_ id: UUID) {
        staff.removeAll { $0.id == id }
    }

    func upsert(expense: Expense) {
        if let i = expenses.firstIndex(where: { $0.id == expense.id }) {
            expenses[i] = expense
        } else {
            expenses.append(expense)
            addActivity(.expenseAdded,
                        title: "Expense recorded",
                        subtitle: "\(expense.category.label) — \(Format.money(expense.amount))")
        }
    }

    func deleteExpense(_ id: UUID) { expenses.removeAll { $0.id == id } }

    func recordPayment(_ payment: Payment) {
        payments.insert(payment, at: 0)
        addActivity(.paymentReceived,
                    title: "Payment received",
                    subtitle: Format.money(payment.total))
    }

    func adjustInventory(itemId: UUID, delta: Int, kind: InventoryEvent.Kind, note: String = "") {
        guard let i = inventory.firstIndex(where: { $0.id == itemId }) else { return }
        inventory[i].quantity = max(0, inventory[i].quantity + delta)
        if kind == .restock { inventory[i].lastRestockedAt = Date() }
        inventoryEvents.insert(.init(itemId: itemId, kind: kind, delta: delta, date: Date(), note: note), at: 0)
    }

    func send(message body: String, in conversationId: UUID) {
        let msg = ChatMessage(conversationId: conversationId, direction: .outgoing, body: body, sentAt: Date())
        messages.append(msg)
        if let i = conversations.firstIndex(where: { $0.id == conversationId }) {
            conversations[i].lastMessageAt = msg.sentAt
        }
    }

    // MARK: - Aggregates for Dashboard / Finances

    func revenueThisMonth() -> Double {
        let cal = Calendar.current
        return payments
            .filter { cal.isDate($0.date, equalTo: Date(), toGranularity: .month) }
            .reduce(0) { $0 + $1.total }
    }

    func expensesThisMonth() -> Double {
        let cal = Calendar.current
        return expenses
            .filter { cal.isDate($0.date, equalTo: Date(), toGranularity: .month) }
            .reduce(0) { $0 + $1.amount }
    }

    func appointmentsToday() -> [Appointment] { appointments(on: Date()) }
    func lowStockCount() -> Int { inventory.filter { $0.lowStock }.count }
}
