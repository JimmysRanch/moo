import SwiftUI

@main
struct ScruffyButtsApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var data = DataStore()
    @StateObject private var appearance = AppearanceStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(data)
                .environmentObject(appearance)
                .preferredColorScheme(appearance.colorScheme)
                .tint(Theme.primary)
        }
    }
}
