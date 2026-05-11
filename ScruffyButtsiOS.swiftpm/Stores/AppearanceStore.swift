import SwiftUI

/// Mirrors the appearance / theme settings from the original 126 web app.
@MainActor
final class AppearanceStore: ObservableObject {
    enum Mode: String, CaseIterable, Identifiable {
        case system, light, dark
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    enum AccentTheme: String, CaseIterable, Identifiable {
        case classic, sweetBlue = "sweet_blue", steelNoir = "steel_noir", blueSteel = "blue_steel", warm
        var id: String { rawValue }
        var label: String {
            switch self {
            case .classic:   return "Classic Purple"
            case .sweetBlue: return "Sweet Blue"
            case .steelNoir: return "Steel Noir"
            case .blueSteel: return "Blue Steel"
            case .warm:      return "Warm Sunset"
            }
        }
    }

    @Published var mode: Mode = .system
    @Published var accent: AccentTheme = .classic

    var colorScheme: ColorScheme? {
        switch mode {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}
