# Decisions and assumptions

What was assumed where the requirements were open, what was cut, how the design is meant to grow, and what comes next. The original plan, with an alternative for every open question, is in [docs/PLAN.md](docs/PLAN.md).

## Assumptions

### The ones that shape the design

| Question | Decision | Alternative not taken |
|---|---|---|
| **What is "top rated"?** | One meaning everywhere: the products the business **chose** (`TOP_RATED_PRODUCT_IDS`), shown in that order. The requirement reads "GIVEN I have *chosen* 5 products". | Computing it from star ratings. Mixing both would give "top rated" two meanings across Home and category pages. |
| **Top rated on a category page** | The chosen products that belong to that category. If there are none, the section is hidden and the page shows "All products". | Topping up with the best-rated products, which brings the second meaning back. |
| **Search matching** | The whole trimmed phrase, case-insensitive, at the **start of a word**, across title, description and category name. "men" finds men's clothing, not "women" or "garments"; plain substring matching returns 13 of 20 products for "men". | Matching each word separately (AND). |
| **"The search button"** | The keyboard's Search key; results open on their own screen. | Search as you type. |
| **Product images** | Proxied through our API, because the product source hosts its own images and the app must never call it directly. The proxy only fetches the URL stored on the product, never one from the request. | Passing the source's image URLs to the app. |
| **Products per enquiry** | One, started from the product page. | An enquiry basket. |
| **Are enquiries stored?** | No; the email to sales is the record. If sending fails, the app keeps the form and asks the customer to try again. It never shows "Thank you" for an email that wasn't sent. | Store first, then send with retries (see "Next"). |

### Smaller ones

- **Contact details:**
  - Name and email are required; phone and message are optional.
  - Fields are trimmed, and an empty optional field counts as "not given".
- **Sales inbox:** set by `SALES_INBOX` on the backend, never taken from the request.
- **Customer copy of the email:** not sent. It wasn't asked for, and it would let anyone make us email any address.
- **Thank you:** replaces the form in the same sheet and shows a short reference.
- **Product page:** image, title, price, category, rating, description, Enquire button.
- **Prices:** USD, as whole cents plus a currency code.
- **Category names:** the backend owns slugs and display names, and fixes the upstream spelling (`jewelery` → "Jewellery").
- **Text from the product source:** leading and trailing spaces are trimmed.
- **Accounts, paging:** none. Anyone can browse and enquire, and there are 20 products.
- **Product source down:**
  - The product list is cached for 5 minutes.
  - If a refresh fails, the old list is kept and upstream is retried after 30 seconds.
  - With nothing cached, the API returns 502 and the app offers a retry.
- **Devices:** iPhone, portrait, light and dark mode, system text styles. Landscape, iPad and large Dynamic Type sizes are not tested.

## Cut or simplified

| What | Why it's acceptable for now |
|---|---|
| **Enquiry storage, queue and retries** | Email meets the requirement. The API already answers `202 Accepted`, so moving the send to a queue won't change the contract or the app. |
| **Admin screen for the top-rated list** | Config meets "I have chosen"; an admin screen needs authentication. |
| **OpenAPI spec and generated clients** | The shared contract fixtures pin the API from both sides. |
| **UI test of the enquiry flow** | View-model tests cover the logic, and `smoke.sh` covers the flow end to end at the API level. |
| **Server-side image cache** | Fine for 20 images; the app caches each image for a day. First loads take about 1.5 s each. |
| **CI, infrastructure as code** | `scripts/check.sh` runs everything locally. The API is a plain container (ECS Fargate or App Runner), and SES speaks SMTP, so it stays AWS-compatible. |
| **Brand styling** | The design work isn't ready. `Theme.swift` holds every colour, font and size. |
| **Paging, iPad, localisation** | Not needed yet. |

## How this grows

| Change | What you touch | What stays the same |
|---|---|---|
| **A new product source** (database, Shopify, a PIM) | A class implementing `ProductSource`, mapping to our `Product` type, selected in `server.ts` and `config.ts`. See "Next" item 4. | Services, routes, the contract, the app |
| **A new email provider** | SES: environment variables only. An HTTP email API: one class implementing `Mailer`. | Enquiry rules, the email text, routes, the app |
| **A new look and feel** | `ios/Catalogue/Theme/Theme.swift`, asset-catalogue colours, font files. A boundary check stops literal styles in views. | View models, networking, tests |
| **Top-rated list managed in a CMS** | What `CatalogueService` receives instead of the config list | Routes, contract, app |
| **A web client** | Add CORS. Product, search and enquiry endpoints are reusable as they are; new screens get thin endpoints over the same services. | Services, adapters |
| **A hosted API** | `API_HOST` in `ios/Config/Release.xcconfig` | Code |

The source swap has three known costs today, covered by "Next" item 4:
- The cache lives inside the Fake Store adapter, so a new source would need it moved into a wrapper.
- Image fetching sits in `http/imageProxy.ts` and assumes a public image URL.
- The API tests use Fake Store snapshot data.

Already in place:
- **Data model:** IDs are strings and prices are integer cents.
- **Response shapes:** every response and error has a fixed, tested shape.
- **Tracing:** a request ID on every response and access-log line.
- **Config:** checked at startup, failing fast with every problem listed.
- **Enquiries:** rate-limited, and validated server-side.

## Next

1. **Don't lose or duplicate leads.** Store each enquiry first, then send the email from a queue with retries (an outbox table, or SQS). Accept an idempotency key from the app, so a retry after a lost response can't create a second enquiry.
2. **One contract source.** Generate an OpenAPI spec from the zod schemas, and the Swift models from that. Keep the fixtures as examples.
3. **CI.** Backend tests, formatting and the boundary check on Linux; iOS tests on a macOS runner; `npm audit`.
4. **Make the source swap smaller.** Move the cache into a wrapper around any `ProductSource`, and put image fetching behind the interface (`getImage(id)`).
5. **Production readiness.**
   - A rate limit shared across instances (Redis), with `trust proxy` set for the load balancer.
   - A honeypot field or CAPTCHA on the enquiry form.
   - Images served from S3 + CloudFront.
   - Infrastructure as code (CDK) for ECS Fargate and SES.
6. **The app.**
   - A UI test for the enquiry flow.
   - An accessibility pass.
   - Search within a category.
   - Deep links (the `Route` enum is ready for them).

## Changes from the original plan

- **Error responses are never cached** (`Cache-Control: no-store`), so a temporary failure can't stick in the app's cache.
- **The rate limit counts every enquiry attempt with a readable body, valid or not.** Bodies that aren't JSON or are over 10 KB are refused before it runs, and can't send email.
- **There is an access log:** method, path, status, time. It never includes the query string, so search terms and customer details stay out of logs.
- **The enquiry form has three states:** `editing / submitting / submitted`. Errors stay next to the form, so nothing the customer typed is lost.
- **`Info.plist` lives in `ios/Config/`, outside the synced app folder.** Inside it, Xcode would copy the file as a resource and the build would fail.
- **The HTTP client has its own tests after all**, against a stubbed network (URLs, query encoding, the enquiry body, Retry-After, error mapping). The plan had cut them.
- **More safeguards:**
  - Cancel is disabled while an enquiry is sending.
  - Server timeouts are shorter than the app's, so the server always answers first.
  - An empty product list from upstream counts as a failure.
  - Duplicate top-rated IDs are rejected at startup.
  - The image proxy refuses SVG.
  - Unreadable request bodies get 400.
  - Docker ports are bound to localhost.

## Known limits

- **Rate limiting may be shared locally.** Behind Docker's port forwarding, all clients may appear as one IP.
- **The cache and the rate limit are in memory.** They reset on restart, and each instance has its own.
- **An enquiry isn't saved if the mail server is down.** The customer is asked to try again.
- **A lost response can cause a duplicate.** The email is sent, the network drops, and the customer retries. The server and app timeouts are aligned to keep this rare; an idempotency key fixes it.
- **The Release build's API address is a placeholder.**
