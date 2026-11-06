import Foundation
import Observation

@MainActor
@Observable
final class EnquiryViewModel {
    enum Phase: Equatable {
        case editing
        case submitting
        case submitted(reference: String)
    }

    /// The form's fields. Keys match the API's JSON names so server errors land on the right field.
    enum Field: String, CaseIterable {
        case name, email, phone, message
    }

    var name = ""
    var email = ""
    var phone = ""
    var message = ""

    private(set) var phase: Phase = .editing
    /// One message per field, from the app's quick check or from the API's 400.
    private(set) var fieldErrors: [Field: String] = [:]
    /// A problem that isn't about one field (rate limit, email failed, no connection).
    private(set) var formError: String?

    let product: ProductSummary
    private let api: any APIClient

    init(api: any APIClient, product: ProductSummary) {
        self.api = api
        self.product = product
    }

    func submit() async {
        guard phase == .editing else { return } // ignore a second tap while sending
        formError = nil
        fieldErrors = quickCheck()
        guard fieldErrors.isEmpty else { return }

        phase = .submitting
        do throws(APIError) {
            let receipt = try await api.submitEnquiry(request())
            phase = .submitted(reference: receipt.reference)
        } catch {
            phase = .editing
            show(error)
        }
    }

    /// Only "is it filled in?". The backend does the real validation and its messages are shown as-is.
    private func quickCheck() -> [Field: String] {
        var errors: [Field: String] = [:]
        if name.trimmed.isEmpty { errors[.name] = "Enter your name." }
        if email.trimmed.isEmpty { errors[.email] = "Enter a valid email address." }
        return errors
    }

    private func request() -> EnquiryRequest {
        EnquiryRequest(
            productId: product.id,
            name: name.trimmed,
            email: email.trimmed,
            phone: phone.trimmed.nilIfEmpty,
            message: message.trimmed.nilIfEmpty
        )
    }

    private func show(_ error: APIError) {
        switch error {
        case .cancelled:
            return
        case .validation(let fields, _):
            // Messages for fields the form has go under that field; any others (e.g. productId) go on top.
            var unmatched: [String] = []
            for (key, text) in fields {
                if let field = Field(rawValue: key) {
                    fieldErrors[field] = text
                } else {
                    unmatched.append(text)
                }
            }
            if !unmatched.isEmpty {
                formError = unmatched.sorted().joined(separator: "\n")
            } else if fieldErrors.isEmpty {
                formError = error.userMessage
            }
        case .notFound:
            formError = "This product is no longer available."
        case .upstream:
            formError = "We couldn't send your enquiry. Please try again."
        default:
            formError = error.userMessage
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
