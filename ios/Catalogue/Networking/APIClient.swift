import Foundation

/// The only way the app reaches the backend. View models depend on this protocol, never on the HTTP stack,
/// so tests use MockAPIClient and a different transport only needs a new conformance.
protocol APIClient: Sendable {
    func home() async throws(APIError) -> HomeScreen
    func product(id: String) async throws(APIError) -> ProductDetail
}
