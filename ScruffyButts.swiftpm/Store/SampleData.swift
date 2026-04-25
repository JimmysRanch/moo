import Foundation

/// Sample data used at first launch so the iOS app feels populated.
extension DataStore {
    static func seeded() -> DataStore {
        let store = DataStore()
        let cal = Calendar.current
        let today = Date()

        // Services
        let bath        = ServiceItem(name: "Full Bath",          price: 45,  durationMinutes: 45)
        let groom       = ServiceItem(name: "Full Groom",         price: 85,  durationMinutes: 90)
        let nails       = ServiceItem(name: "Nail Trim",          price: 15,  durationMinutes: 15)
        let teeth       = ServiceItem(name: "Teeth Brushing",     price: 12,  durationMinutes: 10)
        let dematting   = ServiceItem(name: "De-matting",         price: 35,  durationMinutes: 30)
        store.services = [bath, groom, nails, teeth, dematting]

        // Staff
        let owner    = Staff(firstName: "Jamie",   lastName: "Reyes",   role: .owner,    email: "jamie@scruffybutts.com",   compensationType: .salary,     rate: 70000)
        let manager  = Staff(firstName: "Morgan",  lastName: "Lee",     role: .manager,  email: "morgan@scruffybutts.com",  compensationType: .hourly,     rate: 28)
        let groomer  = Staff(firstName: "Riley",   lastName: "Patel",   role: .groomer,  email: "riley@scruffybutts.com",   compensationType: .commission, rate: 0, commissionPct: 45)
        let bather   = Staff(firstName: "Sky",     lastName: "Nguyen",  role: .bather,   email: "sky@scruffybutts.com",     compensationType: .hourly,     rate: 19)
        let recept   = Staff(firstName: "Avery",   lastName: "Brooks",  role: .receptionist, email: "avery@scruffybutts.com", compensationType: .hourly, rate: 17)
        store.staff = [owner, manager, groomer, bather, recept]

        // Clients + Pets
        let c1 = Client(firstName: "Sam",   lastName: "Carter",  phone: "(555) 010-1111", email: "sam@example.com",   address: "123 Maple St")
        let c2 = Client(firstName: "Dana",  lastName: "Holland", phone: "(555) 010-2222", email: "dana@example.com",  address: "98 Oak Ave")
        let c3 = Client(firstName: "Pat",   lastName: "Singh",   phone: "(555) 010-3333", email: "pat@example.com",   address: "551 Pine Rd")
        let c4 = Client(firstName: "Jordan",lastName: "Kim",     phone: "(555) 010-4444", email: "jordan@example.com",address: "12 Birch Ln")
        store.clients = [c1, c2, c3, c4]

        var p1 = Pet(clientId: c1.id, name: "Biscuit", breed: "Golden Retriever", weightLb: 68, groomingPreferences: "Short summer cut")
        var p2 = Pet(clientId: c1.id, name: "Mochi",   breed: "Shih Tzu",         weightLb: 14, groomingPreferences: "Teddy bear face")
        var p3 = Pet(clientId: c2.id, name: "Rocco",   breed: "Standard Poodle",  weightLb: 55, groomingPreferences: "Continental clip")
        var p4 = Pet(clientId: c3.id, name: "Pixel",   breed: "Border Collie",    weightLb: 38, groomingPreferences: "Tidy + sanitary")
        var p5 = Pet(clientId: c4.id, name: "Pumpkin", breed: "Cocker Spaniel",   weightLb: 27, groomingPreferences: "Skirt left long")
        store.pets = [p1, p2, p3, p4, p5]
        for pet in store.pets {
            if let i = store.clients.firstIndex(where: { $0.id == pet.clientId }) {
                store.clients[i].petIds.append(pet.id)
            }
        }
        _ = (p1, p2, p3, p4, p5) // silence unused warnings on iOS 16 release builds

        // Appointments — a couple today, a couple this week
        let nine  = cal.date(bySettingHour: 9,  minute: 0, second: 0, of: today)!
        let elev  = cal.date(bySettingHour: 11, minute: 0, second: 0, of: today)!
        let two   = cal.date(bySettingHour: 14, minute: 30, second: 0, of: today)!
        let tmrw  = cal.date(byAdding: .day, value: 1, to: nine)!
        let next  = cal.date(byAdding: .day, value: 3, to: nine)!

        store.appointments = [
            Appointment(clientId: c1.id, petId: store.pets[0].id, staffId: groomer.id,
                        serviceIds: [groom.id], start: nine,  durationMinutes: 90, status: .completed),
            Appointment(clientId: c2.id, petId: store.pets[2].id, staffId: groomer.id,
                        serviceIds: [groom.id, nails.id], start: elev, durationMinutes: 105),
            Appointment(clientId: c3.id, petId: store.pets[3].id, staffId: bather.id,
                        serviceIds: [bath.id, teeth.id], start: two,  durationMinutes: 60),
            Appointment(clientId: c4.id, petId: store.pets[4].id, staffId: groomer.id,
                        serviceIds: [groom.id], start: tmrw, durationMinutes: 90),
            Appointment(clientId: c1.id, petId: store.pets[1].id, staffId: bather.id,
                        serviceIds: [bath.id], start: next, durationMinutes: 45)
        ]

        // Inventory
        store.inventory = [
            InventoryItem(name: "Oatmeal Shampoo",    sku: "SHM-001", quantity: 12, reorderLevel: 5, unitCost: 6.5,  unitPrice: 14),
            InventoryItem(name: "De-shedding Conditioner", sku: "CON-002", quantity: 4, reorderLevel: 6, unitCost: 8.0, unitPrice: 18),
            InventoryItem(name: "Nail Grinder Bits",  sku: "EQP-003", quantity: 22, reorderLevel: 5, unitCost: 1.2, unitPrice: 4),
            InventoryItem(name: "Bandanas (10pk)",    sku: "RTL-004", quantity: 9,  reorderLevel: 3, unitCost: 3.0, unitPrice: 8),
            InventoryItem(name: "Ear Cleaner",        sku: "MED-005", quantity: 2,  reorderLevel: 4, unitCost: 5.5, unitPrice: 13)
        ]

        // Expenses
        store.expenses = [
            Expense(date: cal.date(byAdding: .day, value: -1,  to: today)!, amount: 142.50, category: .supplies,  vendor: "PetPro Wholesale", notes: "Shampoo restock"),
            Expense(date: cal.date(byAdding: .day, value: -3,  to: today)!, amount: 1200,   category: .rent,      vendor: "Maple Plaza LLC"),
            Expense(date: cal.date(byAdding: .day, value: -5,  to: today)!, amount: 89.99,  category: .utilities, vendor: "City Power"),
            Expense(date: cal.date(byAdding: .day, value: -8,  to: today)!, amount: 220,    category: .marketing, vendor: "Local Paper Ad"),
            Expense(date: cal.date(byAdding: .day, value: -12, to: today)!, amount: 75,     category: .equipment, vendor: "Clipper Repair Co.")
        ]

        // Bills
        store.bills = [
            UpcomingBill(name: "Shop Rent",       amount: 1200, dueDate: cal.date(byAdding: .day, value: 5,  to: today)!),
            UpcomingBill(name: "Internet",        amount: 89,   dueDate: cal.date(byAdding: .day, value: 9,  to: today)!),
            UpcomingBill(name: "Insurance",       amount: 145,  dueDate: cal.date(byAdding: .day, value: 14, to: today)!),
            UpcomingBill(name: "Software (POS)",  amount: 49,   dueDate: cal.date(byAdding: .day, value: 21, to: today)!)
        ]

        // Payments (this month) — for revenue chart
        for offset in 0..<10 {
            let d = cal.date(byAdding: .day, value: -offset, to: today)!
            let total = Double(40 + (offset * 7) % 80)
            let p = Payment(
                date: d,
                clientId: store.clients.randomElement()?.id,
                appointmentId: nil,
                lines: [PaymentLine(description: "Service", amount: total)],
                taxRate: 0.0825,
                tip: 5,
                method: .card
            )
            store.payments.append(p)
        }

        // Conversations
        let conv1 = Conversation(clientId: c1.id, lastMessageAt: cal.date(byAdding: .hour, value: -2, to: today)!, unreadCount: 1)
        let conv2 = Conversation(clientId: c2.id, lastMessageAt: cal.date(byAdding: .hour, value: -26, to: today)!, unreadCount: 0)
        store.conversations = [conv1, conv2]
        store.messages = [
            ChatMessage(conversationId: conv1.id, direction: .outgoing, body: "Reminder: Biscuit's groom is tomorrow at 9 AM!", sentAt: cal.date(byAdding: .hour, value: -25, to: today)!),
            ChatMessage(conversationId: conv1.id, direction: .incoming, body: "Thanks! Could we add a nail trim?",                  sentAt: cal.date(byAdding: .hour, value: -2,  to: today)!),
            ChatMessage(conversationId: conv2.id, direction: .outgoing, body: "Rocco's all done — looking sharp!",                 sentAt: cal.date(byAdding: .hour, value: -26, to: today)!)
        ]

        // Initial activity feed
        store.activity = [
            ActivityEvent(kind: .appointmentCompleted, title: "Appointment completed",
                          subtitle: "Biscuit — Full Groom", date: nine.addingTimeInterval(60*90)),
            ActivityEvent(kind: .paymentReceived, title: "Payment received",
                          subtitle: Format.money(95.50), date: nine.addingTimeInterval(60*95)),
            ActivityEvent(kind: .messageReceived, title: "New message",
                          subtitle: "Sam Carter", date: cal.date(byAdding: .hour, value: -2, to: today)!)
        ]

        // Shifts (this week)
        for member in [groomer, bather, recept] {
            for d in 0..<5 {
                let start = cal.date(byAdding: .day, value: d, to: cal.date(bySettingHour: 8, minute: 0, second: 0, of: today)!)!
                let end   = cal.date(byAdding: .hour, value: 8, to: start)!
                store.shifts.append(.init(staffId: member.id, start: start, end: end))
            }
        }

        return store
    }
}
