import SwiftUI

/// Every screen you can push onto the navigation stack. Value-based, so deep links can map to it later.
enum Route: Hashable {
    case product(id: String)
}

extension View {
    /// Registers the destination for every Route. Called once, on the root NavigationStack.
    func routeDestinations(api: any APIClient) -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .product(let id):
                ProductView(api: api, productID: id)
            }
        }
    }
}
