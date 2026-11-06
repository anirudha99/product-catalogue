import Foundation
import Observation

@MainActor
@Observable
final class HomeViewModel {
    private(set) var state: LoadState<HomeScreen> = .loading
    private let api: any APIClient

    init(api: any APIClient) {
        self.api = api
    }

    /// Loads (or reloads) the home screen. Keeps showing old content while refreshing.
    func load() async {
        if case .loaded = state {} else { state = .loading }
        do throws(APIError) {
            let home = try await api.home()
            state = home.featured.isEmpty && home.categories.isEmpty ? .empty : .loaded(home)
        } catch .cancelled {
            return
        } catch {
            state = .failed(error)
        }
    }
}
