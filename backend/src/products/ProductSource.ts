import type { Category, Product } from "../domain/product.js";

export type ProductQuery = {
  categorySlug?: string;
  /** Free-text search. Sources that can search natively should; others can use domain/search.ts. */
  text?: string;
};

/**
 * Where products come from. Fake Store today; a database, PIM or commerce platform later.
 * Implementations throw UpstreamError when they cannot answer.
 */
export interface ProductSource {
  listCategories(): Promise<Category[]>;
  listProducts(query?: ProductQuery): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
}
