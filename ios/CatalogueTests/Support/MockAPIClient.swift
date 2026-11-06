@testable import Catalogue

/// Test double for APIClient. Set a result per endpoint; calls are recorded.
/// @unchecked Sendable: only ever used from one test at a time, on the main actor.
final class MockAPIClient: APIClient, @unchecked Sendable {
    var homeResult: Result<HomeScreen, APIError> = .failure(.server)
    private(set) var homeCalls = 0

    func home() async throws(APIError) -> HomeScreen {
        homeCalls += 1
        return try homeResult.get()
    }

    var categoryResult: Result<CategoryScreen, APIError> = .failure(.server)
    private(set) var categoryRequests: [String] = []

    func category(slug: String) async throws(APIError) -> CategoryScreen {
        categoryRequests.append(slug)
        return try categoryResult.get()
    }

    var searchResult: Result<SearchResults, APIError> = .failure(.server)
    private(set) var searchRequests: [String] = []

    func search(term: String) async throws(APIError) -> SearchResults {
        searchRequests.append(term)
        return try searchResult.get()
    }

    var productResult: Result<ProductDetail, APIError> = .failure(.server)
    private(set) var productRequests: [String] = []

    func product(id: String) async throws(APIError) -> ProductDetail {
        productRequests.append(id)
        return try productResult.get()
    }

    var enquiryResult: Result<EnquiryReceipt, APIError> = .failure(.server)
    /// When set, submitEnquiry waits here until the test opens the gate (to test "while sending").
    var enquiryGate: Gate?
    private(set) var enquiries: [EnquiryRequest] = []

    func submitEnquiry(_ enquiry: EnquiryRequest) async throws(APIError) -> EnquiryReceipt {
        enquiries.append(enquiry)
        if let enquiryGate { await enquiryGate.wait() }
        return try enquiryResult.get()
    }
}

/// Holds an async call open until `open()` is called.
final class Gate: @unchecked Sendable {
    private var continuation: CheckedContinuation<Void, Never>?
    var isWaiting: Bool { continuation != nil }

    func wait() async {
        await withCheckedContinuation { continuation = $0 }
    }

    func open() {
        continuation?.resume()
        continuation = nil
    }
}
