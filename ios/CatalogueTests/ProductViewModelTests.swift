import Testing
@testable import Catalogue

@MainActor
struct ProductViewModelTests {
    private let api = MockAPIClient()

    @Test func loadsTheRequestedProduct() async throws {
        let product = try Fixtures.decode(ProductDetail.self, from: "product-3.json")
        api.productResult = .success(product)
        let model = ProductViewModel(api: api, productID: "3")

        await model.load()

        #expect(model.state == .loaded(product))
        #expect(api.productRequests == ["3"])
    }

    @Test func unknownProductShowsItsOwnMessage() async {
        api.productResult = .failure(.notFound)
        let model = ProductViewModel(api: api, productID: "999")

        await model.load()

        #expect(model.state == .failed(.notFound))
        #expect(ProductViewModel.message(for: .notFound) == "This product is no longer available.")
    }

    @Test func otherErrorsUseTheSharedCopy() {
        #expect(ProductViewModel.message(for: .upstream) == APIError.upstream.userMessage)
    }
}
