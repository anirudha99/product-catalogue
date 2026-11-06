import SwiftUI

struct ProductView: View {
    @State private var model: ProductViewModel
    @State private var enquiringAbout: ProductSummary?
    private let api: any APIClient

    init(api: any APIClient, productID: String) {
        self.api = api
        _model = State(initialValue: ProductViewModel(api: api, productID: productID))
    }

    var body: some View {
        LoadStateView(
            state: model.state,
            emptyTitle: "No details",
            errorMessage: ProductViewModel.message(for:),
            retry: model.load
        ) { product in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                    RemoteImage(path: product.imagePath)
                        .frame(height: Theme.Size.productImageHeight)
                        .padding(Theme.Spacing.l)
                        .background(Theme.Colors.imageBackground, in: RoundedRectangle(cornerRadius: Theme.Radius.tile))

                    Text(product.category.name)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .textCase(.uppercase)

                    Text(product.title)
                        .font(Theme.Fonts.productTitle)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    HStack {
                        PriceText(price: product.price)
                        Spacer()
                        RatingLabel(rating: product.rating)
                    }

                    Text(product.description)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .padding(Theme.Spacing.l)
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    enquiringAbout = product.summary
                } label: {
                    Text("Enquire")
                        .bold()
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(Theme.Spacing.l)
                .background(.bar)
                .accessibilityIdentifier("enquire")
            }
        }
        .background(Theme.Colors.background)
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .sheet(item: $enquiringAbout) { product in
            EnquiryView(api: api, product: product)
        }
    }
}
