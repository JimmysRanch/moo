import SwiftUI

struct ClientsListView: View {
    @EnvironmentObject var data: DataStore
    @State private var search: String = ""
    @State private var showAdd = false

    var body: some View {
        List {
            ForEach(filtered) { c in
                NavigationLink {
                    ClientProfileView(clientId: c.id)
                } label: {
                    ClientRow(client: c)
                }
            }
            .onDelete { idx in
                for i in idx { data.deleteClient(filtered[i].id) }
            }
        }
        .listStyle(.plain)
        .searchable(text: $search, prompt: "Search clients & pets")
        .navigationTitle("Clients")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddClientView() }
        .overlay {
            if data.clients.isEmpty {
                EmptyStateView(systemImage: "person.crop.circle.badge.plus",
                               title: "No clients yet",
                               subtitle: "Tap + to add your first client.")
            }
        }
    }

    private var filtered: [Client] {
        let q = search.lowercased().trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return data.clients.sorted(by: { $0.lastName < $1.lastName }) }
        return data.clients.filter { client in
            if client.fullName.lowercased().contains(q) { return true }
            if client.phone.contains(q) { return true }
            if client.email.lowercased().contains(q) { return true }
            return data.pets(for: client.id).contains { $0.name.lowercased().contains(q) }
        }
    }
}

struct ClientRow: View {
    @EnvironmentObject var data: DataStore
    var client: Client
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.accentSoft).frame(width: 44, height: 44)
                Text(client.initials).font(.subheadline.bold()).foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading) {
                Text(client.fullName).font(.headline)
                let petNames = data.pets(for: client.id).map(\.name).joined(separator: ", ")
                Text(petNames.isEmpty ? client.phone : petNames)
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
}
