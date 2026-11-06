import SwiftUI

/// A grid of product tiles; tapping one opens the product page. Used on Home, Category and Search.
struct ProductGrid: View {
    let products: [ProductSummary]

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: Theme.Size.gridMinTileWidth), spacing: Theme.Spacing.m)],
            spacing: Theme.Spacing.m
        ) {
            ForEach(products) { product in
                NavigationLink(value: Route.product(id: product.id)) {
                    ProductTile(product: product)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
