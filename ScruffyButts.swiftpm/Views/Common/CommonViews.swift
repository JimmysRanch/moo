import SwiftUI

struct PuppyMascot: View {
    var size: CGFloat = 84
    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.accentSoft)
                .frame(width: size, height: size)
            Image(systemName: "pawprint.fill")
                .resizable()
                .scaledToFit()
                .padding(size * 0.25)
                .foregroundStyle(Theme.accent)
        }
        .accessibilityHidden(true)
    }
}

struct EmptyStateView: View {
    var systemImage: String
    var title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.muted)
            Text(title).font(.headline)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
    }
}

struct PlaceholderPage: View {
    var title: String
    var systemImage: String = "sparkles"
    var body: some View {
        EmptyStateView(systemImage: systemImage,
                       title: title,
                       subtitle: "This area is wired up — connect your backend to populate it with real data.")
            .navigationTitle(title)
    }
}
