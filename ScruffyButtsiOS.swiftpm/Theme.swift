import SwiftUI

/// Centralised colours / spacing / typography used throughout the Scruffy Butts iOS app.
/// Mirrors the Tailwind / Radix tokens used by the original 126 web app.
enum Theme {
    static let primary       = Color(red: 0.51, green: 0.30, blue: 0.93) // purple-600 vibe
    static let primaryDark   = Color(red: 0.36, green: 0.18, blue: 0.78)
    static let accent        = Color(red: 0.99, green: 0.70, blue: 0.31) // soft amber
    static let success       = Color(red: 0.13, green: 0.69, blue: 0.42)
    static let warning       = Color(red: 0.95, green: 0.62, blue: 0.05)
    static let danger        = Color(red: 0.86, green: 0.21, blue: 0.27)
    static let info          = Color(red: 0.18, green: 0.51, blue: 0.93)

    static let background    = Color(.systemGroupedBackground)
    static let card          = Color(.secondarySystemGroupedBackground)
    static let border        = Color(.separator)
    static let mutedText     = Color(.secondaryLabel)

    /// Sweet-blue gradient used as the auth / onboarding backdrop in the original web app.
    static let sweetBlueTop    = Color(red: 0.49, green: 0.69, blue: 0.97)
    static let sweetBlueBottom = Color(red: 0.27, green: 0.45, blue: 0.85)

    static let cornerRadius: CGFloat = 14
    static let smallRadius:  CGFloat = 10
}

extension View {
    /// Standard "card" container styling used across the app.
    func cardStyle() -> some View {
        self
            .padding(14)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.border, lineWidth: 0.5)
            )
    }
}
