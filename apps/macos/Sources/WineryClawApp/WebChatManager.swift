import AppKit
import Foundation

enum WebChatDisplayMode: String {
    case swiftUI
    case webView
}

final class WebChatPanel: NSPanel {
    override var canBecomeKey: Bool {
        true
    }

    override var canBecomeMain: Bool {
        true
    }
}

enum WebChatPresentation {
    case window
    case panel(anchorProvider: () -> NSRect?)

    var isPanel: Bool {
        if case .panel = self { return true }
        return false
    }
}

@MainActor
final class WebChatManager {
    static let shared = WebChatManager()

    private var windowController: WebChatSwiftUIWindowController?
    private var windowSessionKey: String?
    private var panelController: WebChatSwiftUIWindowController?
    private var panelSessionKey: String?
    private var cachedPreferredSessionKey: String?

    private var webViewWindowController: WebChatWKWebViewWindowController?
    private var webViewPanelController: WebChatWKWebViewWindowController?

    var displayMode: WebChatDisplayMode = .webView

    var webUIURL: URL {
        URL(string: "http://127.0.0.1:19001")!
    }

    var onPanelVisibilityChanged: ((Bool) -> Void)?

    var activeSessionKey: String? {
        self.panelSessionKey ?? self.windowSessionKey
    }

    func show(sessionKey: String) {
        if self.displayMode == .webView {
            self.showWebView(sessionKey: sessionKey)
            return
        }

        self.closePanel()
        if let controller = self.windowController {
            if self.windowSessionKey == sessionKey {
                controller.show()
                return
            }

            controller.close()
            self.windowController = nil
            self.windowSessionKey = nil
        }
        let controller = WebChatSwiftUIWindowController(sessionKey: sessionKey, presentation: .window)
        controller.onVisibilityChanged = { [weak self] visible in
            self?.onPanelVisibilityChanged?(visible)
        }
        self.windowController = controller
        self.windowSessionKey = sessionKey
        controller.show()
    }

    private func showWebView(sessionKey: String) {
        self.closePanel()

        if let controller = self.webViewWindowController {
            controller.show()
            return
        }

        let controller = WebChatWKWebViewWindowController(
            url: self.webUIURL,
            presentation: .window)
        controller.onVisibilityChanged = { [weak self] visible in
            self?.onPanelVisibilityChanged?(visible)
        }
        self.webViewWindowController = controller
        controller.show()
    }

    func togglePanel(sessionKey: String, anchorProvider: @escaping () -> NSRect?) {
        if self.displayMode == .webView {
            self.toggleWebViewPanel(anchorProvider: anchorProvider)
            return
        }

        if let controller = self.panelController {
            if self.panelSessionKey != sessionKey {
                controller.close()
                self.panelController = nil
                self.panelSessionKey = nil
            } else {
                if controller.isVisible {
                    controller.close()
                } else {
                    controller.presentAnchored(anchorProvider: anchorProvider)
                }
                return
            }
        }

        let controller = WebChatSwiftUIWindowController(
            sessionKey: sessionKey,
            presentation: .panel(anchorProvider: anchorProvider))
        controller.onClosed = { [weak self] in
            self?.panelHidden()
        }
        controller.onVisibilityChanged = { [weak self] visible in
            self?.onPanelVisibilityChanged?(visible)
        }
        self.panelController = controller
        self.panelSessionKey = sessionKey
        controller.presentAnchored(anchorProvider: anchorProvider)
    }

    private func toggleWebViewPanel(anchorProvider: @escaping () -> NSRect?) {
        if let controller = self.webViewPanelController {
            if controller.isVisible {
                controller.close()
            } else {
                controller.presentAnchored(anchorProvider: anchorProvider)
            }
            return
        }

        let controller = WebChatWKWebViewWindowController(
            url: self.webUIURL,
            presentation: .panel(anchorProvider: anchorProvider))
        controller.onClosed = { [weak self] in
            self?.panelHidden()
        }
        controller.onVisibilityChanged = { [weak self] visible in
            self?.onPanelVisibilityChanged?(visible)
        }
        self.webViewPanelController = controller
        controller.presentAnchored(anchorProvider: anchorProvider)
    }

    func closePanel() {
        self.panelController?.close()
        self.webViewPanelController?.close()
    }

    func preferredSessionKey() async -> String {
        if let cachedPreferredSessionKey { return cachedPreferredSessionKey }
        let key = await GatewayConnection.shared.mainSessionKey()
        self.cachedPreferredSessionKey = key
        return key
    }

    func resetTunnels() {
        self.windowController?.close()
        self.windowController = nil
        self.windowSessionKey = nil
        self.panelController?.close()
        self.panelController = nil
        self.panelSessionKey = nil
        self.cachedPreferredSessionKey = nil
        self.webViewWindowController?.close()
        self.webViewWindowController = nil
        self.webViewPanelController?.close()
        self.webViewPanelController = nil
    }

    func close() {
        self.resetTunnels()
    }

    private func panelHidden() {
        self.onPanelVisibilityChanged?(false)
    }
}
