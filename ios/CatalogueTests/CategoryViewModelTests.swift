import Testing
@testable import Catalogue

@MainActor
struct CategoryViewModelTests {
    private let api = MockAPIClient()
    private let electronics = CategorySummary(slug: "electronics", name: "Electronics")

    @Test func loadsBothSections() async throws {
        let screen = try Fixtures.decode(CategoryScreen.self, from: "category-electronics.json")
        api.categoryResult = .success(screen)
        let model = CategoryViewModel(api: api, category: electronics)

        await model.load()

        #expect(model.state == .loaded(screen))
        #expect(api.categoryRequests == ["electronics"])
    }

    @Test func noChosenProductsStillShowsTheRest() async throws {
        let screen = try Fixtures.decode(CategoryScreen.self, from: "category-no-picks.json")
        api.categoryResult = .success(screen)
        let model = CategoryViewModel(api: api, category: electronics)

        await model.load()

        guard case .loaded(let loaded) = model.state else {
            Issue.record("expected loaded, got \(model.state)")
            return
        }
        #expect(loaded.topRated.isEmpty)
        #expect(loaded.more.count == 6)
    }

    @Test func emptyCategoryShowsEmptyState() async {
        api.categoryResult = .success(CategoryScreen(category: electronics, topRated: [], more: []))
        let model = CategoryViewModel(api: api, category: electronics)

        await model.load()

        #expect(model.state == .empty)
    }

    @Test func unknownCategoryHasItsOwnMessage() async {
        api.categoryResult = .failure(.notFound)
        let model = CategoryViewModel(api: api, category: electronics)

        await model.load()

        #expect(model.state == .failed(.notFound))
        #expect(CategoryViewModel.message(for: .notFound) == "Category not found.")
    }
}
