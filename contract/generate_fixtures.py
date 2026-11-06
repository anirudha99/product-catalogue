"""Derive contract fixtures from the Fake Store snapshot using PLAN.md rules.
Independent of the backend code on purpose: the TS implementation is tested against this output.
Usage (from the repo root): python3 contract/generate_fixtures.py backend/data/fakestore-snapshot.json contract/fixtures
"""
import json, math, re, sys, os

snap_path, out_dir = sys.argv[1], sys.argv[2]
raw = json.load(open(snap_path))

FIXED_ID = "00000000-0000-4000-8000-000000000001"
CATS = {  # upstream -> (slug, display name)   PLAN.md section 11
    "electronics": ("electronics", "Electronics"),
    "jewelery": ("jewellery", "Jewellery"),
    "men's clothing": ("mens-clothing", "Men's Clothing"),
    "women's clothing": ("womens-clothing", "Women's Clothing"),
}

def js_round(x):  # Math.round semantics (half up), not Python banker's rounding
    return math.floor(x + 0.5)

products = []
for r in raw:
    slug, name = CATS[r["category"]]
    products.append({
        "id": str(r["id"]), "title": r["title"].strip(), "description": r["description"].strip(),
        "category": {"slug": slug, "name": name, "sourceName": r["category"]},
        "amountMinor": js_round(r["price"] * 100),
        "rating": {"average": r["rating"]["rate"], "count": r["rating"]["count"]},
    })
by_id = {p["id"]: p for p in products}

def summary(p):
    return {"id": p["id"], "title": p["title"],
            "price": {"amountMinor": p["amountMinor"], "currency": "USD"},
            "rating": p["rating"], "imagePath": f"/v1/products/{p['id']}/image"}

def category(p):
    return {"slug": p["category"]["slug"], "name": p["category"]["name"]}

def rank_key(p):  # rating desc, count desc, id asc (numeric-aware)
    return (-p["rating"]["average"], -p["rating"]["count"], int(p["id"]))

def matches(p, term):
    t = re.escape(term.strip().lower())
    text = " ".join([p["title"], p["description"], p["category"]["name"], p["category"]["sourceName"]]).lower()
    return re.search(r"(^|[\W_])" + t, text) is not None

def categories():
    seen = {}
    for p in products:
        seen[p["category"]["slug"]] = category(p)
    return sorted(seen.values(), key=lambda c: c["name"])

def category_screen(slug, chosen):
    in_cat = [p for p in products if p["category"]["slug"] == slug]
    top = [by_id[i] for i in chosen if i in by_id and by_id[i]["category"]["slug"] == slug]
    top_ids = {p["id"] for p in top}
    more = sorted([p for p in in_cat if p["id"] not in top_ids], key=rank_key)
    return {"category": category(in_cat[0]), "topRated": [summary(p) for p in top], "more": [summary(p) for p in more]}

def search(term):
    hits = sorted([p for p in products if matches(p, term)], key=rank_key)
    return {"term": term, "results": [summary(p) for p in hits]}

def error(code, message, fields=None):
    e = {"code": code, "message": message}
    if fields:
        e["fields"] = fields
    e["requestId"] = FIXED_ID
    return {"error": e}

CHOSEN = ["3", "5", "11", "12", "18"]          # TOP_RATED_PRODUCT_IDS default
CHOSEN_NO_ELECTRONICS = ["3", "5", "18"]       # test config for category-no-picks

p3 = by_id["3"]
fixtures = {
    "home.json": {"featured": [summary(by_id[i]) for i in CHOSEN], "categories": categories()},
    "category-electronics.json": category_screen("electronics", CHOSEN),
    "category-no-picks.json": category_screen("electronics", CHOSEN_NO_ELECTRONICS),
    "search-jacket.json": search("jacket"),
    "search-no-results.json": search("submarine"),
    "product-3.json": {**summary(p3), "description": p3["description"], "category": category(p3)},
    "enquiry-accepted.json": {"reference": FIXED_ID},
    "error-validation.json": error("VALIDATION_FAILED", "Some fields need attention.",
                                   {"name": "Enter your name.", "email": "Enter a valid email address."}),
    "error-not-found.json": error("NOT_FOUND", "Product not found."),
    "error-rate-limited.json": error("RATE_LIMITED", "Too many enquiries. Please try again later."),
    "error-upstream.json": error("UPSTREAM_UNAVAILABLE", "Products are unavailable right now. Please try again."),
}

os.makedirs(out_dir, exist_ok=True)
for name, body in fixtures.items():
    with open(os.path.join(out_dir, name), "w") as f:
        f.write(json.dumps(body, indent=2, ensure_ascii=False) + "\n")
    print(name)
