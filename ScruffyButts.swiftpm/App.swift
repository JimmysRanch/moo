import SwiftUI

@main
struct ScruffyButtsApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var data = DataStore.seeded()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(data)
                .tint(Theme.accent)
        }
    }
}
