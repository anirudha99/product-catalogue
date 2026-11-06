import SwiftUI

/// The state of every screen that loads data. Every screen shows all four.
enum LoadState<Value> {
    case loading
    case loaded(Value)
    case empty
    case failed(APIError)
}

extension LoadState: Equatable where Value: Equatable {}

/// Draws loading, empty and error-with-retry the same way on every screen; `content` draws `.loaded`.
struct LoadStateView<Value, Content: View>: View {
    let state: LoadState<Value>
    let emptyTitle: String
    var errorMessage: (APIError) -> String = { $0.userMessage }
    let retry: @MainActor () async -> Void
    @ViewBuilder let content: (Value) -> Content

    var body: some View {
        switch state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty:
            ContentUnavailableView(emptyTitle, systemImage: "tray")
        case .failed(let error):
            ContentUnavailableView {
                Label("Something went wrong", systemImage: "exclamationmark.triangle")
            } description: {
                Text(errorMessage(error))
            } actions: {
                Button("Retry") { Task { await retry() } }
                    .buttonStyle(.borderedProminent)
            }
        case .loaded(let value):
            content(value)
        }
    }
}
