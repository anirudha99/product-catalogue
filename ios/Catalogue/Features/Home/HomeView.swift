import SwiftUI

struct HomeView: View {
    @State private var model: HomeViewModel
    @State private var path: [Route] = []
    @State private var query = ""
    private let api: any APIClient

    init(api: any APIClient) {
        self.api = api
        _model = State(initialValue: HomeViewModel(api: api))
    }

    var body: some View {
        NavigationStack(path: $path) {
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
            // Search runs only when the user taps the keyboard's Search button (no search-as-you-type).
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search products")
            .onSubmit(of: .search) {
                let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !term.isEmpty else { return }
                path.append(.search(term: term))
            }
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
            ProductGrid(products: products)
        }
    }

    @ViewBuilder
    private func categories(_ categories: [CategorySummary]) -> some View {
        Text("Categories").font(Theme.Fonts.sectionTitle)
        VStack(spacing: 0) {
            ForEach(categories) { category in
                NavigationLink(value: Route.category(category)) {
                    HStack {
                        Text(category.name).font(Theme.Fonts.body)
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.Colors.textSecondary)
                    }
                    .padding(.vertical, Theme.Spacing.m)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if category != categories.last { Divider() }
            }
        }
    }
}
