import Foundation

/// Everything that can go wrong talking to our API, already mapped from HTTP. View models switch on this.
enum APIError: Error, Equatable, Sendable {
    /// No response at all: server not running, no network, timeout.
    case transport
    /// The request was cancelled (e.g. the screen went away). Not shown to the user.
    case cancelled
    /// 400. `fields` is keyed by the JSON field name ("email", "q", …).
    case validation(fields: [String: String], message: String)
    case notFound
    case rateLimited(retryAfterSeconds: Int?)
    /// 502: the product source, image host or mail server failed.
    case upstream
    /// 500 or anything unexpected.
    case server
    /// 2xx but the body didn't match the contract.
    case decoding

    /// Maps a non-2xx response to an error, using the API's error envelope when present.
    static func from(status: Int, body: Data, retryAfter: String?) -> APIError {
        let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: body)
        switch (envelope?.error.code, status) {
        case ("VALIDATION_FAILED", _), (nil, 400):
            return .validation(fields: envelope?.error.fields ?? [:], message: envelope?.error.message ?? "")
        case ("NOT_FOUND", _), (nil, 404):
            return .notFound
        case ("RATE_LIMITED", _), (nil, 429):
            return .rateLimited(retryAfterSeconds: retryAfter.flatMap { Int($0) })
        case ("UPSTREAM_UNAVAILABLE", _), ("EMAIL_FAILED", _), (nil, 502), (nil, 503), (nil, 504):
            return .upstream
        default:
            return .server
        }
    }

    /// Copy shown to customers. Screens may override for context (e.g. "Category not found.").
    var userMessage: String {
        switch self {
        case .transport:
            #if DEBUG
                return "Can't reach the server. Is the API running? (docker compose up)"
            #else
                return "Check your connection and try again."
            #endif
        case .cancelled:
            return ""
        case .validation(_, let message):
            return message.isEmpty ? "Some fields need attention." : message
        case .notFound:
            return "We couldn't find that."
        case .rateLimited(let seconds):
            // Uses the server's Retry-After when it sent one.
            guard let seconds, seconds > 0 else { return "Too many enquiries. Please try again later." }
            let minutes = Int((Double(seconds) / 60).rounded(.up))
            return "Too many enquiries. Please try again in about \(minutes) minute\(minutes == 1 ? "" : "s")."
        case .upstream:
            return "We couldn't load products right now. Please try again."
        case .server, .decoding:
            return "Something went wrong. Please try again."
        }
    }
}

/// The API's error body: { "error": { "code", "message", "fields"?, "requestId" } }
struct ErrorEnvelope: Decodable, Sendable {
    struct Body: Decodable, Sendable {
        let code: String
        let message: String
        let fields: [String: String]?
        let requestId: String?
    }

    let error: Body
}
