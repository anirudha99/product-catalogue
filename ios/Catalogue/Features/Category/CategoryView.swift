import SwiftUI

struct CategoryView: View {
    @State private var model: CategoryViewModel

    init(api: any APIClient, category: CategorySummary) {
        _model = State(initialValue: CategoryViewModel(api: api, category: category))
    }

    var body: some View {
        LoadStateView(
            state: model.state,
            emptyTitle: "No products in this category yet.",
            errorMessage: CategoryViewModel.message(for:),
            retry: model.load
        ) { screen in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    // Hidden when nothing in this category was chosen as top rated.
                    if !screen.topRated.isEmpty {
                        section("Top rated", screen.topRated)
                    }
                    if !screen.more.isEmpty {
                        section(screen.topRated.isEmpty ? "All products" : "More in \(screen.category.name)", screen.more)
                    }
                }
                .padding(Theme.Spacing.l)
            }
            .refreshable { await model.load() }
        }
        .background(Theme.Colors.background)
        .navigationTitle(model.category.name)
        .task { await model.load() }
    }

    private func section(_ title: String, _ products: [ProductSummary]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            Text(title).font(Theme.Fonts.sectionTitle)
            ProductGrid(products: products)
        }
    }
}
