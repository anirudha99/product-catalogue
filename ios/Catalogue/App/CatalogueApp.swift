import SwiftUI

/// Composition root: the only place that reads config and builds the real APIClient.
@main
struct CatalogueApp: App {
    private let config: AppConfig
    private let api: any APIClient

    init() {
        // Product images are ~300 KB; the default cache is too small to keep them.
        URLCache.shared = URLCache(memoryCapacity: 20_000_000, diskCapacity: 100_000_000)
        config = AppConfig.fromMainBundle()
        api = LiveAPIClient(baseURL: config.apiBaseURL)
    }

    var body: some Scene {
        WindowGroup {
            HomeView(api: api)
                .environment(\.apiBaseURL, config.apiBaseURL)
        }
    }
}

extension EnvironmentValues {
    /// Lets RemoteImage turn the API's relative image paths into URLs.
    @Entry var apiBaseURL: URL = URL(string: "http://localhost:3000")!
}
