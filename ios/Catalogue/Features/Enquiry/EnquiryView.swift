import SwiftUI

/// The enquiry form, shown as a sheet from the product page. Replaced by a thank-you view on success.
struct EnquiryView: View {
    @State private var model: EnquiryViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: EnquiryViewModel.Field?

    init(api: any APIClient, product: ProductSummary) {
        _model = State(initialValue: EnquiryViewModel(api: api, product: product))
    }

    var body: some View {
        NavigationStack {
            Group {
                if case .submitted = model.phase {
                    thankYou
                } else {
                    form
                }
            }
            .navigationTitle("Enquire")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if case .submitted = model.phase {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                } else {
                    // Disabled while sending: closing mid-send would hide whether the enquiry went out.
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                            .disabled(model.phase == .submitting)
                    }
                }
            }
        }
        .interactiveDismissDisabled(model.phase == .submitting)
    }

    private var form: some View {
        Form {
            Section {
                Text(model.product.title).font(Theme.Fonts.body)
            } header: {
                Text("Product")
            }

            if let formError = model.formError {
                Section {
                    Label(formError, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Theme.Colors.error)
                        .accessibilityIdentifier("formError")
                }
            }

            Section {
                field(.name, "Name") {
                    TextField("Name", text: $model.name)
                        .textContentType(.name)
                        .submitLabel(.next)
                }
                field(.email, "Email") {
                    TextField("Email", text: $model.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                }
                field(.phone, "Phone (optional)") {
                    TextField("Phone (optional)", text: $model.phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                }
                field(.message, "Message (optional)") {
                    TextField("Message (optional)", text: $model.message, axis: .vertical)
                        .lineLimit(3...8)
                }
            } header: {
                Text("Your contact details")
            } footer: {
                Text("Our sales team will reply by email.")
            }

            Section {
                Button {
                    focused = nil
                    Task { await model.submit() }
                } label: {
                    HStack {
                        Spacer()
                        if model.phase == .submitting {
                            ProgressView()
                        } else {
                            Text("Send enquiry").bold()
                        }
                        Spacer()
                    }
                }
                .disabled(model.phase == .submitting)
                .accessibilityIdentifier("sendEnquiry")
            }
        }
        .onSubmit {
            switch focused {
            case .name: focused = .email
            case .email: focused = .phone
            default: focused = nil
            }
        }
    }

    /// A text field with its error message (if any) underneath.
    private func field<Input: View>(_ field: EnquiryViewModel.Field, _ label: String, @ViewBuilder input: () -> Input)
        -> some View
    {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            input()
                .focused($focused, equals: field)
                .accessibilityLabel(label)
            if let error = model.fieldErrors[field] {
                Text(error)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.error)
            }
        }
    }

    private var thankYou: some View {
        VStack(spacing: Theme.Spacing.l) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(Theme.Fonts.successIcon)
                .foregroundStyle(Theme.Colors.success)
                .accessibilityHidden(true)
            Text("Thank you")
                .font(Theme.Fonts.productTitle)
            Text(
                "We've sent your enquiry about \(model.product.title). Our sales team will reply to \(model.email.trimmingCharacters(in: .whitespaces))."
            )
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.textSecondary)
            .multilineTextAlignment(.center)
            if case .submitted(let reference) = model.phase {
                Text("Reference \(reference.prefix(8))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .textSelection(.enabled)
            }
            Spacer()
            Button("Done") { dismiss() }
                .buttonStyle(.borderedProminent)
        }
        .padding(Theme.Spacing.xl)
        .accessibilityIdentifier("thankYou")
    }
}
