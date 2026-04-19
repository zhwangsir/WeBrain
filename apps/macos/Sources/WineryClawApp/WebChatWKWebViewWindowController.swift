import AppKit
import WebKit

@MainActor
final class WebChatWKWebViewWindowController: NSObject, WKNavigationDelegate {
    enum Presentation {
        case window
        case panel(anchorProvider: () -> NSRect?)
    }

    private let presentation: Presentation
    private let webView: WKWebView
    private var window: NSWindow?
    private var panel: NSPanel?
    private var dismissMonitor: Any?
    var onClosed: (() -> Void)?
    var onVisibilityChanged: ((Bool) -> Void)?

    private static let windowSize = NSSize(width: 800, height: 600)
    private static let panelSize = NSSize(width: 480, height: 640)
    private static let anchorPadding: CGFloat = 8

    init(url: URL, presentation: Presentation) {
        self.presentation = presentation

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        self.webView = WKWebView(frame: .zero, configuration: config)
        self.webView.navigationDelegate = self

        super.init()

        self.setupWindow(url: url, presentation: presentation)
    }

    private func setupWindow(url: URL, presentation: Presentation) {
        switch presentation {
        case .window:
            let window = NSWindow(
                contentRect: NSRect(origin: .zero, size: Self.windowSize),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered,
                defer: false)
            window.title = "WineryClaw"
            window.contentView = self.webView
            window.isReleasedWhenClosed = false
            window.center()
            window.minSize = NSSize(width: 480, height: 360)
            self.window = window

        case .panel:
            let panel = WebChatPanel(
                contentRect: NSRect(origin: .zero, size: Self.panelSize),
                styleMask: [.borderless],
                backing: .buffered,
                defer: false)
            panel.level = .statusBar
            panel.hidesOnDeactivate = true
            panel.hasShadow = true
            panel.isMovable = false
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.backgroundColor = .clear
            panel.isOpaque = false
            panel.contentView = self.webView
            panel.becomesKeyOnlyIfNeeded = true

            if let anchorProvider = self.panelAnchorProvider() {
                let frame = Self.positionPanel(anchor: anchorProvider())
                panel.setFrame(frame, display: false)
            }

            self.panel = panel
        }
    }

    private func panelAnchorProvider() -> (() -> NSRect?)? {
        if case .panel(let anchorProvider) = presentation {
            return anchorProvider
        }
        return nil
    }

    private static func positionPanel(anchor: NSRect) -> NSRect {
        guard let screen = NSScreen.screens.first else {
            return NSRect(origin: .zero, size: panelSize)
        }

        let bounds = screen.visibleFrame.insetBy(
            dx: anchorPadding,
            dy: anchorPadding)

        let frame = WindowPlacement.anchoredBelowFrame(
            size: panelSize,
            anchor: anchor,
            padding: anchorPadding,
            in: bounds)
        return frame
    }

    var isVisible: Bool {
        self.window?.isVisible ?? self.panel?.isVisible ?? false
    }

    func show() {
        if let window = self.window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            self.onVisibilityChanged?(true)
        } else if let panel = self.panel {
            self.installDismissMonitor()
            let anchor = self.panelAnchorProvider?()()
            let targetFrame = Self.positionPanel(anchor: anchor ?? .zero)

            if !panel.isVisible {
                let start = targetFrame.offsetBy(dx: 0, dy: 8)
                panel.setFrame(start, display: true)
                panel.alphaValue = 0
                panel.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.18
                    context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                    panel.animator().setFrame(targetFrame, display: true)
                    panel.animator().alphaValue = 1
                }
            } else {
                panel.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
            }
            self.onVisibilityChanged?(true)
        }
    }

    func presentAnchored(anchorProvider: @escaping () -> NSRect?) {
        guard let panel = self.panel else { return }
        self.installDismissMonitor()

        let targetFrame = Self.positionPanel(anchor: anchorProvider())

        if !panel.isVisible {
            let start = targetFrame.offsetBy(dx: 0, dy: 8)
            panel.setFrame(start, display: true)
            panel.alphaValue = 0
            panel.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.18
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrame(targetFrame, display: true)
                panel.animator().alphaValue = 1
            }
        } else {
            panel.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        self.onVisibilityChanged?(true)
    }

    func close() {
        self.window?.orderOut(nil)
        self.panel?.orderOut(nil)
        self.onVisibilityChanged?(false)
        self.onClosed?()
        self.removeDismissMonitor()
    }

    func load(url: URL) {
        let request = URLRequest(url: url)
        self.webView.load(request)
    }

    private func installDismissMonitor() {
        if ProcessInfo.processInfo.isRunningTests { return }
        guard self.dismissMonitor == nil else { return }
        let panel = self.panel ?? self.window
        guard let window = panel else { return }

        self.dismissMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown])
        { [weak self] _ in
            guard let self else { return }
            let pt = NSEvent.mouseLocation
            if !window.frame.contains(pt) {
                self.close()
            }
        }
    }

    private func removeDismissMonitor() {
        if let monitor = self.dismissMonitor {
            NSEvent.removeMonitor(monitor)
            self.dismissMonitor = nil
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("document.title") { result, error in
            if let title = result as? String, !title.isEmpty {
                self.window?.title = title
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void)
    {
        if navigationAction.navigationType == .linkActivated {
            if let url = navigationAction.request.url,
               url.scheme == "http" || url.scheme == "https"
            {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }
}
