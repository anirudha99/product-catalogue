import SwiftUI

/// Formats Money in the user's locale, e.g. "$55.99".
struct PriceText: View {
    let price: Money

    var body: some View {
        Text(price.decimalAmount, format: .currency(code: price.currency))
            .font(Theme.Fonts.price)
            .foregroundStyle(Theme.Colors.textPrimary)
    }
}
