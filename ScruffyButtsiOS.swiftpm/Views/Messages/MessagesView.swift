import SwiftUI

struct MessagesView: View {
    @EnvironmentObject private var data: DataStore
    @State private var selectedClient: UUID?

    var body: some View {
        List(selection: $selectedClient) {
            ForEach(threads) { thread in
                NavigationLink(value: thread.clientId) {
                    HStack(spacing: 12) {
                        AvatarCircle(initials: data.client(thread.clientId)?.initials ?? "")
                        VStack(alignment: .leading, spacing: 2) {
                            Text(data.client(thread.clientId)?.name ?? "Unknown")
                                .font(.subheadline.weight(.semibold))
                            Text(thread.lastMessage)
                                .font(.caption).foregroundStyle(Theme.mutedText)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(DateFmt.relative(thread.lastDate))
                            .font(.caption2).foregroundStyle(Theme.mutedText)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Messages")
        .navigationDestination(for: UUID.self) { cid in
            MessageThreadView(clientId: cid)
        }
        .overlay { if threads.isEmpty {
            EmptyState(title: "No messages", message: "Conversations from clients will appear here.",
                       systemImage: "bubble.left.and.bubble.right")
        }}
    }

    private struct Thread: Identifiable {
        let clientId: UUID
        let lastMessage: String
        let lastDate: Date
        var id: UUID { clientId }
    }

    private var threads: [Thread] {
        let grouped = Dictionary(grouping: data.messages) { $0.clientId }
        return grouped.compactMap { (cid, msgs) -> Thread? in
            guard let last = msgs.max(by: { $0.sentAt < $1.sentAt }) else { return nil }
            return Thread(clientId: cid, lastMessage: last.body, lastDate: last.sentAt)
        }
        .sorted { $0.lastDate > $1.lastDate }
    }
}

struct MessageThreadView: View {
    @EnvironmentObject private var data: DataStore
    let clientId: UUID
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(data.messages(forClient: clientId)) { m in
                        HStack {
                            if !m.inbound { Spacer(minLength: 40) }
                            Text(m.body)
                                .padding(10)
                                .background(m.inbound ? Theme.card : Theme.primary,
                                            in: RoundedRectangle(cornerRadius: 14))
                                .foregroundStyle(m.inbound ? .primary : .white)
                            if m.inbound { Spacer(minLength: 40) }
                        }
                    }
                }
                .padding()
            }
            HStack {
                TextField("Message", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(10).background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
                Button {
                    let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    data.messages.append(Message(id: UUID(), clientId: clientId,
                                                  inbound: false, body: trimmed,
                                                  sentAt: Date()))
                    draft = ""
                } label: { Image(systemName: "paperplane.fill") }
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(8)
            .background(.bar)
        }
        .navigationTitle(data.client(clientId)?.name ?? "Conversation")
        .navigationBarTitleDisplayMode(.inline)
    }
}
