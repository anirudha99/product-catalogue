import Foundation
import Observation

@MainActor
@Observable
final class ProductViewModel {
    private(set) var state: LoadState<ProductDetail> = .loading
    let productID: String
    private let api: any APIClient

    init(api: any APIClient, productID: String) {
        self.api = api
        self.productID = productID
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        do throws(APIError) {
            state = .loaded(try await api.product(id: productID))
        } catch .cancelled {
            return
        } catch {
            state = .failed(error)
        }
    }

    /// 404 gets its own wording; everything else uses the shared copy.
    static func message(for error: APIError) -> String {
        error == .notFound ? "This product is no longer available." : error.userMessage
    }
}
