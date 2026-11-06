# Plan

Written before implementation; kept as the design record. Changes made since are listed in [DECISIONS.md](../DECISIONS.md#changes-from-the-original-plan).

Stack: SwiftUI iOS app · Node.js + TypeScript API · Fake Store API as the first product source · Mailpit for local email · `docker compose up` runs the backend.

What the product source does (checked before planning):
- 20 products in 4 categories: `electronics` (6), `women's clothing` (6), `men's clothing` (4), `jewelery` (4, misspelt upstream).
- No search endpoint, so the backend searches.
- `GET /products/{unknown id}` returns **200 with an empty body**, not 404, so the backend never calls `/products/{id}`.
- Images are on the source's own host (`200 image/png`, about 270 KB). A bad image path returns `404 text/html`.

---

## Gaps in the acceptance criteria

### Decided

| # | Gap | Decision | Alternative not taken |
|---|---|---|---|
| G1 | What is "top rated"? | **One meaning everywhere: the set of products the entrepreneur chose.** Config `TOP_RATED_PRODUCT_IDS=3,5,11,12,18` (all 4.6★ or more, and every category has at least one). Home shows all of them, in config order. | Compute "top rated" from star ratings. Rejected: the AC says "I have **chosen**", and mixing the two would put a 2.2★ product under "top rated". |
| G4 | Top rated on a category page | The chosen products that are in this category, in config order. If none, the section is hidden and only "more" shows. | Fill up with highest-rated products. Rejected: brings back two meanings. |
| G5 | "Additional products" | Every other product in the category, no repeats. | Repeat the top-rated ones too. |
| G12 | Images on fakestoreapi.com | Our API proxies them (`GET /v1/products/{id}/image`). The backend uses the stored URL only. | Send the Fake Store URL to the app. |
| G15 | Products per enquiry | One, started from the product page. | Enquiry basket. |
| G17/18 | Store enquiries? Email fails? | Email only. On failure the API returns an error, the app keeps the form, no "Thank you". | Save first, then email with retries. |

### Search

| # | Gap | Decision | Alternative |
|---|---|---|---|
| G8 | Which text is matched | Title, description, category display name **and** raw upstream category (so "jewellery" and "jewelery" both work). | Title only. |
| G9 | How it matches | The whole trimmed phrase, case-insensitive, **at the start of a word**. Checked: plain substring "men" matched 13 of 20 (inside "women", "garments"…); word-start matches exactly the 4 men's items. | Every word must appear (AND). |
| G10 | "Search button" | Search field on Home; runs on the keyboard Search key; results on their own screen. No live search. | Search as you type. |
| G11 | Scope and limits | Whole catalogue. 1–100 chars after trimming. | Within a category. |

### Defaults, one line each

- **G2 Home:** chosen products, category list, search field.
- **G6 Category links:** a list on Home.
- **G7 Category names:** slug + display name owned by the adapter (see Implementation spec).
- **G13 Product page:** image, title, price, category, rating, description, Enquire button.
- **G14 Currency:** USD, sent as cents + `"USD"`.
- **G16 Contact details:** name and email required; phone and message optional.
- **G19 Customer copy email:** no. Not in the AC, and it would let strangers make us email any address.
- **G20 "Thank you":** replaces the form in the same sheet, with a Done button.
- **G21 Sales inbox:** `SALES_INBOX` env var, never from the request.
- **G22 Accounts:** none.
- **G23 Paging:** none (20 products).
- **G24 Fake Store down:** cache, serve stale, 502 on a cold failure. Plus `PRODUCT_SOURCE=snapshot` to run on the committed snapshot.
- **G25 Devices:** iPhone, portrait. Light and dark mode through system colours. System text styles. Landscape and large Dynamic Type sizes are not tested, so not claimed.
- **G26 Language:** English only.

These move into DECISIONS.md at the end.

---

## Architecture

```
iOS app ──JSON──▶ Our API (/v1) ──▶ ProductSource ──▶ Fake Store API  (or the committed snapshot)
                         │
                         └────────▶ Mailer ──SMTP──▶ Mailpit (local) / SES (later)
```

Rule: each arrow is the only way across that line. `scripts/check-boundaries.sh` enforces it.

### Backend

| Layer | Job | Must not import |
|---|---|---|
| `http/` | Routes, zod validation, domain → response mapping, error handler | `products/*` adapters, `mail/*` adapters |
| `catalogue/`, `enquiries/` | Business rules: top rated, category split, enquiry email | Express, adapters |
| `domain/` | Types, errors, `matchesTerm` (pure) | Anything except other `domain/` files |
| `products/`, `mail/` | Adapters, one outside system each | Express, services |

```ts
type Product = {
  id: string;                                  // string so a later source can use SKUs/UUIDs
  title: string;
  description: string;
  category: { slug: string; name: string; sourceName: string };
  price: { amountMinor: number; currency: string };
  imageUrl: string;                            // internal; the app only gets our proxy path
  rating: { average: number; count: number };
};

interface ProductSource {
  listCategories(): Promise<Category[]>;
  listProducts(query?: { categorySlug?: string; text?: string }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
}

interface Mailer {
  send(message: {
    to: string;
    replyTo?: { name: string; address: string };   // address object, never a joined string
    subject: string;
    text: string;
  }): Promise<void>;
}
```

`query` stays on the interface so a future source (Postgres, a search service) can search itself. Fake Store cannot, so its adapter calls the pure `domain/search.ts → matchesTerm(product, term)`. Any later source without native search reuses that same function.

| Interface | Implementation | Notes |
|---|---|---|
| `ProductSource` | `FakeStoreProductSource` | Takes `{ loadRaw: () => Promise<unknown>, ttlMs, now }`. Validates with zod, maps, caches. |
| — loaders | `fetchFromFakeStore(baseUrl, timeoutMs)` / `readSnapshot(path)` | Picked by `PRODUCT_SOURCE`. Both go through the same mapping. |
| `Mailer` | `SmtpMailer` (nodemailer) | Mailpit locally; SES SMTP later. |
| `Mailer` | `FakeMailer` (tests only) | Records messages; can be told to fail. |

API tests use the real `FakeStoreProductSource` with a loader that returns the snapshot, so they test the real mapping, cache and search, not a test double.

Wiring: `app.ts` exports `buildApp({ productSource, mailer, config, newId, logger })` and does no I/O. `server.ts` reads env, builds the real parts, calls `buildApp`. Tests pass fakes and a fixed `newId`.

### iOS

```
View ──▶ ViewModel (@MainActor @Observable) ──▶ APIClient protocol ──▶ LiveAPIClient (URLSession)
  └──▶ Theme
```

- Views call view models only. View models get an `APIClient` in `init`. `CatalogueApp` builds `LiveAPIClient` and passes it down.
- One `NavigationStack`, `Route` = `.category(slug)`, `.search(term)`, `.product(id)`. Enquiry is a sheet.
- Screen state: `LoadState<Value>` = `loading | loaded(Value) | empty | failed(APIError)`. (No `idle` — every screen loads on appear.)
- Enquiry state: `editing | submitting | submitted(reference) | failed(APIError)`.
- `RemoteImage` wraps `AsyncImage`, loads from our API only, shows a `photo` SF Symbol on failure. It is the one deliberate place a view touches the network.
- `URLCache.shared = URLCache(memoryCapacity: 20_000_000, diskCapacity: 100_000_000)` at app start, so 270 KB images are cached.
- No third-party packages.

```swift
protocol APIClient: Sendable {
    func home() async throws -> HomeScreen
    func category(slug: String) async throws -> CategoryScreen
    func search(term: String) async throws -> SearchResults
    func product(id: String) async throws -> ProductDetail
    func submitEnquiry(_ enquiry: EnquiryRequest) async throws -> EnquiryReceipt
}
```

### Why the API is shaped by screen

`/v1/home` and `/v1/categories/{slug}` return what one screen needs in one call (a backend-for-frontend). This keeps the app thin, keeps business rules (what "top rated" means) on the server, and means one round trip per screen. Cost: a web client with different screens needs new endpoints. Those are thin, because the rules live in the services, not the routes. `/v1/products/{id}`, `/v1/search` and `/v1/enquiries` are reusable as they are.

### How each swap works

| Change | Touch | Unchanged |
|---|---|---|
| New product source | One class implementing `ProductSource`; select it in `server.ts` | Services, routes, contract, app |
| New email provider | SES: env only (SMTP endpoint). HTTP-API provider: one `Mailer` class | Enquiry service, routes, app |
| New look and feel | `Theme.swift`, asset-catalogue colours, font files | View models, networking, tests |
| Top rated chosen in a CMS | The input to `CatalogueService` | Routes, contract, app |
| Web client later | Add CORS; add thin screen endpoints for its own screens over the same services | Services, adapters, product/search/enquiry endpoints |
| Other API host | `API_HOST` in an `.xcconfig` | Code |

---

## API contract (v1)

The spec is the files in `contract/fixtures/`. They are produced from the snapshot by `contract/generate_fixtures.py`, separately from the backend code. Backend API tests check each response **equals** its fixture. iOS tests decode the same files into the app's real types.

```jsonc
// ProductSummary
{ "id": "3", "title": "Mens Cotton Jacket",
  "price": { "amountMinor": 5599, "currency": "USD" },
  "rating": { "average": 4.7, "count": 500 },
  "imagePath": "/v1/products/3/image" }       // relative to the API base URL

// Category
{ "slug": "mens-clothing", "name": "Men's Clothing" }
```

| Endpoint | Success | Fixture |
|---|---|---|
| `GET /health` | `200 { "status": "ok" }`. Never calls upstream. | — |
| `GET /v1/home` | `200 { featured: ProductSummary[], categories: Category[] }` | `home.json` |
| `GET /v1/categories/{slug}` | `200 { category, topRated: ProductSummary[], more: ProductSummary[] }` | `category-electronics.json`, `category-no-picks.json` |
| `GET /v1/search?q={term}` | `200 { term, results: ProductSummary[] }`. An empty list is still 200. | `search-jacket.json`, `search-no-results.json` |
| `GET /v1/products/{id}` | `200` ProductSummary + `description`, `category` | `product-3.json` |
| `GET /v1/products/{id}/image` | `200` image bytes, `Content-Type` passed through (`image/*` only), `Cache-Control: public, max-age=86400` | — |
| `POST /v1/enquiries` | `202 { "reference": "<uuid>" }` | `enquiry-accepted.json` |

Enquiry body: `{ "productId": "3", "name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0000", "message": "Do you ship to India?" }`

Why 202: if a queue is added later, 202 stays correct and the app does not change.

Every response has an `X-Request-Id` header. Errors, for every non-2xx:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some fields need attention.",
             "fields": { "email": "Enter a valid email address." },
             "requestId": "00000000-0000-4000-8000-000000000001" } }
```

| HTTP | code | When | Fixture |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Bad path, query or body; `fields` keyed by JSON name (`q`, `email`, …) | `error-validation.json` |
| 404 | `NOT_FOUND` | Unknown slug or product (also in an enquiry) | `error-not-found.json` |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 10 KB | — |
| 429 | `RATE_LIMITED` | Enquiry limit hit; `Retry-After` header | `error-rate-limited.json` |
| 502 | `UPSTREAM_UNAVAILABLE` | Product source or image fetch failed | `error-upstream.json` |
| 502 | `EMAIL_FAILED` | Mailer failed | — |
| 500 | `INTERNAL` | Anything else; generic message, no stack | — |

Fixtures are deterministic: tests build the app with `TOP_RATED_PRODUCT_IDS=3,5,11,12,18`, the committed snapshot, and `newId = () => "00000000-0000-4000-8000-000000000001"`. `category-no-picks.json` comes from a test config with no electronics IDs.

---

## Folder structure

```
product-catalogue/
├── README.md  DECISIONS.md  AI_USAGE.md  CLAUDE.md  docs/PLAN.md
├── docker-compose.yml            # api + mailpit; api-test under the "test" profile
├── .env.example  .gitignore
├── contract/fixtures/*.json      # the API spec; shared by backend and iOS tests
├── scripts/
│   ├── check.sh                  # backend tests → iOS tests → boundary check
│   ├── check-boundaries.sh       # layer rules, checked with git grep
│   └── smoke.sh                  # needs the stack up: home → enquiry → Mailpit
├── backend/
│   ├── Dockerfile                # stages: deps → build → test → runtime (non-root)
│   ├── package.json              # "engines": { "node": ">=22.12" }
│   ├── tsconfig.json  .nvmrc     # .nvmrc = 24
│   ├── data/fakestore-snapshot.json   # used by PRODUCT_SOURCE=snapshot and by tests
│   ├── src/
│   │   ├── server.ts  app.ts  config.ts  log.ts
│   │   ├── domain/        product.ts  errors.ts  search.ts
│   │   ├── products/      ProductSource.ts  FakeStoreProductSource.ts  loaders.ts
│   │   ├── mail/          Mailer.ts  SmtpMailer.ts
│   │   ├── catalogue/     CatalogueService.ts
│   │   ├── enquiries/     EnquiryService.ts  enquiryEmail.ts
│   │   └── http/          routes.ts  schemas.ts  responses.ts  rateLimit.ts  errorHandler.ts  imageProxy.ts
│   └── test/
│       ├── fakes/FakeMailer.ts
│       ├── unit/          search  fakeStoreSource  catalogueService  enquiryService  config
│       └── api/           one file per endpoint
└── ios/
    ├── Catalogue.xcodeproj       # created in the Xcode GUI; folder-synced groups
    ├── Config/                   Base.xcconfig  Debug.xcconfig  Release.xcconfig
    ├── Catalogue/
    │   ├── App/                  CatalogueApp.swift  AppConfig.swift  Route.swift
    │   ├── Networking/           APIClient.swift  LiveAPIClient.swift  APIError.swift  Models.swift
    │   ├── Features/             Home/ Category/ Search/ Product/ Enquiry/  (View + ViewModel each)
    │   ├── Components/           ProductTile  RemoteImage  PriceText  LoadStateView
    │   ├── Theme/Theme.swift     # the only place for colours, fonts, spacing
    │   └── Resources/Assets.xcassets
    ├── Config/Info.plist         # only APIBaseURL + ATS; kept outside the synced app folder, else
    │                             # Xcode copies it as a resource and the build fails ("multiple commands produce Info.plist")
    └── CatalogueTests/           # Swift Testing
        ├── Support/  MockAPIClient.swift  Fixtures.swift (#filePath → ../../contract/fixtures)
        └── *Tests.swift
```

---

## iOS details

| Topic | Plan |
|---|---|
| Xcode | Tested with Xcode 26.6 and the iOS 26.5 simulator. The README claims only this. |
| `Base.xcconfig` | `IPHONEOS_DEPLOYMENT_TARGET = 17.0`, `SWIFT_VERSION = 6`, `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated`, `SWIFT_APPROACHABLE_CONCURRENCY = YES`. Xcode 26 new projects default to MainActor isolation and a 26.x target, so these are set on purpose. View models are marked `@MainActor` by hand. |
| Minimum iOS | 17 (for `@Observable`). |
| Signing | Simulator only; no Apple account needed. |
| Base URL | `Debug.xcconfig`: `API_SCHEME = http`, `API_HOST = localhost:3000`. `Info.plist`: `APIBaseURL = $(API_SCHEME)://$(API_HOST)`. No `//` in the xcconfig, so no comment trick needed. `AppConfig` reads it at launch and stops with a clear message if it is missing or bad. |
| ATS | Only `NSAllowsLocalNetworking = YES`. Checked (Apple docs): it covers unqualified names like `localhost`, `.local` names and IP addresses. No arbitrary loads. |
| Fixtures in tests | `Fixtures.swift` finds `contract/fixtures` from `#filePath`. Works because simulator tests can read the Mac's files. No bundling. |

### Screen states and copy

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Home | Spinner | "No featured products yet." Categories still show. | Copy from the table below + Retry |
| Category | Spinner | Top-rated section hidden if none. "No products in this category yet." if both empty. | 404 → "Category not found." Else copy + Retry |
| Search | Spinner | "No products match "{term}"." | Copy + Retry |
| Product | Spinner | — | 404 → "This product is no longer available." Else copy + Retry |
| Enquiry | Button disabled + spinner | — | See below. Form is always kept. |

| `APIError` | When | User sees |
|---|---|---|
| `.transport` | No connection | "Can't reach the server. Is the API running on localhost:3000?" (Debug builds only; Release says "Check your connection.") |
| `.validation([String: String])` | 400 | Message under each matching field; any unmatched ones at the top |
| `.notFound` | 404 | Screen-specific copy above |
| `.rateLimited(retryAfter:)` | 429 | "Too many enquiries. Please try again later." |
| `.upstream` | 502 | "We couldn't load products right now. Please try again." (Enquiry: "We couldn't send your enquiry. Please try again.") |
| `.server` | 500 / other | "Something went wrong. Please try again." |
| `.decoding` | Bad JSON | Same as `.server`; logged |

`APIError.from(status:body:)` is a pure function, so it is tested without stubbing `URLSession`.

Before sending, the app checks only that name and email are filled in, trims every field, and leaves out empty optional fields. The backend does the real validation.

---

## Test plan (home → product → enquiry → category → search)

### Backend — Vitest + Supertest

Run: `cd backend && npm test` (Node ≥ 22.12), or with no local Node: `docker compose --profile test run --rm api-test`.

| File | Cases |
|---|---|
| `unit/search` | Word-start match ("men" → 1,2,3,4); case-insensitive; matches title, description, display name and raw category; phrase with apostrophe ("men's"); term with regex characters (`"$("`) is safe; no match → none |
| `unit/fakeStoreSource` | Maps raw → `Product` (slug, display name, cents via `Math.round(price*100)`); bad shape → `UpstreamError`; loader throws with warm cache → stale data served; cold → `UpstreamError`; two calls at once → one load (single-flight); TTL expiry reloads |
| `unit/catalogueService` | Home: chosen IDs in config order, unknown ID skipped. Category: topRated = chosen in category in config order; more = rest, sorted; no picks → `topRated: []`; unknown slug → `NotFoundError` |
| `unit/enquiryService` | One email to `SALES_INBOX`; product title from the source; reply-to is the customer as an address object; subject format; reference included; unknown product → `NotFoundError`, no email; mailer throws → `EmailError` |
| `unit/config` | Missing or bad env → startup fails with a clear message; defaults applied |
| `api/*` | Each 200 body **equals** its fixture. Error bodies equal error fixtures. Search: missing/blank/101-char `q` → 400 `fields.q`. Enquiry: 202 + one email; 400 for missing name, bad email, long message, extra field; 404 unknown product; 413 big body; 429 after the limit; 502 when mailer fails. Image: 200 with `image/png`; upstream 404 or `text/html` → 502 + `Cache-Control: no-store`; unknown product → 404. Source failure → 502; no stack in any error. |

### iOS — Swift Testing

Run: ⌘U in Xcode, or `scripts/check.sh`.

| File | Cases |
|---|---|
| `ContractDecodingTests` | Every `contract/fixtures` file decodes into the app's types |
| `APIErrorTests` | `APIError.from(status:body:)` for 400 (fields), 404, 429 (`Retry-After`), 502, 500, bad body |
| `HomeViewModelTests` | loading → loaded; empty; failed; retry |
| `ProductViewModelTests` | loaded; 404 → not found |
| `EnquiryViewModelTests` | required-field check; trims, drops empty optionals; success → `submitted`; 400 → field messages; 429 copy; second tap while submitting ignored |
| `CategoryViewModelTests` | both sections; no picks → section hidden |
| `SearchViewModelTests` | blank term makes no call; no results → empty |

### End to end

`scripts/smoke.sh` (stack must be up): GET `/health`, GET `/v1/home`, POST an enquiry, then read Mailpit `GET http://localhost:8025/api/v1/messages` and check the reference is there. Takes under a minute.

---

## Security basics

| Area | Plan |
|---|---|
| Validation | zod on every param, query and body. Slug `^[a-z0-9-]{1,50}$`. ID `^[A-Za-z0-9_-]{1,64}$`. Search 1–100 after trim. Enquiry: every field trimmed; empty optional = absent; name 1–100, no control characters; email ≤254, valid; phone `^[0-9 +()-]{0,30}$`; message ≤1000; `.strict()` rejects unknown fields; body ≤10 KB. |
| Do not trust the app | Product title in the email comes from our source. Sales address comes from env. |
| Email | Plain text only. Control characters rejected (no header injection). Reply-to built as `{ name, address }`, never a joined string. Subject: `Enquiry <first 8 of reference>: <product title>`. |
| Search | Term is regex-escaped before matching. |
| Rate limit | `express-rate-limit` on `POST /v1/enquiries`: `ENQUIRY_RATE_LIMIT_MAX` per IP per `ENQUIRY_RATE_LIMIT_WINDOW_MS`, in memory. Known limit: behind Docker port forwarding every client may appear as one IP (guessing); behind a load balancer set `trust proxy`; more than one instance needs a shared store. |
| Do not trust upstream | Upstream JSON checked with zod. Timeout on every call. Image proxy: stored URL only, status 200 and `image/*` only, 5 MB cap (checks `content-length` and counts bytes). |
| Errors and logs | No stack traces to clients. JSON log lines carry `requestId` and enquiry `reference`, never the customer's name, email, phone or message. |
| Secrets | `.env` ignored. `.env.example` committed. Compose uses `${VAR:-default}`, so it runs with no `.env`. Mailpit needs no credentials. |
| Container | Non-root `node` user. `x-powered-by` off. |
| App | No secrets. Base URL is not secret. Future API keys stay on the backend. |
| CORS | Off. Not needed for a native app. |

---

## Cuts

| Cut | Why it is safe |
|---|---|
| Enquiry storage, queue, retries | Email meets the AC; 202 leaves room for a queue. |
| Admin for top-rated products | Config meets "I have chosen"; admin needs auth. |
| OpenAPI spec | The shared fixtures pin the contract. Next-day item. |
| A separate in-memory product source for tests | Tests use the real adapter with the snapshot. |
| UI test, `URLProtocol` client tests | Pure `APIError.from` + view-model + contract tests cover the logic. |
| Customer confirmation email | Not in the AC; abuse risk. |
| Paging, iPad, landscape, localisation | Not needed to firm up the vision. |
| CI, infrastructure as code | `scripts/check.sh` runs everything. The image fits ECS Fargate / App Runner; SES has SMTP. |
| Real brand styling | Creative work is in progress; `Theme.swift` holds the tokens. |

## Build order

Riskiest integration first, then the most important flow (enquiry), then the screens that are "just more lists".

| Step | Goal | Done when |
|---|---|---|
| 0. Thin slice | Prove every joint | `docker compose up` starts api + Mailpit; `/v1/home` equals `home.json` (snapshot) and works against live Fake Store; iOS Home shows the chosen products with one proxied image |
| 1. Product | Product page | API + view-model tests pass; tap a tile → details |
| 2. Enquiry | The full enquiry AC | Backend + view-model tests pass; `smoke.sh` passes; email visible in Mailpit at `localhost:8025`; Thank you on the simulator |
| 3. Category + Search | Remaining AC | Tests pass; reuse `ProductTile` and `LoadStateView` |
| 4. Finish | Docs and proof | `scripts/check.sh` green; fresh clone → README → working app in under 10 min |

---

## Implementation spec

### Environment variables (validated with zod at startup; fail fast)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `PRODUCT_SOURCE` | `fakestore` | `fakestore` or `snapshot` |
| `FAKESTORE_BASE_URL` | `https://fakestoreapi.com` | |
| `SNAPSHOT_PATH` | `data/fakestore-snapshot.json` | |
| `TOP_RATED_PRODUCT_IDS` | `3,5,11,12,18` | Comma-separated, at least one |
| `CACHE_TTL_SECONDS` | `300` | |
| `UPSTREAM_TIMEOUT_MS` | `5000` | |
| `SMTP_HOST` | `mailpit` | `localhost` when running outside compose |
| `SMTP_PORT` | `1025` | |
| `SMTP_SECURE` | `false` | |
| `SMTP_USER` / `SMTP_PASS` | empty | Optional |
| `MAIL_FROM` | `Catalogue <no-reply@example.test>` | |
| `SALES_INBOX` | `sales@example.test` | |
| `ENQUIRY_RATE_LIMIT_MAX` | `5` | |
| `ENQUIRY_RATE_LIMIT_WINDOW_MS` | `900000` | 15 minutes |
| `LOG_LEVEL` | `info` | |

### Docker compose

| Service | Ports | Notes |
|---|---|---|
| `api` | `3000:3000` | Healthcheck `wget -qO- http://127.0.0.1:3000/health \|\| exit 1`. Depends on `mailpit`. |
| `mailpit` | `8025:8025` (UI + API), `1025:1025` (SMTP) | `axllent/mailpit` at a pinned tag. 1025 is published so the API can also run outside Docker with `npm run dev`. |
| `api-test` | — | `profiles: [test]`; Dockerfile `test` stage; runs `npm test`. |

### Category slugs and names (owned by the adapter)

| Upstream | Slug | Display name |
|---|---|---|
| `electronics` | `electronics` | Electronics |
| `jewelery` | `jewellery` | Jewellery |
| `men's clothing` | `mens-clothing` | Men's Clothing |
| `women's clothing` | `womens-clothing` | Women's Clothing |

Rule for unknown categories: lowercase, remove apostrophes, other non-alphanumerics → `-`. Display name in title case.

### Sort orders

| List | Order |
|---|---|
| Home `featured`, category `topRated` | Config order |
| Category `more`, search `results` | Rating average desc → rating count desc → ID asc (numeric-aware) |
| Categories | Display name A–Z |

### Search matching (`domain/search.ts`)

- Trim; lowercase; regex-escape.
- Match when the term appears at the start of the text or right after a character that is not a letter or digit: `(^|[^a-z0-9])<term>`. This is used instead of `\b` because `\b` fails for terms that start with punctuation.
- Text searched: title, description, category display name, raw upstream category.

### Upstream cache

One entry with the whole product list. Single-flight: concurrent cold requests share one load. On expiry, reload; if the reload fails, keep serving the old list and log a warning. Cold failure → `UpstreamError` → 502.

### Image proxy

| Case | Response |
|---|---|
| Unknown product | 404 JSON |
| Upstream 200 + `image/*` + ≤5 MB | 200 bytes, upstream `Content-Type`, `Cache-Control: public, max-age=86400` |
| Upstream non-200, non-image, timeout, or >5 MB | 502 `UPSTREAM_UNAVAILABLE`, `Cache-Control: no-store` |

Buffered, not streamed. No server-side image cache (the client caches).

---

## Tool versions

| Tool | Choice | Why |
|---|---|---|
| Node | 24 LTS (`node:24-alpine`, `.nvmrc`, `engines >=22.12`) | Current LTS. Vitest 5 needs ≥ 22.12. |
| HTTP | Express 5 | Best known; async errors reach the error handler. |
| Validation | zod | Requests, env and upstream data. |
| Email | nodemailer | SMTP; works with Mailpit and SES. |
| Rate limit | express-rate-limit | Standard, small. |
| Tests | Vitest 5 + Supertest; Swift Testing | Fast; built into Xcode. |
| Upstream HTTP | Built-in `fetch` + `AbortSignal.timeout` | No extra package. |
| Logging | Small `log.ts` writing JSON lines | No extra package. |
| Mail catcher | `axllent/mailpit`, pinned tag | UI and API on `8025`. |
