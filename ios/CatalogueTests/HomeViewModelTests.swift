import Testing

@testable import Catalogue

@MainActor
struct HomeViewModelTests {
    private let api = MockAPIClient()

    @Test func startsLoadingThenShowsHome() async throws {
        let home = try Fixtures.decode(HomeScreen.self, from: "home.json")
        api.homeResult = .success(home)
        let model = HomeViewModel(api: api)
        #expect(model.state == .loading)

        await model.load()

        #expect(model.state == .loaded(home))
        #expect(api.homeCalls == 1)
    }

    @Test func showsEmptyWhenThereIsNothingAtAll() async {
        api.homeResult = .success(HomeScreen(featured: [], categories: []))
        let model = HomeViewModel(api: api)

        await model.load()

        #expect(model.state == .empty)
    }

    @Test func keepsCategoriesWhenNoProductIsFeatured() async {
        let categories = [CategorySummary(slug: "electronics", name: "Electronics")]
        api.homeResult = .success(HomeScreen(featured: [], categories: categories))
        let model = HomeViewModel(api: api)

        await model.load()

        #expect(model.state == .loaded(HomeScreen(featured: [], categories: categories)))
    }

    @Test func showsTheErrorAndRecoversOnRetry() async throws {
        api.homeResult = .failure(.transport)
        let model = HomeViewModel(api: api)

        await model.load()
        #expect(model.state == .failed(.transport))

        let home = try Fixtures.decode(HomeScreen.self, from: "home.json")
        api.homeResult = .success(home)
        await model.load()
        #expect(model.state == .loaded(home))
    }

    @Test func ignoresCancellation() async {
        api.homeResult = .failure(.cancelled)
        let model = HomeViewModel(api: api)

        await model.load()

        #expect(model.state == .loading)
    }
}
