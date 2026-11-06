import SwiftUI

struct HomeView: View {
    @State private var model: HomeViewModel
    private let api: any APIClient

    init(api: any APIClient) {
        self.api = api
        _model = State(initialValue: HomeViewModel(api: api))
    }

    var body: some View {
        NavigationStack {
            LoadStateView(state: model.state, emptyTitle: "Nothing here yet", retry: model.load) { home in
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        featured(home.featured)
                        categories(home.categories)
                    }
                    .padding(Theme.Spacing.l)
                }
                .refreshable { await model.load() }
            }
            .background(Theme.Colors.background)
            .navigationTitle("Catalogue")
            .routeDestinations(api: api)
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private func featured(_ products: [ProductSummary]) -> some View {
        Text("Top rated").font(Theme.Fonts.sectionTitle)
        if products.isEmpty {
            Text("No featured products yet.")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        } else {
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

    @ViewBuilder
    private func categories(_ categories: [CategorySummary]) -> some View {
        Text("Categories").font(Theme.Fonts.sectionTitle)
        VStack(spacing: 0) {
            ForEach(categories) { category in
                HStack {
                    Text(category.name).font(Theme.Fonts.body)
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(Theme.Colors.textSecondary)
                }
                .padding(.vertical, Theme.Spacing.m)
                if category != categories.last { Divider() }
            }
        }
    }
}
