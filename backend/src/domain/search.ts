import type { Product } from "./product.js";

/**
 * True when the search term starts a word in the product's title, description, category name
 * or the source's category label. Case-insensitive; the whole trimmed phrase must match.
 *
 * "Start of a word" = start of the text, or right after a character that is not a letter or digit.
 * So "men" matches "Men's Clothing" but not "women" or "garments". A plain \b is not used because
 * it fails for terms that begin with punctuation.
 *
 * Pure function: any product source without native search can reuse it.
 */
export function matchesTerm(product: Product, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) return false;

  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}`, "u");
  const haystack = [product.title, product.description, product.category.name, product.category.sourceName]
    .join("\n")
    .toLowerCase();
  return pattern.test(haystack);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
