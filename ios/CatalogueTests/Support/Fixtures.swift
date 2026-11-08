import Foundation

/// Reads the shared API contract from <repo>/contract/fixtures.
/// Found via this file's path on the Mac; simulator test processes can read it, so nothing is bundled.
enum Fixtures {
    static let directory: URL = URL(filePath: #filePath)
        .deletingLastPathComponent()  // Support
        .deletingLastPathComponent()  // CatalogueTests
        .deletingLastPathComponent()  // ios
        .deletingLastPathComponent()  // repo root
        .appending(path: "contract/fixtures")

    static func data(_ name: String) throws -> Data {
        try Data(contentsOf: directory.appending(path: name))
    }

    static func decode<T: Decodable>(_ type: T.Type, from name: String) throws -> T {
        try JSONDecoder().decode(type, from: data(name))
    }

    static func allNames() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))
            .filter { $0.hasSuffix(".json") }
            .sorted()
    }
}
