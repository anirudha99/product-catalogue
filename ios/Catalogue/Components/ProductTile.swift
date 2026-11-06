import SwiftUI

/// One product in a grid: image, title, price, rating. Used on Home, Category and Search.
struct ProductTile: View {
    let product: ProductSummary

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            RemoteImage(path: product.imagePath)
                .frame(height: Theme.Size.tileImageHeight)
                .padding(Theme.Spacing.s)
                .background(Theme.Colors.imageBackground, in: RoundedRectangle(cornerRadius: Theme.Radius.tile))

            Text(product.title)
                .font(Theme.Fonts.tileTitle)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(2, reservesSpace: true)

            PriceText(price: product.price)

            RatingLabel(rating: product.rating)
        }
        .padding(Theme.Spacing.s)
        .background(Theme.Colors.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.tile))
        .accessibilityElement(children: .combine)
    }
}

struct RatingLabel: View {
    let rating: Rating

    var body: some View {
        HStack(spacing: Theme.Spacing.xs) {
            Image(systemName: "star.fill").foregroundStyle(Theme.Colors.rating)
            Text(rating.average, format: .number.precision(.fractionLength(1)))
            Text("(\(rating.count))").foregroundStyle(Theme.Colors.textSecondary)
        }
        .font(Theme.Fonts.caption)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Rated \(rating.average.formatted(.number.precision(.fractionLength(1)))) out of 5, \(rating.count) reviews"
        )
    }
}
