# Decisions and assumptions

The acceptance criteria leave gaps on purpose. This file records what I assumed, what I cut, how the design grows, and what I'd do next. The full reasoning, with the alternative I didn't take for each gap, is in [PLAN.md](PLAN.md) section 1.

## Assumptions where the criteria were unclear

### The ones that shape the design

| Gap | Assumption | Alternative not taken, and why |
|---|---|---|
| **What is "top rated"?** | One meaning everywhere: the products the business **chose**, set in `TOP_RATED_PRODUCT_IDS` and shown in that order. The AC says "GIVEN I have *chosen* 5 products". | Computing "top rated" from star ratings. The first plan did that for category pages while Home used a hand-picked list; with its first default IDs (`1,5,9,14,18`) a 2.2★ product would have been "top rated" on Home but not on its own category page. Two meanings, caught in review. |
| **Top rated on a category page** | The chosen products that are in that category; if none are, that section is hidden and the page shows "All products". | Filling up with the best-rated products: that brings the second meaning back. |
| **Search matching** | The whole trimmed phrase, case-insensitive, at the **start of a word**, across title, description and category name. "men" finds men's clothing, not "women" or "garments" (plain substring matching returned 13 of 20 products for "men"). | Matching every word separately (AND). Arguably friendlier; slightly more code. |
| **"The search button"** | The keyboard's Search key; results open on their own screen. No search-as-you-type, because the AC says "WHEN I click the search button". | Live results with a delay. |
| **Product images** | Proxied through our API. Fake Store hosts its own images, and the brief says the client must not call Fake Store. The proxy only ever fetches the URL stored on the product, never one from the request. | Passing Fake Store's image URLs to the app: less code, but the app would talk to Fake Store directly. |
| **One product or several per enquiry?** | One, started from the product page. | An enquiry basket: needs basket state in the app. |
| **Are enquiries stored?** | No. The email to sales is the record. If sending fails, the app keeps the form and asks the customer to try again; it never says "Thank you" for an email that wasn't sent. | Save first, then email with retries. This is the first thing I'd add (see "Next"). |

### Smaller ones

- **Contact details:** name and email required; phone and message optional. Fields are trimmed; an empty optional field counts as "not given".
- **Sales inbox:** set by `SALES_INBOX` on the backend, never taken from the request, so the API can't be used to send mail anywhere else.
- **Customer copy of the email:** not sent. Not in the AC, and it would let anyone make us email any address.
- **Thank you:** replaces the form in the same sheet and shows a short reference.
- **Product page:** image, title, price, category, rating, description, Enquire button.
- **Prices:** USD, sent as whole cents plus a currency code (no floating-point money in the API).
- **Category names:** the backend owns slugs and display names, and fixes the upstream spelling (`jewelery` → "Jewellery").
- **Text from the product source:** leading and trailing spaces are trimmed (some upstream titles have them).
- **Accounts, paging:** none. Anyone can browse and enquire; there are 20 products.
- **Product source down:** the product list is cached for 5 minutes. If a refresh fails, the old list is kept and upstream is retried after 30 seconds. With nothing cached, the API returns a clear 502 and the app shows a retry.
- **Devices:** iPhone, portrait, light and dark mode, system text styles. Landscape, iPad and large Dynamic Type sizes are not tested, so not claimed.

## Requirements dropped or simplified, and why

| What | Why it's safe for now |
|---|---|
| **Enquiry storage, queue and retries** | Email meets the AC. The API already answers `202 Accepted`, so moving the send to a queue later doesn't change the contract or the app. |
| **Admin screen for the top-rated list** | Config meets "I have chosen". A real admin needs authentication. |
| **OpenAPI spec and generated clients** | The shared contract fixtures pin the API from both sides today. |
| **UI test of the enquiry flow** | View-model tests cover the logic; the flow was checked by hand on the simulator against the real stack, and `smoke.sh` covers it end to end at the API level. |
| **Server-side image cache** | Fine for 20 images; the app caches each image for a day. First loads are slow (about 1.5 s each through the proxy). |
| **CI, infrastructure as code** | `scripts/check.sh` runs everything locally. The API is a plain container (ECS Fargate or App Runner) and SES has an SMTP endpoint, so it stays AWS-compatible. |
| **Brand styling** | The creative work is still in progress. `Theme.swift` holds every colour, font and size, so it's one file to change. |
| **Paging, iPad, localisation** | Not needed to firm up the vision. |

## How this grows

Each change the brief expects lands in one place:

| Change | What you touch | What stays the same |
|---|---|---|
| **A new product source** (database, Shopify, a PIM) | A class implementing `ProductSource` that maps to our `Product` type, chosen in `server.ts` and `config.ts`. Also, honestly: the cache and single-flight live inside the Fake Store adapter today, so a new source would need them pulled into a wrapper; image fetching sits in `http/imageProxy.ts` and assumes a public image URL (signed or private images would change it); and the API tests use Fake Store snapshot data, so a new source needs its own test data. | Services, routes, the contract and the app. |
| **A new email provider** | For SES: environment variables only (it speaks SMTP). For an HTTP email API: one class implementing `Mailer`. | Enquiry rules, the email text, routes, the app. |
| **A new look and feel** | `ios/Catalogue/Theme/Theme.swift`, asset-catalogue colours, font files. Views take every style from the Theme (a boundary check enforces it). | View models, networking, tests. |
| **Top-rated list chosen in a CMS** | What `CatalogueService` receives instead of the config list. | Routes, contract, app. |
| **A web client** | Add CORS. Product, search and enquiry endpoints are reusable as they are; new screens get thin endpoints over the same services. | Services, adapters. |
| **A hosted API** | `API_HOST` in `ios/Config/Release.xcconfig`. | Code. |

Things already in place for growth:

- IDs are strings and prices are integer cents.
- Every response and error has a fixed, tested shape.
- A request ID on every response and every access-log line.
- Config is checked at startup and fails fast with every problem listed.
- The enquiry endpoint is rate-limited and validates everything server-side.

## What I'd do with another day

1. **Don't lose or duplicate leads.** Store each enquiry first, then send the email from a queue with retries (an outbox table, or SQS). Accept an idempotency key from the app, so a retry after a lost response can't create a second enquiry. The app already treats `202` as "received".
2. **One contract source.** Generate an OpenAPI spec from the zod schemas, and generate the Swift models from it. Keep the fixtures as examples.
3. **CI.** GitHub Actions: backend tests and the boundary check on Linux, iOS tests on a macOS runner, plus `npm audit`.
4. **Make the source swap as small as the design promises.** Pull the cache into a wrapper around any `ProductSource`, and put image fetching behind the interface too (`getImage(id)`), so private or signed images don't touch the HTTP layer.
5. **Production readiness.**
   - A rate limit shared across instances (Redis), with `trust proxy` set for the load balancer.
   - A honeypot field or CAPTCHA on enquiries.
   - Images moved to S3 + CloudFront instead of the proxy.
   - Infrastructure as code (CDK) for ECS Fargate and SES.
6. **The app.**
   - A UI test for the enquiry flow.
   - An accessibility pass (VoiceOver labels, large text sizes).
   - Search on the category page.
   - Deep links (the `Route` enum is ready for them).

## Where the build differed from the plan

- **Error responses are never cached** (`Cache-Control: no-store`). This applies to every error, not just the image proxy's, so a temporary failure can't stick in the app's cache.
- **The rate limit counts every enquiry attempt, valid or not.** This stops someone probing the validation without limit.
- **The API has an access log:** method, path, status and time. It never logs the query string, so search terms and customer details stay out of the logs.
- **The enquiry form uses `editing / submitting / submitted`.** The plan had a separate "failed" state. Instead, errors are kept next to the form, so nothing the customer typed is lost.
- **`Info.plist` lives in `ios/Config/`, outside the app's source folder.** Inside the folder, Xcode would copy it a second time as a resource and the build would fail.
- **The Xcode project file was edited once, by a checked script** (with my approval, Xcode closed). The Xcode 26 template writes settings directly into the project file, where they override any `.xcconfig`. The edit was verified by build settings and a full test run.
- **Added after the final review** (none were in the plan):
  - The enquiry's Cancel button is disabled while sending.
  - Server timeouts were shortened, so the server always answers before the app gives up.
  - An empty product list from upstream counts as a failure (it can't wipe the cache).
  - Duplicate top-rated IDs are rejected at startup.
  - The image proxy refuses SVG.
  - Unreadable request bodies get 400, not 500.
  - Docker ports are bound to this machine only.

## Known limits

- **Behind Docker's port forwarding, all clients may appear as one IP.** So the rate limit is effectively global locally.
- **The cache and the rate limit live in memory.** They reset on restart and are per instance.
- **If the mail server is down, an enquiry is not saved.** The customer is told to try again (see "Next", item 1).
- **A lost response can still cause a duplicate.** If the network drops after the email is sent but before the app hears back, the customer may retry and sales gets two emails. It's rare (server and app timeouts are aligned), and an idempotency key fixes it ("Next", item 1).
- **The Release build's API address is a placeholder,** `https://api.example.com`.
