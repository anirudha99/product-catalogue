import SwiftUI

struct SearchResultsView: View {
    @State private var model: SearchViewModel

    init(api: any APIClient, term: String) {
        _model = State(initialValue: SearchViewModel(api: api, term: term))
    }

    var body: some View {
        LoadStateView(state: model.state, emptyTitle: model.emptyMessage, retry: model.load) { results in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                    Text(results.results.count == 1 ? "1 product" : "\(results.results.count) products")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    ProductGrid(products: results.results)
                }
                .padding(Theme.Spacing.l)
            }
        }
        .background(Theme.Colors.background)
        .navigationTitle("\u{201C}\(model.term)\u{201D}")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
    }
}
