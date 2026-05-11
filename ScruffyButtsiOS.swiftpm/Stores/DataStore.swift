import Foundation
import SwiftUI

/// In-memory data store for the entire app. Replaces what Supabase + Stripe + Twilio
/// provide in the original 126 web app.  Provides realistic seed data so every screen
/// has something to render.
@MainActor
final class DataStore: ObservableObject {
    @Published var stores: [Store] = []
    @Published var activeStoreId: UUID?

    @Published var clients: [Client] = []
    @Published var pets: [Pet] = []
    @Published var staff: [StaffMember] = []
    @Published var services: [Service] = []
    @Published var appointments: [Appointment] = []
    @Published var inventory: [InventoryItem] = []
    @Published var inventoryMovements: [InventoryMovement] = []
    @Published var expenses: [Expense] = []
    @Published var bills: [Bill] = []
    @Published var receipts: [Receipt] = []
    @Published var messages: [Message] = []
    @Published var activity: [ActivityEvent] = []

    init() {
        seed()
    }

    // MARK: - Lookups

    func client(_ id: UUID?) -> Client? { clients.first { $0.id == id } }
    func pet(_ id: UUID?) -> Pet? { pets.first { $0.id == id } }
    func staffMember(_ id: UUID?) -> StaffMember? { staff.first { $0.id == id } }
    func service(_ id: UUID?) -> Service? { services.first { $0.id == id } }

    func pets(forClient id: UUID) -> [Pet] { pets.filter { $0.clientId == id } }
    func appointments(forClient id: UUID) -> [Appointment] { appointments.filter { $0.clientId == id } }
    func appointments(forStaff id: UUID) -> [Appointment] { appointments.filter { $0.staffId == id } }
    func messages(forClient id: UUID) -> [Message] { messages.filter { $0.clientId == id }.sorted { $0.sentAt < $1.sentAt } }

    // MARK: - Mutations

    func createStore(name: String, address: String) {
        let s = Store(id: UUID(), name: name, address: address, timezone: TimeZone.current.identifier)
        stores.append(s)
        activeStoreId = s.id
    }

    func addClient(_ c: Client) { clients.append(c) }
    func updateClient(_ c: Client) {
        if let i = clients.firstIndex(where: { $0.id == c.id }) { clients[i] = c }
    }
    func deleteClient(_ id: UUID) {
        clients.removeAll { $0.id == id }
        pets.removeAll { $0.clientId == id }
    }

    func addPet(_ p: Pet) { pets.append(p) }
    func updatePet(_ p: Pet) {
        if let i = pets.firstIndex(where: { $0.id == p.id }) { pets[i] = p }
    }
    func deletePet(_ id: UUID) { pets.removeAll { $0.id == id } }

    func addStaff(_ s: StaffMember) { staff.append(s) }
    func updateStaff(_ s: StaffMember) {
        if let i = staff.firstIndex(where: { $0.id == s.id }) { staff[i] = s }
    }

    func addAppointment(_ a: Appointment) { appointments.append(a) }
    func updateAppointment(_ a: Appointment) {
        if let i = appointments.firstIndex(where: { $0.id == a.id }) { appointments[i] = a }
    }
    func deleteAppointment(_ id: UUID) { appointments.removeAll { $0.id == id } }

    func addExpense(_ e: Expense) { expenses.append(e) }
    func addReceipt(_ r: Receipt) { receipts.append(r) }
    func addInventory(_ i: InventoryItem) { inventory.append(i) }

    // MARK: - Computed totals

    var monthToDateRevenueCents: Int {
        let cal = Calendar.current
        let start = cal.dateInterval(of: .month, for: Date())?.start ?? Date()
        return receipts.filter { $0.date >= start }.reduce(0) { $0 + $1.totalCents }
    }

    var monthToDateExpensesCents: Int {
        let cal = Calendar.current
        let start = cal.dateInterval(of: .month, for: Date())?.start ?? Date()
        return expenses.filter { $0.date >= start }.reduce(0) { $0 + $1.amountCents }
    }

    var todaysAppointments: [Appointment] {
        let cal = Calendar.current
        return appointments
            .filter { cal.isDateInToday($0.start) }
            .sorted { $0.start < $1.start }
    }

    var dogsGroomedThisMonth: Int {
        let cal = Calendar.current
        let start = cal.dateInterval(of: .month, for: Date())?.start ?? Date()
        return appointments.filter { $0.start >= start && $0.status == .completed }.count
    }

    var bookedPercentage: Double {
        guard !staff.isEmpty else { return 0 }
        let totalSlots = staff.count * 8
        let booked = todaysAppointments.count
        return min(1, Double(booked) / Double(totalSlots))
    }

    // MARK: - Seeding

    private func seed() {
        let store = Store(
            id: UUID(),
            name: "Scruffy Butts – Main",
            address: "123 Ranch Road, Austin TX",
            timezone: TimeZone.current.identifier
        )
        stores = [store]
        activeStoreId = store.id

        // Services
        let bathBrush = Service(id: UUID(), name: "Bath & Brush",        category: "Grooming", priceCents: 4500,  durationMinutes: 60)
        let fullGroom = Service(id: UUID(), name: "Full Groom",          category: "Grooming", priceCents: 8500,  durationMinutes: 120)
        let nailTrim  = Service(id: UUID(), name: "Nail Trim",           category: "Add-on",   priceCents: 1500,  durationMinutes: 15)
        let teeth     = Service(id: UUID(), name: "Teeth Brushing",      category: "Add-on",   priceCents: 1000,  durationMinutes: 10)
        let deshed    = Service(id: UUID(), name: "De-shedding Treatment", category: "Specialty", priceCents: 6500, durationMinutes: 75)
        services = [bathBrush, fullGroom, nailTrim, teeth, deshed]

        // Staff
        let s1 = StaffMember(id: UUID(), firstName: "Avery",  lastName: "Brooks",   role: "Lead Groomer", email: "avery@scruffy.test",  phone: "+1 512 555 0101", hireDate: daysAgo(540), hourlyRateCents: 2400, commissionPercent: 0.40, active: true,  avatarSystemImage: "person.crop.circle.fill")
        let s2 = StaffMember(id: UUID(), firstName: "Jordan", lastName: "Patel",    role: "Groomer",       email: "jordan@scruffy.test", phone: "+1 512 555 0102", hireDate: daysAgo(220), hourlyRateCents: 2000, commissionPercent: 0.35, active: true,  avatarSystemImage: "person.crop.circle.fill")
        let s3 = StaffMember(id: UUID(), firstName: "Riley",  lastName: "Nguyen",   role: "Bather",        email: "riley@scruffy.test",  phone: "+1 512 555 0103", hireDate: daysAgo(95),  hourlyRateCents: 1800, commissionPercent: 0.20, active: true,  avatarSystemImage: "person.crop.circle.fill")
        let s4 = StaffMember(id: UUID(), firstName: "Sam",    lastName: "Rivera",   role: "Front Desk",    email: "sam@scruffy.test",    phone: "+1 512 555 0104", hireDate: daysAgo(60),  hourlyRateCents: 1700, commissionPercent: 0.0,  active: true,  avatarSystemImage: "person.crop.circle.fill")
        staff = [s1, s2, s3, s4]

        // Clients & pets
        let names: [(String, String, String, String)] = [
            ("Emma",   "Carter",   "emma.carter@example.com",   "+1 512 555 1101"),
            ("Liam",   "Diaz",     "liam.diaz@example.com",     "+1 512 555 1102"),
            ("Olivia", "Brown",    "olivia.brown@example.com",  "+1 512 555 1103"),
            ("Noah",   "Hayes",    "noah.hayes@example.com",    "+1 512 555 1104"),
            ("Ava",    "Kim",      "ava.kim@example.com",       "+1 512 555 1105"),
            ("Mason",  "Lopez",    "mason.lopez@example.com",   "+1 512 555 1106"),
            ("Sophia", "Nguyen",   "sophia.nguyen@example.com", "+1 512 555 1107"),
            ("Lucas",  "Patel",    "lucas.patel@example.com",   "+1 512 555 1108"),
        ]
        let petNames: [(String, String, String)] = [
            ("Biscuit",  "Goldendoodle",      "pawprint.fill"),
            ("Luna",     "Border Collie",     "pawprint.fill"),
            ("Cooper",   "Labrador Retriever","pawprint.fill"),
            ("Daisy",    "Shih Tzu",          "pawprint.fill"),
            ("Rocky",    "German Shepherd",   "pawprint.fill"),
            ("Bella",    "Cavalier KCS",      "pawprint.fill"),
            ("Milo",     "Cocker Spaniel",    "pawprint.fill"),
            ("Charlie",  "Mini Poodle",       "pawprint.fill"),
        ]
        for i in 0..<names.count {
            let n = names[i]
            let c = Client(
                id: UUID(),
                firstName: n.0, lastName: n.1,
                email: n.2, phone: n.3,
                notes: i == 0 ? "Prefers Saturday mornings." : "",
                createdAt: daysAgo(180 - i * 12)
            )
            clients.append(c)

            let pn = petNames[i]
            let p = Pet(
                id: UUID(), clientId: c.id, name: pn.0, breed: pn.1,
                weightLbs: Double(20 + i * 5),
                birthday: daysAgo(365 * (2 + i % 4)),
                notes: "",
                groomingPreferences: i % 2 == 0 ? "Short summer cut" : "Standard breed cut",
                medicalNotes: i == 3 ? "Sensitive skin – use oatmeal shampoo." : "",
                photoSystemImage: pn.2
            )
            pets.append(p)
        }

        // Appointments – today + upcoming + a few completed
        let cal = Calendar.current
        let todayStart = cal.startOfDay(for: Date())
        let staffIds = staff.map(\.id)
        let serviceIds = services.map(\.id)
        for i in 0..<6 {
            let pet = pets[i % pets.count]
            let svc = services[i % services.count]
            let start = cal.date(byAdding: .hour, value: 9 + i, to: todayStart)!
            let a = Appointment(
                id: UUID(), clientId: pet.clientId, petId: pet.id,
                staffId: staffIds[i % staffIds.count],
                serviceId: serviceIds[i % serviceIds.count],
                start: start, durationMinutes: svc.durationMinutes,
                status: i < 2 ? .completed : (i == 2 ? .inProgress : .scheduled),
                notes: ""
            )
            appointments.append(a)
        }
        for i in 0..<8 {
            let pet = pets[(i + 1) % pets.count]
            let svc = services[(i + 1) % services.count]
            let start = cal.date(byAdding: .day, value: i + 1, to: todayStart)!
                .addingTimeInterval(Double(9 + (i % 6)) * 3600)
            let a = Appointment(
                id: UUID(), clientId: pet.clientId, petId: pet.id,
                staffId: staffIds[(i + 1) % staffIds.count],
                serviceId: serviceIds[(i + 1) % serviceIds.count],
                start: start, durationMinutes: svc.durationMinutes,
                status: .scheduled, notes: ""
            )
            appointments.append(a)
        }
        for i in 0..<14 {
            let pet = pets[i % pets.count]
            let svc = services[i % services.count]
            let start = cal.date(byAdding: .day, value: -(i + 1), to: todayStart)!
                .addingTimeInterval(Double(10 + (i % 5)) * 3600)
            let a = Appointment(
                id: UUID(), clientId: pet.clientId, petId: pet.id,
                staffId: staffIds[i % staffIds.count],
                serviceId: serviceIds[i % serviceIds.count],
                start: start, durationMinutes: svc.durationMinutes,
                status: .completed, notes: ""
            )
            appointments.append(a)
        }

        // Inventory
        let invSeed: [(String, String, String, Int, Int, Int, Int)] = [
            ("Oatmeal Shampoo 1gal", "SHM-001", "Shampoo",       18, 6, 1200, 2400),
            ("Conditioner 1gal",     "CON-001", "Shampoo",       12, 5, 1100, 2200),
            ("De-shed Tool",         "TLS-014", "Tools",          7, 4, 1800, 4500),
            ("Nail Clippers Pro",    "TLS-021", "Tools",          5, 3, 1500, 3500),
            ("Cologne – Lavender",   "FRG-101", "Finishing",     22, 8,  600, 1500),
            ("Bandanas (50pk)",      "ACC-301", "Accessories",   30, 10, 800, 2000),
            ("Bows (assorted)",      "ACC-302", "Accessories",    4, 12, 500, 1200),
        ]
        for s in invSeed {
            inventory.append(InventoryItem(
                id: UUID(), name: s.0, sku: s.1, category: s.2,
                quantityOnHand: s.3, reorderThreshold: s.4,
                unitCostCents: s.5, unitPriceCents: s.6
            ))
        }
        for item in inventory.prefix(4) {
            inventoryMovements.append(InventoryMovement(
                id: UUID(), itemId: item.id, delta: 24,
                reason: "Restock", date: daysAgo(7)
            ))
            inventoryMovements.append(InventoryMovement(
                id: UUID(), itemId: item.id, delta: -3,
                reason: "Sold at POS", date: daysAgo(2)
            ))
        }

        // Expenses
        let expSeed: [(String, ExpenseCategory, Int, Int, Bool)] = [
            ("Pet Supply Co.",     .supplies,  48000, 3,  false),
            ("Austin Power & Co",  .utilities, 18500, 5,  true),
            ("Property LLC",       .rent,     280000, 1,  true),
            ("Adobe Creative",     .software,  5499,  4,  true),
            ("Local Print Shop",   .marketing, 12000, 11, false),
            ("Kennel Equipment",   .equipment, 89000, 18, false),
        ]
        for e in expSeed {
            expenses.append(Expense(
                id: UUID(), date: daysAgo(e.3),
                vendor: e.0, category: e.1, amountCents: e.2,
                notes: "", recurring: e.4
            ))
        }

        // Upcoming bills
        bills = [
            Bill(id: UUID(), name: "Rent – Main",       dueDate: daysAhead(5),  amountCents: 280000, paid: false),
            Bill(id: UUID(), name: "Electric",          dueDate: daysAhead(9),  amountCents:  21500, paid: false),
            Bill(id: UUID(), name: "Internet",          dueDate: daysAhead(12), amountCents:   9900, paid: false),
            Bill(id: UUID(), name: "Insurance Premium", dueDate: daysAhead(20), amountCents:  64500, paid: false),
        ]

        // Receipts (recent revenue)
        for i in 0..<10 {
            let svc = services[i % services.count]
            let r = Receipt(
                id: UUID(),
                clientId: clients[i % clients.count].id,
                staffId: staffIds[i % staffIds.count],
                date: daysAgo(i),
                lines: [
                    ReceiptLine(id: UUID(), description: svc.name, quantity: 1, unitPriceCents: svc.priceCents),
                    ReceiptLine(id: UUID(), description: "Bandana", quantity: 1, unitPriceCents: 800),
                ],
                taxCents: 580, tipCents: 1000,
                paymentMethod: i % 3 == 0 ? .cash : .card,
                notes: ""
            )
            receipts.append(r)
        }

        // Messages
        for c in clients.prefix(5) {
            messages.append(Message(id: UUID(), clientId: c.id, inbound: true,
                body: "Hi! Just confirming our appointment.", sentAt: daysAgo(1)))
            messages.append(Message(id: UUID(), clientId: c.id, inbound: false,
                body: "Confirmed! See you then.", sentAt: daysAgo(1).addingTimeInterval(900)))
        }

        // Activity feed
        activity = [
            ActivityEvent(id: UUID(), date: hoursAgo(1),  icon: "checkmark.circle.fill", title: "Appointment completed", subtitle: "Biscuit with Avery"),
            ActivityEvent(id: UUID(), date: hoursAgo(3),  icon: "creditcard.fill",       title: "Payment received",      subtitle: "$95.00 from Emma Carter"),
            ActivityEvent(id: UUID(), date: hoursAgo(5),  icon: "person.badge.plus",     title: "New client",            subtitle: "Lucas Patel added"),
            ActivityEvent(id: UUID(), date: hoursAgo(8),  icon: "bubble.left.fill",      title: "New message",           subtitle: "From Sophia Nguyen"),
            ActivityEvent(id: UUID(), date: daysAgo(1),   icon: "shippingbox.fill",      title: "Inventory restock",     subtitle: "Oatmeal Shampoo +24"),
        ]
    }

    private func daysAgo(_ d: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: -d, to: Date()) ?? Date()
    }
    private func daysAhead(_ d: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: d, to: Date()) ?? Date()
    }
    private func hoursAgo(_ h: Int) -> Date {
        Calendar.current.date(byAdding: .hour, value: -h, to: Date()) ?? Date()
    }
}
