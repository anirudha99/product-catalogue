# API contract fixtures

These JSON files **are** the API spec for `/v1`.

- Backend API tests check each response **equals** its fixture (`backend/test/api`).
- iOS tests decode every fixture into the app's real `Codable` types (`ios/CatalogueTests`).
- If either side drifts from the contract, a test fails. A contract change must update the fixture in the same commit.

## Where they come from

[`generate_fixtures.py`](generate_fixtures.py) builds them from the product snapshot using the rules below. It is deliberately **separate from the backend code**: the backend tests then check the TypeScript against an independent implementation of the same rules.

```bash
python3 contract/generate_fixtures.py backend/data/fakestore-snapshot.json contract/fixtures
git diff contract/fixtures   # empty = the contract is unchanged
```

Change a rule here and in the backend in the same commit, and say why in the message.

## Inputs that produce these exact files

| Input | Value |
|---|---|
| Product data | `backend/data/fakestore-snapshot.json` |
| `TOP_RATED_PRODUCT_IDS` | `3,5,11,12,18` (for `category-no-picks.json`: `3,5,18`) |
| Request and reference IDs | fixed: `00000000-0000-4000-8000-000000000001` |

## Files

| File | Request |
|---|---|
| `home.json` | `GET /v1/home` |
| `category-electronics.json` | `GET /v1/categories/electronics` |
| `category-no-picks.json` | `GET /v1/categories/electronics` when no electronics product is chosen |
| `search-jacket.json` | `GET /v1/search?q=jacket` |
| `search-no-results.json` | `GET /v1/search?q=submarine` |
| `product-3.json` | `GET /v1/products/3` |
| `enquiry-accepted.json` | `POST /v1/enquiries` (202) |
| `error-validation.json` | `POST /v1/enquiries` with no name and a bad email (400) |
| `error-not-found.json` | `GET /v1/products/999` (404) |
| `error-rate-limited.json` | `POST /v1/enquiries` over the limit (429) |
| `error-upstream.json` | Any catalogue request when the product source fails with no cached copy (502) |

## Rules applied

- Titles and descriptions: leading and trailing spaces removed (upstream has some, e.g. "…Boat Neck V ").
- Price: `Math.round(price * 100)` cents, currency `USD`.
- `featured` and `topRated`: the chosen IDs in config order. `topRated` keeps only those in the category.
- `more` and search `results`: rating average desc, then rating count desc, then ID asc.
- Categories: sorted by display name.
- Search: trimmed, case-insensitive, the term must start a word. Matches title, description, category display name and the raw upstream category.
- Errors: `fields` appears only on `VALIDATION_FAILED`.
