import type { Category, Product } from "../domain/product.js";
import { silentLogger, type Logger } from "../log.js";
import type { ProductSource } from "../products/ProductSource.js";

export type HomeView = { featured: Product[]; categories: Category[] };

/**
 * Business rules for browsing. "Top rated" has one meaning everywhere: the products the business
 * chose (TOP_RATED_PRODUCT_IDS), in the order chosen. It is not computed from star ratings.
 */
export class CatalogueService {
  constructor(
    private readonly source: ProductSource,
    private readonly topRatedIds: readonly string[],
    private readonly logger: Logger = silentLogger,
  ) {}

  async home(): Promise<HomeView> {
    const [featured, categories] = await Promise.all([this.chosenProducts(), this.source.listCategories()]);
    return { featured, categories };
  }

  /** The chosen products that still exist, in config order. A missing ID is skipped, not fatal. */
  private async chosenProducts(): Promise<Product[]> {
    const found = await Promise.all(this.topRatedIds.map((id) => this.source.getProduct(id)));
    const missing = this.topRatedIds.filter((_id, index) => found[index] === null);
    if (missing.length > 0) this.logger.warn("top-rated products not found in source", { missing });
    return found.filter((product): product is Product => product !== null);
  }
}
