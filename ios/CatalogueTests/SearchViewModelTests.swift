import Testing

@testable import Catalogue

@MainActor
struct SearchViewModelTests {
    private let api = MockAPIClient()

    @Test func blankTermMakesNoCall() async {
        let model = SearchViewModel(api: api, term: "   ")

        await model.load()

        #expect(api.searchRequests.isEmpty)
        #expect(model.state == .empty)
    }

    @Test func sendsTheTrimmedTerm() async throws {
        api.searchResult = .success(try Fixtures.decode(SearchResults.self, from: "search-jacket.json"))
        let model = SearchViewModel(api: api, term: "  jacket ")

        await model.load()

        #expect(api.searchRequests == ["jacket"])
        guard case .loaded(let results) = model.state else {
            Issue.record("expected loaded, got \(model.state)")
            return
        }
        #expect(results.results.map(\.id) == ["3", "17", "16", "15"])
    }

    @Test func noResultsShowsEmptyWithTheTerm() async throws {
        api.searchResult = .success(try Fixtures.decode(SearchResults.self, from: "search-no-results.json"))
        let model = SearchViewModel(api: api, term: "submarine")

        await model.load()

        #expect(model.state == .empty)
        #expect(model.emptyMessage == "No products match \u{201C}submarine\u{201D}.")
    }

    @Test func errorsAreShown() async {
        api.searchResult = .failure(.upstream)
        let model = SearchViewModel(api: api, term: "jacket")

        await model.load()

        #expect(model.state == .failed(.upstream))
    }
}
