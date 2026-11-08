import SwiftUI

/// Every screen you can push onto the navigation stack. Value-based, so deep links can map to it later.
enum Route: Hashable {
    /// Carries the name so the title shows while the page loads.
    case category(CategorySummary)
    case search(term: String)
    case product(id: String)
}

extension View {
    /// Registers the destination for every Route. Called once, on the root NavigationStack.
    func routeDestinations(api: any APIClient) -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .category(let category):
                CategoryView(api: api, category: category)
            case .search(let term):
                SearchResultsView(api: api, term: term)
            case .product(let id):
                ProductView(api: api, productID: id)
            }
        }
    }
}
