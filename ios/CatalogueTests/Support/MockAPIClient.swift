@testable import Catalogue

/// Test double for APIClient. Set a result per endpoint; calls are counted.
/// @unchecked Sendable: only ever used from one test at a time.
final class MockAPIClient: APIClient, @unchecked Sendable {
    var homeResult: Result<HomeScreen, APIError> = .failure(.server)
    private(set) var homeCalls = 0

    func home() async throws(APIError) -> HomeScreen {
        homeCalls += 1
        return try homeResult.get()
    }

    var productResult: Result<ProductDetail, APIError> = .failure(.server)
    private(set) var productRequests: [String] = []

    func product(id: String) async throws(APIError) -> ProductDetail {
        productRequests.append(id)
        return try productResult.get()
    }

    var enquiryResult: Result<EnquiryReceipt, APIError> = .failure(.server)
    private(set) var enquiries: [EnquiryRequest] = []

    func submitEnquiry(_ enquiry: EnquiryRequest) async throws(APIError) -> EnquiryReceipt {
        enquiries.append(enquiry)
        return try enquiryResult.get()
    }
}
