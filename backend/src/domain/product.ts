/** Our own product model. Every product source maps into this; nothing outside an adapter sees upstream shapes. */

export type Category = {
  /** URL-safe ID, e.g. "mens-clothing". */
  slug: string;
  /** Shown to customers, e.g. "Men's Clothing". */
  name: string;
  /** The source's own label, e.g. "men's clothing". Kept so search matches both spellings. */
  sourceName: string;
};

export type Money = {
  /** Whole minor units (cents) to avoid float rounding. */
  amountMinor: number;
  /** ISO 4217 code. */
  currency: string;
};

export type Product = {
  /** String, so a future source can use SKUs or UUIDs. */
  id: string;
  title: string;
  description: string;
  category: Category;
  price: Money;
  /** Internal: where the image really lives. The app only ever gets our proxy path. */
  imageUrl: string;
  rating: { average: number; count: number };
};

/** Display order for "more" lists and search results: rating, then review count, then ID. */
export function byRating(a: Product, b: Product): number {
  return (
    b.rating.average - a.rating.average ||
    b.rating.count - a.rating.count ||
    a.id.localeCompare(b.id, "en", { numeric: true })
  );
}
