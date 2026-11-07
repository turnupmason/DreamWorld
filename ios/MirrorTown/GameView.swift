import SwiftUI
import UIKit
import WebKit

/// Shows the game (the bundled web build) and passes Apple Health data into it.
///
/// Bridge:
/// - the game calls `window.webkit.messageHandlers.mirror.postMessage({type: "ready" | "refresh"})`
/// - `{type: "signIn", provider: "apple"}`: Sign in with Apple, answered with `window.onNativeSignIn(json)`
/// - `{type: "petReminders", items: [...]}`: schedule local notifications for the pets (see NativeServices.swift)
/// - we call `window.onNativeHealth(json)` with today's numbers and last night's sleep
/// - we call `window.onNativeWorkout(json)` while a workout is live ({active, type, start, hr})
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "mirror")
        config.allowsInlineMediaPlayback = true

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.965, green: 0.945, blue: 0.906, alpha: 1)   // #f6f1e7, same as the game
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }   // Safari > Develop can inspect it

        context.coordinator.web = web
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "prototype") {
            web.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else {
            web.loadHTMLString("<h2 style='font-family:-apple-system;padding:40px'>prototype/index.html is missing from the app bundle.</h2>", baseURL: nil)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        weak var web: WKWebView?
        private let health = HealthBridge()
        private let apple = AppleSignIn()
        private var timer: Timer?
        private var started = false

        override init() {
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "ready":
                health.requestAccess { [weak self] _ in self?.start() }
            case "refresh":
                pushHealth()
            case "signIn":
                DispatchQueue.main.async { self.apple.start { [weak self] json in self?.send("onNativeSignIn", json) } }
            case "petReminders":
                PetReminders.schedule(body["items"] as? [[String: Any]] ?? [])
            default:
                break
            }
        }

        private func start() {
            pushHealth()
            guard !started else { return }
            started = true
            DispatchQueue.main.async {
                self.timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in self?.pushHealth() }
            }
            health.onWorkout = { [weak self] json in self?.send("onNativeWorkout", json) }
            health.watchWorkouts { [weak self] in self?.pushHealth() }
        }

        @objc private func becameActive() { if started { pushHealth() } }

        private func pushHealth() {
            health.today { [weak self] json in self?.send("onNativeHealth", json) }
        }

        private func send(_ fn: String, _ json: String) {
            DispatchQueue.main.async { [weak self] in
                self?.web?.evaluateJavaScript("window.\(fn) && window.\(fn)(\(json))", completionHandler: nil)
            }
        }
    }
}
