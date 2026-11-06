import Foundation

/// APIClient over HTTP. The only file in the app that uses URLSession.
final class LiveAPIClient: APIClient {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func home() async throws(APIError) -> HomeScreen {
        try await get("/v1/home")
    }

    func category(slug: String) async throws(APIError) -> CategoryScreen {
        try await get("/v1/categories/\(slug)")
    }

    func search(term: String) async throws(APIError) -> SearchResults {
        try await get("/v1/search", query: [URLQueryItem(name: "q", value: term)])
    }

    func product(id: String) async throws(APIError) -> ProductDetail {
        try await get("/v1/products/\(id)")
    }

    func submitEnquiry(_ enquiry: EnquiryRequest) async throws(APIError) -> EnquiryReceipt {
        // Longer than the server's worst case (product lookup + SMTP timeouts ≈ 25 s), so the app never gives up
        // on an enquiry that then gets sent, which would lead the customer to send it again.
        var request = URLRequest(url: baseURL.appending(path: "/v1/enquiries"), timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            request.httpBody = try JSONEncoder().encode(enquiry)
        } catch {
            throw .server
        }
        return try await send(request)
    }

    // MARK: - Transport

    private func get<Response: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws(APIError) -> Response {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty { components?.queryItems = query }
        guard let url = components?.url else { throw .server }

        var request = URLRequest(url: url, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws(APIError) -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw .cancelled
        } catch is CancellationError {
            throw .cancelled
        } catch {
            throw .transport
        }

        guard let http = response as? HTTPURLResponse else { throw .server }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.from(status: http.statusCode, body: data, retryAfter: http.value(forHTTPHeaderField: "Retry-After"))
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw .decoding
        }
    }
}
