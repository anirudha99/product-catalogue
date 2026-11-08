import Foundation
import Observation

@MainActor
@Observable
final class CategoryViewModel {
    private(set) var state: LoadState<CategoryScreen> = .loading
    let category: CategorySummary
    private let api: any APIClient

    init(api: any APIClient, category: CategorySummary) {
        self.api = api
        self.category = category
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        do throws(APIError) {
            let screen = try await api.category(slug: category.slug)
            state = screen.topRated.isEmpty && screen.more.isEmpty ? .empty : .loaded(screen)
        } catch .cancelled {
            return
        } catch {
            state = .failed(error)
        }
    }

    static func message(for error: APIError) -> String {
        error == .notFound ? "Category not found." : error.userMessage
    }
}
