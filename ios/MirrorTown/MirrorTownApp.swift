import SwiftUI

// 镜像小镇 Mirror Town
// The game itself (drawing, rules, UI) is the web build in ../prototype, bundled into the app and run in a
// WKWebView. Swift does what only a native app can: read Apple Health and hand the numbers to the game.

@main
struct MirrorTownApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()   // the web layer keeps clear of the notch and home bar itself (env(safe-area-inset-*))
                .preferredColorScheme(.light)
        }
    }
}
