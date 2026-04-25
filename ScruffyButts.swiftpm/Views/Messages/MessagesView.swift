import SwiftUI

struct MessagesView: View {
    @EnvironmentObject var data: DataStore

    var body: some View {
        List {
            ForEach(data.conversations.sorted(by: { $0.lastMessageAt > $1.lastMessageAt })) { conv in
                NavigationLink {
                    MessageThreadView(conversationId: conv.id)
                } label: {
                    ConversationRow(conv: conv)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Messages")
        .overlay {
            if data.conversations.isEmpty {
                EmptyStateView(systemImage: "bubble.left.and.bubble.right",
                               title: "No conversations",
                               subtitle: "Send your first message from a client profile.")
            }
        }
    }
}

struct ConversationRow: View {
    @EnvironmentObject var data: DataStore
    var conv: Conversation
    var body: some View {
        let client = data.client(conv.clientId)
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.accentSoft).frame(width: 44, height: 44)
                Text(client?.initials ?? "?")
                    .font(.subheadline.bold())
                    .foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading) {
                Text(client?.fullName ?? "Unknown").font(.headline)
                let last = data.messages(in: conv.id).last
                Text(last?.body ?? "—")
                    .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text(conv.lastMessageAt, style: .time)
                    .font(.caption2).foregroundStyle(.secondary)
                if conv.unreadCount > 0 {
                    Text("\(conv.unreadCount)")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Theme.accent)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct MessageThreadView: View {
    @EnvironmentObject var data: DataStore
    var conversationId: UUID
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(data.messages(in: conversationId)) { msg in
                            HStack {
                                if msg.direction == .outgoing { Spacer() }
                                Text(msg.body)
                                    .padding(10)
                                    .background(msg.direction == .outgoing ? Theme.accent : Theme.surface)
                                    .foregroundStyle(msg.direction == .outgoing ? .white : .primary)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                if msg.direction == .incoming { Spacer() }
                            }
                            .padding(.horizontal)
                            .id(msg.id)
                        }
                    }
                    .padding(.vertical)
                }
                .onChange(of: data.messages.count) { _ in
                    if let last = data.messages(in: conversationId).last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }
            HStack {
                TextField("Message", text: $draft, axis: .vertical)
                    .padding(10)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                Button {
                    let body = draft.trimmingCharacters(in: .whitespaces)
                    guard !body.isEmpty else { return }
                    data.send(message: body, in: conversationId)
                    draft = ""
                } label: {
                    Image(systemName: "paperplane.fill")
                        .padding(10)
                        .background(Theme.accent)
                        .foregroundStyle(.white)
                        .clipShape(Circle())
                }
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
            .background(Theme.background)
        }
        .navigationTitle(threadTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var threadTitle: String {
        guard let conv = data.conversations.first(where: { $0.id == conversationId }) else { return "Message" }
        return data.client(conv.clientId)?.fullName ?? "Message"
    }
}
