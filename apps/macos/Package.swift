// swift-tools-version: 6.2
// Package manifest for the WineryClaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "WineryClaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "WineryClawIPC", targets: ["WineryClawIPC"]),
        .library(name: "WineryClawDiscovery", targets: ["WineryClawDiscovery"]),
        .executable(name: "WineryClaw", targets: ["WineryClaw"]),
        .executable(name: "openclaw-mac", targets: ["WineryClawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(url: "https://github.com/Blaizzy/mlx-audio-swift", exact: "0.1.2"),
        .package(path: "../shared/OpenClawKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "WineryClawIPC",
            dependencies: [],
            path: "Sources/WineryClawIPC",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "WineryClawDiscovery",
            dependencies: [
                .product(name: "WineryClawKit", package: "OpenClawKit"),
            ],
            path: "Sources/WineryClawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "WineryClaw",
            dependencies: [
                "WineryClawIPC",
                "WineryClawDiscovery",
                .product(name: "WineryClawKit", package: "OpenClawKit"),
                .product(name: "WineryClawChatUI", package: "OpenClawKit"),
                .product(name: "WineryClawProtocol", package: "OpenClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
                .product(name: "MLXAudioTTS", package: "mlx-audio-swift"),
            ],
            path: "Sources/WineryClawApp",
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "WineryClawMacCLI",
            dependencies: [
                "WineryClawDiscovery",
                .product(name: "WineryClawKit", package: "OpenClawKit"),
                .product(name: "WineryClawProtocol", package: "OpenClawKit"),
            ],
            path: "Sources/WineryClawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "WineryClawIPCTests",
            dependencies: [
                "WineryClawIPC",
                "WineryClaw",
                "WineryClawDiscovery",
                .product(name: "WineryClawProtocol", package: "OpenClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
