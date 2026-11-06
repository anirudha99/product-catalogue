import Testing
@testable import Catalogue

@MainActor
struct EnquiryViewModelTests {
    private let api = MockAPIClient()
    private let product = ProductSummary(
        id: "3", title: "Mens Cotton Jacket",
        price: Money(amountMinor: 5599, currency: "USD"),
        rating: Rating(average: 4.7, count: 500),
        imagePath: "/v1/products/3/image"
    )

    private func filledModel() -> EnquiryViewModel {
        let model = EnquiryViewModel(api: api, product: product)
        model.name = "Ada Lovelace"
        model.email = "ada@example.com"
        return model
    }

    @Test func requiresNameAndEmailBeforeCallingTheAPI() async {
        let model = EnquiryViewModel(api: api, product: product)
        model.name = "   "

        await model.submit()

        #expect(model.fieldErrors == [.name: "Enter your name.", .email: "Enter a valid email address."])
        #expect(api.enquiries.isEmpty)
        #expect(model.phase == .editing)
    }

    @Test func sendsTrimmedFieldsAndLeavesOutEmptyOptionals() async {
        api.enquiryResult = .success(EnquiryReceipt(reference: "ref-1"))
        let model = filledModel()
        model.name = "  Ada Lovelace  "
        model.phone = "   "
        model.message = "\n"

        await model.submit()

        #expect(api.enquiries == [EnquiryRequest(productId: "3", name: "Ada Lovelace", email: "ada@example.com", phone: nil, message: nil)])
    }

    @Test func successShowsThankYouWithTheReference() async {
        api.enquiryResult = .success(EnquiryReceipt(reference: "00000000-0000-4000-8000-000000000001"))
        let model = filledModel()

        await model.submit()

        #expect(model.phase == .submitted(reference: "00000000-0000-4000-8000-000000000001"))
        #expect(model.formError == nil)
    }

    @Test func serverValidationLandsOnTheRightFields() async {
        api.enquiryResult = .failure(.validation(
            fields: ["email": "Enter a valid email address.", "productId": "Product ID is not valid."],
            message: "Some fields need attention."
        ))
        let model = filledModel()

        await model.submit()

        #expect(model.phase == .editing)
        #expect(model.fieldErrors == [.email: "Enter a valid email address."])
        #expect(model.formError == "Product ID is not valid.")
    }

    @Test(arguments: [
        (APIError.rateLimited(retryAfterSeconds: 60), "Too many enquiries. Please try again later."),
        (.upstream, "We couldn't send your enquiry. Please try again."),
        (.notFound, "This product is no longer available."),
    ])
    func failuresKeepTheFormAndExplain(error: APIError, message: String) async {
        api.enquiryResult = .failure(error)
        let model = filledModel()

        await model.submit()

        #expect(model.phase == .editing)
        #expect(model.formError == message)
        #expect(model.name == "Ada Lovelace") // nothing the user typed is lost
    }

    @Test func aSecondTapWhileSendingIsIgnored() async {
        api.enquiryResult = .success(EnquiryReceipt(reference: "ref-1"))
        let model = filledModel()

        async let first: Void = model.submit()
        async let second: Void = model.submit()
        _ = await (first, second)

        #expect(api.enquiries.count == 1)
    }

    @Test func retryingAfterAFailureClearsTheOldError() async {
        api.enquiryResult = .failure(.upstream)
        let model = filledModel()
        await model.submit()
        #expect(model.formError != nil)

        api.enquiryResult = .success(EnquiryReceipt(reference: "ref-2"))
        await model.submit()

        #expect(model.formError == nil)
        #expect(model.phase == .submitted(reference: "ref-2"))
    }
}
