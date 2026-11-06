import SwiftUI

/// The single source of colours, fonts, spacing and sizes. Views never use literal styling.
/// When the brand work lands, this file (plus asset-catalogue colours and font files) is what changes.
enum Theme {
    enum Colors {
        static let background = Color(uiColor: .systemBackground)
        static let surface = Color(uiColor: .secondarySystemBackground)
        static let textPrimary = Color.primary
        static let textSecondary = Color.secondary
        static let accent = Color.accentColor
        static let rating = Color.orange
        static let error = Color.red
        static let placeholder = Color(uiColor: .tertiaryLabel)
        /// Product photos have white backgrounds; keep them on white in dark mode too.
        static let imageBackground = Color.white
    }

    /// System text styles, so Dynamic Type works. A brand font would use Font.custom(_:size:relativeTo:).
    enum Fonts {
        static let sectionTitle = Font.title2.weight(.semibold)
        static let tileTitle = Font.subheadline
        static let price = Font.headline
        static let body = Font.body
        static let caption = Font.caption
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
    }

    enum Radius {
        static let tile: CGFloat = 12
    }

    enum Size {
        static let tileImageHeight: CGFloat = 140
        static let gridMinTileWidth: CGFloat = 150
    }
}
