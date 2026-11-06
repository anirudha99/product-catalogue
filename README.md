# Product Catalogue

A product catalogue, built as the first version of a product that will grow. Customers browse featured products and categories, search, open a product, and send an enquiry that emails the sales inbox.

- **Client:** native iOS app, SwiftUI, no third-party packages.
- **Backend:** Node.js + TypeScript API. It is the only thing that talks to the product source (Fake Store API today) and to the mail server.
- **Email:** Mailpit, a local mail catcher, so no account or paid service is needed.

Decisions: [DECISIONS.md](DECISIONS.md) · Design: [docs/PLAN.md](docs/PLAN.md) · AI usage: [AI_USAGE.md](AI_USAGE.md)

---

## Run it (about 5 minutes)

**You need:**

| Tool | Version | Notes |
|---|---|---|
| Docker with Compose | any recent | Docker Desktop, OrbStack or Colima |
| Xcode | 26.x with an iOS 26 simulator | Tested with Xcode 26.6 and the iOS 26.5 simulator. No Apple account or signing needed. |

**1. Start the backend and the mail inbox**

```bash
docker compose up --build
```

- API: http://localhost:3000 (try http://localhost:3000/v1/home)
- Sales inbox (Mailpit): http://localhost:8025

No `.env` file is needed. Every setting has a safe local default (see [Configuration](#configuration)).

**2. Run the app**

Open `ios/Catalogue.xcodeproj` in Xcode, pick any iPhone simulator, and press **⌘R**.

**3. Try the five acceptance criteria**

| Criterion | In the app |
|---|---|
| Home shows the 5 chosen "top rated" products | The first screen |
| Category page: top rated, then more | Tap a category under **Categories** |
| Search shows only matching products | Type in the search bar, tap the keyboard's **Search** button |
| Product details | Tap any product tile |
| Enquiry → sales inbox gets an email → "Thank you" | Product page → **Enquire** → fill in name and email → **Send enquiry**; the email appears at http://localhost:8025 |

**4. Optional: a one-minute end-to-end check**

```bash
./scripts/smoke.sh   # health → home → image → enquiry → finds the email in Mailpit
```

---

## Tests

```bash
./scripts/check.sh   # formatting, backend tests, iOS tests, layer-boundary check
```

Or one at a time:

| What | Command | Count |
|---|---|---|
| Backend (Node ≥ 22.12) | `cd backend && npm ci && npm test` | 110 tests |
| Backend, no local Node | `docker compose --profile test run --rm api-test` | same 110 |
| iOS | ⌘U in Xcode | 47 tests |
| Layer boundaries | `./scripts/check-boundaries.sh` | 9 rules |
| Formatting | `cd backend && npm run format:check` · `xcrun swift-format lint --strict -r ios/Catalogue ios/CatalogueTests` | Prettier · swift-format |
| End to end (stack running) | `./scripts/smoke.sh` | 5 checks |

**The API contract is tested from both sides.** The JSON files in [`contract/fixtures`](contract/fixtures) are the API spec. Backend tests check that each response **equals** its fixture. iOS tests decode the same files into the app's real types. If the backend and the app drift apart, a test fails. The fixtures were produced from the product snapshot by a separate script, not by the backend code, so the two cross-check each other.

What the tests cover, along the critical path (home → category → search → product → enquiry):

- **Backend:**
  - search matching
  - the Fake Store adapter: mapping, bad upstream data, cache, single-flight, serving stale data when upstream fails
  - top-rated and category rules
  - the enquiry email and its content
  - every endpoint's success and error responses
  - validation, including header injection and unknown fields
  - the rate limit
  - the image proxy's limits
  - that customer details never reach the logs
- **iOS:**
  - each screen's view model: loading, loaded, empty (where a screen can be empty) and error states
  - the real HTTP client against a stubbed network: URLs, query encoding, the enquiry body, Retry-After, error mapping
  - the enquiry form: required fields, trimming, server field errors, 429, email failure, double-tap guard
  - mapping HTTP errors to user messages
  - config from Info.plist

---

## Why these choices

| Choice | Why |
|---|---|
| **Native iOS (SwiftUI)** | Per-build API config, no direct calls to the product source, and loading, empty and error states on every screen. SwiftUI + Observation keeps view models small and testable. No third-party packages: URLSession, Codable and AsyncImage cover what's needed. |
| **Node.js + TypeScript** | Same language for request validation, config checks and upstream checks (zod). Express 5 is widely known and handles async errors natively. |
| **Mailpit** | A real SMTP server with a web inbox and an API: the email path is real (not a console log), and the smoke test can prove the email arrived. Swapping to SES is a config change (SES speaks SMTP). |
| **Screen-shaped API** (`/v1/home`, `/v1/categories/{slug}`) | One request per screen, and business rules ("what is top rated?") live on the server, not in the app. A future web client reuses product, search and enquiry endpoints as they are; its own screens would get thin endpoints over the same services. |

---

## Architecture

```
iOS app ──JSON──▶ API (/v1) ──▶ ProductSource ──▶ Fake Store API (or the committed snapshot)
                       │
                       └──────▶ Mailer ──SMTP──▶ Mailpit (local) / SES (later)
```

Each arrow is the only way across that line, and `scripts/check-boundaries.sh` (run by `scripts/check.sh`) fails if code crosses one:

- The app only knows our API. It never sees the product source's URLs; even images come through `GET /v1/products/{id}/image`.
- In the backend, only `products/` knows Fake Store exists, and only `mail/SmtpMailer.ts` knows SMTP. Services depend on the `ProductSource` and `Mailer` interfaces.
- In the app, views → view models → the `APIClient` protocol. Only `LiveAPIClient` uses URLSession. All colours, fonts and spacing come from `Theme.swift`.

How each expected change lands: see [DECISIONS.md → How this grows](DECISIONS.md#how-this-grows).

### API

| Endpoint | Returns |
|---|---|
| `GET /v1/home` | The chosen top-rated products and the category list |
| `GET /v1/categories/{slug}` | `topRated` (chosen products in this category) and `more` |
| `GET /v1/search?q=` | Products whose text matches; an empty list is still 200 |
| `GET /v1/products/{id}` | Product details |
| `GET /v1/products/{id}/image` | The product image, proxied |
| `POST /v1/enquiries` | `202 { reference }` once the email is sent |
| `GET /health` | Liveness |

Every error has one shape: `{ "error": { "code", "message", "fields"?, "requestId" } }`. Examples are in [`contract/fixtures`](contract/fixtures).

### Security basics

- **Every input is checked on the server.**
  - Request bodies and config use zod schemas. Path parameters and the search term use explicit checks.
  - Unknown fields are rejected, lengths are limited, and bodies are capped at 10 KB.
  - The name may contain no control characters, which blocks email header injection.
- **The email's sales address and product details come from the server,** never from the request.
- **Enquiries are rate-limited per client IP.**
- **Customer details are never logged.** Logs carry IDs only.
- **The image proxy only fetches the URL stored on the product.** It accepts raster images only, up to 5 MB.
- **No secrets** in the repo or the app.
- **Docker ports are bound to this machine only,** and the API container runs as a non-root user.

---

## Configuration

All backend settings are environment variables with safe defaults; [`.env.example`](.env.example) lists them. To change one, `cp .env.example .env`, edit, and re-run `docker compose up`.

| Setting | Default | Why you might change it |
|---|---|---|
| `TOP_RATED_PRODUCT_IDS` | `3,5,11,12,18` | The business's chosen products, in display order |
| `PRODUCT_SOURCE` | `fakestore` | `snapshot` runs on the committed copy of the data, with no internet needed for product data |
| `SALES_INBOX` | `sales@example.test` | Where enquiries go |
| `SMTP_*`, `MAIL_FROM` | Mailpit | Point at a real SMTP provider |
| `ENQUIRY_RATE_LIMIT_MAX` / `_WINDOW_MS` | 5 per 15 minutes | Enquiries per client IP |

The app's API address is in `ios/Config/Debug.xcconfig` (`API_HOST = localhost:3000`). The app holds no secrets.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App says "Can't reach the server" | Is `docker compose up` running? Does http://localhost:3000/health answer? |
| `certificate signed by unknown authority` during the build, or the API returns 502 and its log says `Fake Store request failed: … (SELF_SIGNED_CERT_IN_CHAIN)` or similar | You're behind a network that inspects HTTPS (a corporate proxy). Copy [`docker-compose.override.example.yml`](docker-compose.override.example.yml) to `docker-compose.override.yml` and add `EXTRA_CA_BUNDLE=/path/to/proxy-cert.pem` to `.env`; this hands your proxy's root certificate to the containers. Or, for product data only, run `PRODUCT_SOURCE=snapshot docker compose up` (images still come from the internet). |
| "Too many enquiries" | The limit is 5 per 15 minutes and is kept in memory: `docker compose restart api` resets it. |
| Port 3000 or 8025 already in use | `PORT=3001 docker compose up` and set `API_HOST = localhost:3001` in `ios/Config/Debug.xcconfig`. |
| First images are slow | Each image is fetched from the product source on first request, then cached by the app for a day. See DECISIONS.md. |

---

## Repository layout

```
backend/     Node + TypeScript API: src/, test/, data/fakestore-snapshot.json, Dockerfile
ios/         Xcode project: Catalogue/ (app), CatalogueTests/, Config/ (xcconfig + Info.plist)
contract/    The API contract (fixtures/) and the script that generates it
scripts/     check.sh, check-boundaries.sh, smoke.sh
docs/        PLAN.md, the design written before implementation
CLAUDE.md    Instructions for the AI coding agent
```

---

## Time spent

About **3 hours 15 minutes**, a little over the 2–3 hour time-box.

| Part | Time | What |
|---|---|---|
| Planning | ~1 h | The plan, an independent review of it, rework |
| Building | ~1 h 20 min | Environment and project setup, then the five features with their tests |
| Testing | ~15 min, within building | Each feature run on the simulator against the real backend |
| Reviewing | ~55 min | Docs, a clean-copy run-through, an independent review of the repo and the fixes it led to, formatters |
