import SwiftUI

/// Loads a product image from our API (never from the product source's own host).
/// The one view allowed to touch the network; swap AsyncImage for a caching loader here only.
struct RemoteImage: View {
    /// Relative path from the API, e.g. "/v1/products/3/image".
    let path: String
    @Environment(\.apiBaseURL) private var baseURL

    var body: some View {
        AsyncImage(url: URL(string: path, relativeTo: baseURL)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            case .failure:
                Image(systemName: "photo")
                    .font(Theme.Fonts.placeholderIcon)
                    .foregroundStyle(Theme.Colors.placeholder)
                    .accessibilityLabel("Image unavailable")
            default:
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity)
    }
}
