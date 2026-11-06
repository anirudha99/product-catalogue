import Foundation
import Testing
@testable import Catalogue

struct APIErrorTests {
    private let noBody = Data()

    @Test(arguments: [
        (400, APIError.validation(fields: [:], message: "")),
        (404, .notFound),
        (429, .rateLimited(retryAfterSeconds: nil)),
        (500, .server),
        (502, .upstream),
        (503, .upstream),
        (418, .server),
    ])
    func mapsStatusWhenBodyIsNotOurEnvelope(status: Int, expected: APIError) {
        #expect(APIError.from(status: status, body: Data("<html>".utf8), retryAfter: nil) == expected)
    }

    @Test func errorCodeWinsOverStatus() {
        let body = Data(#"{"error":{"code":"EMAIL_FAILED","message":"x","requestId":"r"}}"#.utf8)
        #expect(APIError.from(status: 500, body: body, retryAfter: nil) == .upstream)
    }

    @Test func readsRetryAfterSeconds() {
        #expect(APIError.from(status: 429, body: noBody, retryAfter: "120") == .rateLimited(retryAfterSeconds: 120))
        #expect(APIError.from(status: 429, body: noBody, retryAfter: "soon") == .rateLimited(retryAfterSeconds: nil))
    }

    @Test func everyUserFacingErrorHasCopy() {
        let errors: [APIError] = [.transport, .validation(fields: [:], message: ""), .notFound,
                                  .rateLimited(retryAfterSeconds: nil), .upstream, .server, .decoding]
        for error in errors {
            #expect(!error.userMessage.isEmpty, "no copy for \(error)")
        }
    }
}
