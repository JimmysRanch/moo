import SwiftUI

/// Centralised colour palette + reusable view styling for Scruffy Butts.
/// Mirrors the Tailwind / shadcn theme used in the original `126/` web app
/// (purple accents, soft surfaces, rounded cards).
enum Theme {
    static let accent      = Color(red: 0.42, green: 0.27, blue: 0.86)   // ~#6B45DC
    static let accentSoft  = Color(red: 0.93, green: 0.89, blue: 1.00)
    static let background  = Color(.systemGroupedBackground)
    static let surface     = Color(.secondarySystemGroupedBackground)
    static let success     = Color(red: 0.16, green: 0.66, blue: 0.42)
    static let warning     = Color(red: 0.95, green: 0.61, blue: 0.07)
    static let danger      = Color(red: 0.86, green: 0.20, blue: 0.27)
    static let muted       = Color.secondary
}

// MARK: - Card style

struct CardModifier: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardModifier(padding: padding)) }
}

// MARK: - Currency / date formatting helpers

enum Format {
    static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        return f
    }()

    static func money(_ value: Double) -> String {
        currency.string(from: NSNumber(value: value)) ?? "$0.00"
    }

    static func shortDate(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .omitted)
    }

    static func dayTime(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.abbreviated).month().day().hour().minute())
    }
}
