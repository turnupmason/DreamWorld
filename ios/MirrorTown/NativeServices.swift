import AuthenticationServices
import Foundation
import UIKit
import UserNotifications

/// Sign in with Apple, for the game's sign-in screen.
/// The game calls `postMessage({type: "signIn", provider: "apple"})`; we answer with
/// `window.onNativeSignIn({ok, provider, id, email, name})` (or `{ok: false, error}`).
/// Needs the "Sign in with Apple" capability, which needs a paid Apple Developer account. Without it Apple
/// returns an error, and the game falls back to a stand-in sign-in so testing still works.
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var done: ((String) -> Void)?

    func start(_ done: @escaping (String) -> Void) {
        self.done = done
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential else {
            finish(["ok": false, "provider": "apple", "error": "no credential"])
            return
        }
        var name = ""
        if let parts = cred.fullName { name = PersonNameComponentsFormatter().string(from: parts) }
        // Apple only sends the email and name the first time; later sign-ins carry just the stable user id.
        finish(["ok": true, "provider": "apple", "id": cred.user, "email": cred.email ?? "", "name": name])
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        finish(["ok": false, "provider": "apple", "error": error.localizedDescription])
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.compactMap { $0.keyWindow }.first ?? ASPresentationAnchor()
    }

    private func finish(_ result: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: result)) ?? Data("{}".utf8)
        done?(String(data: data, encoding: .utf8) ?? "{}")
        done = nil
    }
}

/// Pet reminders as local notifications: the game sends the next time each pet will need food, water,
/// a clean litter box / a walk, or some love, as `{type: "petReminders", items: [{id, at, title, body}]}`
/// (`at` in milliseconds since 1970). We replace all earlier pet reminders with these. An empty list turns them off.
/// v0.54: the same for the sports leagues (`{type: "sportReminders", items}`: today's games, a game you bet on ends),
/// with their own prefix so the two lists don't replace each other.
enum PetReminders {
    static func schedule(_ items: [[String: Any]], prefix: String = "pet-") {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let old = pending.map { $0.identifier }.filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: old)
            guard !items.isEmpty else { return }
            center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                guard granted else { return }
                for item in items {
                    guard let id = item["id"] as? String,
                          let at = (item["at"] as? NSNumber)?.doubleValue,
                          let title = item["title"] as? String else { continue }
                    let seconds = at / 1000 - Date().timeIntervalSince1970
                    guard seconds > 1 else { continue }
                    let content = UNMutableNotificationContent()
                    content.title = title
                    content.body = item["body"] as? String ?? ""
                    content.sound = .default
                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
                    center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
                }
            }
        }
    }
}
