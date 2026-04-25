import SwiftUI

struct AppointmentsView: View {
    @EnvironmentObject var data: DataStore
    @State private var selectedDate: Date = Date()
    @State private var showNew = false

    var body: some View {
        VStack(spacing: 0) {
            DatePicker("Day",
                       selection: $selectedDate,
                       displayedComponents: .date)
                .datePickerStyle(.compact)
                .padding(.horizontal)
                .padding(.vertical, 8)

            let items = data.appointments(on: selectedDate)
            if items.isEmpty {
                EmptyStateView(systemImage: "calendar.badge.exclamationmark",
                               title: "No appointments",
                               subtitle: "Tap + to book a new appointment.")
                Spacer()
            } else {
                List {
                    ForEach(items) { appt in
                        NavigationLink {
                            EditAppointmentView(appointment: appt)
                        } label: {
                            AppointmentRow(appointment: appt)
                                .listRowInsets(EdgeInsets())
                                .listRowBackground(Color.clear)
                        }
                        .listRowSeparator(.hidden)
                    }
                    .onDelete { idx in
                        for i in idx { data.deleteAppointment(items[i].id) }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Appointments")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNew) {
            NewAppointmentView(defaultDate: selectedDate)
        }
    }
}
