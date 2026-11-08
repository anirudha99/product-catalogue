import Foundation

// Response and request types for our API (/v1). They mirror contract/fixtures exactly;
// ContractDecodingTests decodes every fixture into these types, so drift fails a test.

struct Money: Codable, Hashable, Sendable {
    /// Whole minor units (cents). Never a floating-point price.
    let amountMinor: Int
    /// ISO 4217 code, e.g. "USD".
    let currency: String

    var decimalAmount: Decimal { Decimal(amountMinor) / 100 }
}

struct Rating: Codable, Hashable, Sendable {
    let average: Double
    let count: Int
}

struct CategorySummary: Codable, Hashable, Sendable, Identifiable {
    let slug: String
    let name: String

    var id: String { slug }
}

struct ProductSummary: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let title: String
    let price: Money
    let rating: Rating
    /// Relative to the API base URL. The app never sees the product source's own image host.
    let imagePath: String
}

/// GET /v1/products/{id}
struct ProductDetail: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let title: String
    let price: Money
    let rating: Rating
    let imagePath: String
    let description: String
    let category: CategorySummary
}

extension ProductDetail {
    var summary: ProductSummary {
        ProductSummary(id: id, title: title, price: price, rating: rating, imagePath: imagePath)
    }
}

/// POST /v1/enquiries body. Optional fields that are nil are left out of the JSON, not sent as "".
struct EnquiryRequest: Codable, Hashable, Sendable {
    let productId: String
    let name: String
    let email: String
    let phone: String?
    let message: String?
}

/// POST /v1/enquiries → 202
struct EnquiryReceipt: Codable, Hashable, Sendable {
    let reference: String
}

/// GET /v1/categories/{slug}
struct CategoryScreen: Codable, Hashable, Sendable {
    let category: CategorySummary
    /// The business's chosen top-rated products in this category. Can be empty.
    let topRated: [ProductSummary]
    let more: [ProductSummary]
}

/// GET /v1/search?q=
struct SearchResults: Codable, Hashable, Sendable {
    let term: String
    let results: [ProductSummary]
}

/// GET /v1/home
struct HomeScreen: Codable, Hashable, Sendable {
    let featured: [ProductSummary]
    let categories: [CategorySummary]
}
