import Testing
@testable import WineryClaw

@Suite(.serialized) struct WineryClawAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        WineryClawAppModelRegistry.appModel = registryModel
        defer { WineryClawAppModelRegistry.appModel = nil }

        let delegate = WineryClawAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        WineryClawAppModelRegistry.appModel = registryModel
        defer { WineryClawAppModelRegistry.appModel = nil }

        let delegate = WineryClawAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
