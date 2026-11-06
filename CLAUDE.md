# CLAUDE.md — rules for AI agents in this repo

Product catalogue proof of concept: SwiftUI iOS app → Node.js/TypeScript API → product source (Fake Store API today).
The design is in `docs/PLAN.md` and the decisions in `DECISIONS.md`. Read them before changing anything. If a change goes against the plan, stop and ask.

## Boundaries (enforced by `scripts/check-boundaries.sh`)

- Only `backend/src/products/` knows Fake Store exists. Everything else uses the `ProductSource` interface and our own `Product` type.
- Only `backend/src/mail/SmtpMailer.ts` knows SMTP or nodemailer. Everything else uses the `Mailer` interface.
- `http/` → services → `domain/`. Services never import Express. Adapters never import services. `domain/` imports nothing outside `domain/`.
- iOS: views talk only to view models. View models talk only to the `APIClient` protocol. `URLSession` appears only in `LiveAPIClient.swift` (plus the `URLCache` setup in `CatalogueApp.swift`). `RemoteImage` is the one view allowed to load a URL.
- All colours, fonts and spacing come from `Theme.swift`. No literal colours or font sizes in views.

## The API contract

- `contract/fixtures/*.json` is the spec. Backend API tests check responses equal these files. iOS tests decode them.
- A contract change updates the fixture in the same change, and the commit message says why.
- Never change a fixture just to make a failing test pass. Fix the code, or ask.

## Working rules

- Every change comes with tests. Run `scripts/check.sh` and show the output before saying "done".
- Don't hand-edit `ios/Catalogue.xcodeproj/project.pbxproj`. Prefer asking the human to make the change in Xcode. If an edit is unavoidable and the human agrees: Xcode must be closed; use a script that fails unless each change matches exactly once; then prove it with `plutil -lint`, `xcodebuild -showBuildSettings` and a full `xcodebuild test`.
- Build settings live in `ios/Config/*.xcconfig`, not in the project file. Don't add settings to the project file that would override them.
- No new npm dependencies without asking. No third-party iOS packages.
- Validate all input on the backend (zod schemas for bodies, config and upstream data; explicit checks for path and query values). Never trust the app or the upstream API.
- No secrets in the repo. Config goes in `.env.example` with safe local defaults.
- Never log customer names, emails, phone numbers or messages.
- No commits, amends or pushes without an explicit "yes" from the human for that action.
- Say what you checked (ran it, read it) and what you are guessing.
- When you get something wrong and it is caught, add one line to the mistakes table in `AI_USAGE.md`.

## Commands

| What | Command |
|---|---|
| Run the backend + Mailpit | `docker compose up` |
| Backend tests (Node ≥ 22.12) | `cd backend && npm test` |
| Backend tests without local Node | `docker compose --profile test run --rm api-test` |
| Everything (formatting, backend, iOS, boundaries) | `scripts/check.sh` |
| Format the code | `cd backend && npm run format` · `xcrun swift-format format -i -r ios/Catalogue ios/CatalogueTests` |
| End-to-end check (stack must be up) | `scripts/smoke.sh` |
| Mailpit inbox | http://localhost:8025 |
