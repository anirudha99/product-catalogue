import { z } from "zod";
import { UpstreamError } from "../domain/errors.js";
import type { Category, Product } from "../domain/product.js";
import { matchesTerm } from "../domain/search.js";
import { silentLogger, type Logger } from "../log.js";
import type { RawLoader } from "./loaders.js";
import type { ProductQuery, ProductSource } from "./ProductSource.js";

/** Upstream shape. Checked before use: we don't trust the upstream API any more than the app. */
const fakeStoreProduct = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  category: z.string().min(1),
  image: z.url(),
  rating: z.object({ rate: z.number().min(0).max(5), count: z.number().int().nonnegative() }),
});
type FakeStoreProduct = z.infer<typeof fakeStoreProduct>;

/** Fake Store's labels → our slugs and display names. Fixes the upstream "jewelery" spelling. */
const KNOWN_CATEGORIES: Record<string, { slug: string; name: string }> = {
  electronics: { slug: "electronics", name: "Electronics" },
  jewelery: { slug: "jewellery", name: "Jewellery" },
  "men's clothing": { slug: "mens-clothing", name: "Men's Clothing" },
  "women's clothing": { slug: "womens-clothing", name: "Women's Clothing" },
};

/** After a failed refresh, keep serving the old list and wait this long before asking upstream again. */
const RETRY_AFTER_FAILURE_MS = 30_000;

export type FakeStoreProductSourceOptions = {
  load: RawLoader;
  ttlMs: number;
  now?: () => number;
  logger?: Logger;
};

/**
 * Fake Store has no search and no reliable single-product lookup, so this loads the whole list
 * (20 products), caches it, and answers every query from memory.
 */
export class FakeStoreProductSource implements ProductSource {
  private readonly load: RawLoader;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly logger: Logger;
  private cache: { products: Product[]; refreshAt: number } | undefined;
  private inFlight: Promise<Product[]> | undefined;

  constructor(options: FakeStoreProductSourceOptions) {
    this.load = options.load;
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? silentLogger;
  }

  async listCategories(): Promise<Category[]> {
    const bySlug = new Map<string, Category>();
    for (const product of await this.products()) bySlug.set(product.category.slug, product.category);
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  }

  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    const { categorySlug, text } = query;
    return (await this.products()).filter(
      (product) =>
        (categorySlug === undefined || product.category.slug === categorySlug) &&
        (text === undefined || matchesTerm(product, text)),
    );
  }

  async getProduct(id: string): Promise<Product | null> {
    return (await this.products()).find((product) => product.id === id) ?? null;
  }

  private async products(): Promise<Product[]> {
    if (this.cache && this.now() < this.cache.refreshAt) return this.cache.products;

    // Single flight: concurrent requests share one upstream call.
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = undefined;
    });

    try {
      return await this.inFlight;
    } catch (err) {
      if (this.cache) {
        this.logger.warn("product refresh failed; serving cached products", {
          reason: err instanceof Error ? err.message : String(err),
        });
        this.cache.refreshAt = this.now() + RETRY_AFTER_FAILURE_MS;
        return this.cache.products;
      }
      throw err instanceof UpstreamError ? err : new UpstreamError(String(err));
    }
  }

  private async refresh(): Promise<Product[]> {
    const products = this.parse(await this.load());
    this.cache = { products, refreshAt: this.now() + this.ttlMs };
    return products;
  }

  private parse(raw: unknown): Product[] {
    if (!Array.isArray(raw)) throw new UpstreamError("Fake Store response is not a list of products");

    const products: Product[] = [];
    for (const item of raw) {
      const parsed = fakeStoreProduct.safeParse(item);
      if (parsed.success) {
        products.push(toProduct(parsed.data));
      } else {
        // One bad record shouldn't take the catalogue down; skip it and say so.
        this.logger.warn("skipping invalid upstream product", { issues: parsed.error.issues.length });
      }
    }
    // An empty list is treated as a failure, so a glitch upstream can't replace a good cached catalogue with nothing.
    if (products.length === 0) throw new UpstreamError("Fake Store returned no valid products");
    return products;
  }
}

function toProduct(raw: FakeStoreProduct): Product {
  return {
    id: String(raw.id),
    title: raw.title.trim(),
    description: raw.description.trim(),
    category: toCategory(raw.category),
    price: { amountMinor: Math.round(raw.price * 100), currency: "USD" },
    imageUrl: raw.image,
    rating: { average: raw.rating.rate, count: raw.rating.count },
  };
}

function toCategory(sourceName: string): Category {
  const known = KNOWN_CATEGORIES[sourceName];
  if (known) return { ...known, sourceName };
  // Unknown upstream category: derive a slug and a title-cased name.
  const slug = sourceName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Capitalise after spaces only, so "men's" becomes "Men's", not "Men'S".
  const name = sourceName.replace(
    /(^|\s)(\p{L})/gu,
    (_match, space: string, letter: string) => space + letter.toUpperCase(),
  );
  return { slug: slug || "other", name, sourceName };
}
