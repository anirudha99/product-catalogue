import Foundation
import Testing
@testable import Catalogue

struct AppConfigTests {
    @Test func readsTheBaseURL() throws {
        let config = try #require(AppConfig(infoDictionary: ["APIBaseURL": "http://localhost:3000"]))
        #expect(config.apiBaseURL.absoluteString == "http://localhost:3000")
    }

    @Test(arguments: [
        [:],
        ["APIBaseURL": ""],
        ["APIBaseURL": "localhost:3000"],          // no scheme
        ["APIBaseURL": "ftp://localhost"],         // not http(s)
        ["APIBaseURL": "$(API_SCHEME)://$(API_HOST)"], // build setting not substituted
    ] as [[String: String]])
    func rejectsMissingOrBadValues(info: [String: String]) {
        #expect(AppConfig(infoDictionary: info) == nil)
    }

    @Test func theBuiltAppHasAUsableBaseURL() {
        // Proves the xcconfig → Info.plist wiring in the real app bundle the tests run inside.
        #expect(AppConfig(infoDictionary: Bundle.main.infoDictionary ?? [:]) != nil)
    }
}
