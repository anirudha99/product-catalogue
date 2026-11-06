import Foundation
import Testing
@testable import Catalogue

/// The app's Codable types must decode the shared contract fixtures. If the backend and app drift, this fails.
struct ContractDecodingTests {
    @Test func fixturesAreReachable() throws {
        #expect(try Fixtures.allNames().contains("home.json"))
    }

    @Test func homeDecodes() throws {
        let home = try Fixtures.decode(HomeScreen.self, from: "home.json")

        #expect(home.featured.map(\.id) == ["3", "5", "11", "12", "18"])
        #expect(home.categories.map(\.slug) == ["electronics", "jewellery", "mens-clothing", "womens-clothing"])

        let jacket = try #require(home.featured.first)
        #expect(jacket.title == "Mens Cotton Jacket")
        #expect(jacket.price == Money(amountMinor: 5599, currency: "USD"))
        #expect(jacket.price.decimalAmount == Decimal(string: "55.99"))
        #expect(jacket.rating == Rating(average: 4.7, count: 500))
        #expect(jacket.imagePath == "/v1/products/3/image")
    }

    @Test func categoryDecodes() throws {
        let screen = try Fixtures.decode(CategoryScreen.self, from: "category-electronics.json")
        #expect(screen.category == CategorySummary(slug: "electronics", name: "Electronics"))
        #expect(screen.topRated.map(\.id) == ["11", "12"])
        #expect(screen.more.map(\.id) == ["9", "10", "13", "14"])

        let noPicks = try Fixtures.decode(CategoryScreen.self, from: "category-no-picks.json")
        #expect(noPicks.topRated.isEmpty)
    }

    @Test func searchDecodes() throws {
        let results = try Fixtures.decode(SearchResults.self, from: "search-jacket.json")
        #expect(results.term == "jacket")
        #expect(results.results.count == 4)
        #expect(try Fixtures.decode(SearchResults.self, from: "search-no-results.json").results.isEmpty)
    }

    /// Every fixture is decoded by at least one test in this file; a new fixture must get one too.
    @Test func everyFixtureIsCovered() throws {
        let covered: Set<String> = [
            "home.json", "category-electronics.json", "category-no-picks.json", "search-jacket.json",
            "search-no-results.json", "product-3.json", "enquiry-accepted.json", "error-validation.json",
            "error-not-found.json", "error-rate-limited.json", "error-upstream.json",
        ]
        #expect(Set(try Fixtures.allNames()) == covered)
    }

    @Test func productDecodes() throws {
        let product = try Fixtures.decode(ProductDetail.self, from: "product-3.json")

        #expect(product.id == "3")
        #expect(product.category == CategorySummary(slug: "mens-clothing", name: "Men's Clothing"))
        #expect(product.description.hasPrefix("great outerwear jackets"))
        #expect(product.imagePath == "/v1/products/3/image")
    }

    @Test func enquiryReceiptDecodes() throws {
        let receipt = try Fixtures.decode(EnquiryReceipt.self, from: "enquiry-accepted.json")
        #expect(receipt.reference == "00000000-0000-4000-8000-000000000001")
    }

    @Test func enquiryRequestLeavesOutMissingOptionalFields() throws {
        let request = EnquiryRequest(productId: "3", name: "Ada", email: "ada@example.com", phone: nil, message: nil)
        let json = try #require(try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: String])
        #expect(json == ["productId": "3", "name": "Ada", "email": "ada@example.com"])
    }

    @Test(arguments: [
        ("error-validation.json", 400, APIError.validation(
            fields: ["name": "Enter your name.", "email": "Enter a valid email address."],
            message: "Some fields need attention."
        )),
        ("error-not-found.json", 404, .notFound),
        ("error-rate-limited.json", 429, .rateLimited(retryAfterSeconds: 900)),
        ("error-upstream.json", 502, .upstream),
    ])
    func errorFixturesMapToAPIError(file: String, status: Int, expected: APIError) throws {
        let body = try Fixtures.data(file)
        #expect(APIError.from(status: status, body: body, retryAfter: status == 429 ? "900" : nil) == expected)
    }
}
