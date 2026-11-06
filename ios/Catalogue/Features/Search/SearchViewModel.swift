import Foundation
import Observation

@MainActor
@Observable
final class SearchViewModel {
    private(set) var state: LoadState<SearchResults> = .loading
    let term: String
    private let api: any APIClient

    init(api: any APIClient, term: String) {
        self.api = api
        self.term = term.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func load() async {
        // Home never pushes a blank search, but don't send one if it happens.
        guard !term.isEmpty else {
            state = .empty
            return
        }
        if case .loaded = state {} else { state = .loading }
        do throws(APIError) {
            let results = try await api.search(term: term)
            state = results.results.isEmpty ? .empty : .loaded(results)
        } catch .cancelled {
            return
        } catch {
            state = .failed(error)
        }
    }

    var emptyMessage: String { "No products match \u{201C}\(term)\u{201D}." }
}
