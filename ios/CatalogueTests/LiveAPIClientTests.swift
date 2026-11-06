import Foundation
import Testing
@testable import Catalogue

/// Tests the real HTTP client against a stubbed network (URLProtocol), so URL building, encoding,
/// headers and status-to-error mapping are checked without a server.
/// Serialized: the stub's handler is shared state.
@Suite(.serialized)
struct LiveAPIClientTests {
    private let baseURL = URL(string: "http://api.test")!

    private func client(_ handler: @escaping StubURLProtocol.Handler) -> LiveAPIClient {
        StubURLProtocol.handler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        configuration.urlCache = nil
        return LiveAPIClient(baseURL: baseURL, session: URLSession(configuration: configuration))
    }

    private func response(_ request: URLRequest, _ status: Int, headers: [String: String] = [:]) -> HTTPURLResponse {
        HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
    }

    @Test func getsHomeFromTheRightURLAndDecodesIt() async throws {
        let body = try Fixtures.data("home.json")
        var seen: URLRequest?
        let api = client { request in
            seen = request
            return (response(request, 200), body)
        }

        let home = try await api.home()

        #expect(home.featured.count == 5)
        #expect(seen?.url?.absoluteString == "http://api.test/v1/home")
        #expect(seen?.httpMethod == "GET")
        #expect(seen?.value(forHTTPHeaderField: "Accept") == "application/json")
    }

    @Test func encodesTheSearchTermAsOneQueryValue() async throws {
        let body = try Fixtures.data("search-no-results.json")
        var seen: URLRequest?
        let api = client { request in
            seen = request
            return (response(request, 200), body)
        }

        _ = try await api.search(term: "men's jacket & co")

        let url = try #require(seen?.url)
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        #expect(url.path() == "/v1/search")
        #expect(items == [URLQueryItem(name: "q", value: "men's jacket & co")])
    }

    @Test func postsTheEnquiryAsJSON() async throws {
        let body = try Fixtures.data("enquiry-accepted.json")
        var sentBody: [String: String]?
        var seen: URLRequest?
        let api = client { request in
            seen = request
            sentBody = try JSONSerialization.jsonObject(with: StubURLProtocol.body(of: request)) as? [String: String]
            return (response(request, 202), body)
        }

        let receipt = try await api.submitEnquiry(
            EnquiryRequest(productId: "3", name: "Ada", email: "ada@example.com", phone: nil, message: "Hi")
        )

        #expect(receipt.reference == "00000000-0000-4000-8000-000000000001")
        #expect(seen?.httpMethod == "POST")
        #expect(seen?.url?.absoluteString == "http://api.test/v1/enquiries")
        #expect(seen?.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(sentBody == ["productId": "3", "name": "Ada", "email": "ada@example.com", "message": "Hi"])
    }

    @Test func mapsAValidationErrorBody() async throws {
        let body = try Fixtures.data("error-validation.json")
        let api = client { request in (response(request, 400), body) }

        await #expect(throws: APIError.validation(
            fields: ["name": "Enter your name.", "email": "Enter a valid email address."],
            message: "Some fields need attention."
        )) {
            try await api.submitEnquiry(EnquiryRequest(productId: "3", name: "", email: "x", phone: nil, message: nil))
        }
    }

    @Test func readsRetryAfterFromA429() async throws {
        let body = try Fixtures.data("error-rate-limited.json")
        let api = client { request in (response(request, 429, headers: ["Retry-After": "120"]), body) }

        await #expect(throws: APIError.rateLimited(retryAfterSeconds: 120)) {
            try await api.submitEnquiry(EnquiryRequest(productId: "3", name: "Ada", email: "ada@example.com", phone: nil, message: nil))
        }
    }

    @Test func aBodyThatBreaksTheContractIsADecodingError() async {
        let api = client { request in (response(request, 200), Data(#"{"featured": "nope"}"#.utf8)) }

        await #expect(throws: APIError.decoding) { try await api.home() }
    }

    @Test func noConnectionIsATransportError() async {
        let api = client { _ in throw URLError(.cannotConnectToHost) }

        await #expect(throws: APIError.transport) { try await api.home() }
    }
}

/// Answers every request with whatever `handler` returns. Test-only.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    typealias Handler = (URLRequest) throws -> (HTTPURLResponse, Data)
    nonisolated(unsafe) static var handler: Handler?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    /// URLSession moves a request's body into a stream before it reaches a URLProtocol.
    static func body(of request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
