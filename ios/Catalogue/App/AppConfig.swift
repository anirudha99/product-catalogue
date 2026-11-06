import Foundation

/// Values the build injects through ios/Config/*.xcconfig → Info.plist. No secrets live here.
struct AppConfig: Sendable {
    let apiBaseURL: URL

    /// Returns nil when APIBaseURL is missing or is not an absolute http(s) URL.
    init?(infoDictionary: [String: Any]) {
        guard
            let raw = infoDictionary["APIBaseURL"] as? String,
            let url = URL(string: raw),
            let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
            url.host() != nil
        else { return nil }
        apiBaseURL = url
    }

    /// Reads the app's Info.plist. A broken build setting stops the app at launch with a clear message
    /// instead of failing later on every request.
    static func fromMainBundle() -> AppConfig {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let config = AppConfig(infoDictionary: info) else {
            fatalError("APIBaseURL is missing or invalid (got \(String(describing: info["APIBaseURL"]))). Set API_SCHEME and API_HOST in ios/Config/*.xcconfig.")
        }
        return config
    }
}
