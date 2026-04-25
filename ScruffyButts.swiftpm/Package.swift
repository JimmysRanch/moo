// swift-tools-version: 5.9

// This is a Swift Playgrounds / Xcode App Package.
// Open `ScruffyButts.swiftpm` directly in Xcode 14+ or Swift Playgrounds 4+.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "ScruffyButts",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "ScruffyButts",
            targets: ["AppModule"],
            bundleIdentifier: "com.jimmysranch.scruffybutts",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .dog),
            accentColor: .presetColor(.purple),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
