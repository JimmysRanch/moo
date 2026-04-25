import SwiftUI

/// Compact summary card used on the Dashboard.
struct StatWidget: View {
    let title: String
    let value: String
    let trend: String?
    let systemImage: String
    let tint: Color

    init(title: String, value: String, trend: String? = nil, systemImage: String, tint: Color = Theme.primary) {
        self.title = title
        self.value = value
        self.trend = trend
        self.systemImage = systemImage
        self.tint = tint
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(tint)
                    .padding(8)
                    .background(tint.opacity(0.15), in: Circle())
                Spacer()
                if let trend {
                    Text(trend)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.success)
                }
            }
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundStyle(.primary)
            Text(title)
                .font(.footnote)
                .foregroundStyle(Theme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

/// Section card – titled grouping used across the app.
struct SectionCard<Content: View>: View {
    let title: String
    let trailing: AnyView?
    @ViewBuilder var content: () -> Content

    init(_ title: String,
         @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.trailing = nil
        self.content = content
    }

    init<Trailing: View>(_ title: String,
                         trailing: Trailing,
                         @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.trailing = AnyView(trailing)
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                trailing
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

/// Empty state placeholder.
struct EmptyState: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 38, weight: .light))
                .foregroundStyle(Theme.mutedText)
            Text(title).font(.headline)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
    }
}

/// Status pill used by appointments / bills / receipts.
struct StatusPill: View {
    let text: String
    let tint: Color
    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(tint.opacity(0.18), in: Capsule())
            .foregroundStyle(tint)
    }
}

/// Avatar circle with initials – used wherever a person is shown.
struct AvatarCircle: View {
    let initials: String
    var size: CGFloat = 36
    var tint: Color = Theme.primary
    var body: some View {
        ZStack {
            Circle().fill(tint.opacity(0.18))
            Text(initials.isEmpty ? "?" : initials)
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(tint)
        }
        .frame(width: size, height: size)
    }
}

/// Friendly mascot used on auth / empty screens.
struct PuppyMascot: View {
    var size: CGFloat = 96
    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(colors: [Theme.primary.opacity(0.25), Theme.accent.opacity(0.25)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            Image(systemName: "pawprint.fill")
                .resizable().scaledToFit()
                .padding(size * 0.25)
                .foregroundStyle(Theme.primary)
        }
        .frame(width: size, height: size)
    }
}

/// Filled, primary call-to-action button.
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Theme.primary.opacity(configuration.isPressed ? 0.85 : 1),
                        in: RoundedRectangle(cornerRadius: Theme.smallRadius, style: .continuous))
            .foregroundStyle(.white)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primaryCTA: PrimaryButtonStyle { PrimaryButtonStyle() }
}

/// Convenience: format a date for short display.
enum DateFmt {
    static let dayMonth: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f
    }()
    static let dayMonthYear: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMM d, yyyy"; return f
    }()
    static let time: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
    static let weekdayDayMonth: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE MMM d"; return f
    }()
    static func relative(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }
}

extension AppointmentStatus {
    var tint: Color {
        switch self {
        case .scheduled:  return Theme.info
        case .inProgress: return Theme.warning
        case .completed:  return Theme.success
        case .cancelled:  return Theme.danger
        case .noShow:     return Theme.mutedText
        }
    }
}
