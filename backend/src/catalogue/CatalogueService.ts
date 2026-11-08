import { NotFoundError } from "../domain/errors.js";
import { byRating, type Category, type Product } from "../domain/product.js";
import { silentLogger, type Logger } from "../log.js";
import type { ProductSource } from "../products/ProductSource.js";

export type HomeView = { featured: Product[]; categories: Category[] };
export type CategoryView = { category: Category; topRated: Product[]; more: Product[] };

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

  /**
   * A category page: the chosen top-rated products that are in this category (config order),
   * then every other product in it (by rating). No product appears twice. topRated may be empty.
   */
  async category(slug: string): Promise<CategoryView> {
    const category = (await this.source.listCategories()).find((c) => c.slug === slug);
    if (!category) throw new NotFoundError("Category not found.");

    const inCategory = await this.source.listProducts({ categorySlug: slug });
    const byId = new Map(inCategory.map((product) => [product.id, product]));
    const topRated = this.topRatedIds.flatMap((id) => byId.get(id) ?? []);
    const chosen = new Set(topRated.map((product) => product.id));
    const more = inCategory.filter((product) => !chosen.has(product.id)).sort(byRating);
    return { category, topRated, more };
  }

  /** Whole-catalogue search; best rated first. */
  async search(term: string): Promise<Product[]> {
    return (await this.source.listProducts({ text: term })).sort(byRating);
  }

  async product(id: string): Promise<Product> {
    const product = await this.source.getProduct(id);
    if (!product) throw new NotFoundError("Product not found.");
    return product;
  }

  /** The chosen products that still exist, in config order. A missing ID is skipped, not fatal. */
  private async chosenProducts(): Promise<Product[]> {
    const found = await Promise.all(this.topRatedIds.map((id) => this.source.getProduct(id)));
    const missing = this.topRatedIds.filter((_id, index) => found[index] === null);
    if (missing.length > 0) this.logger.warn("top-rated products not found in source", { missing });
    return found.filter((product): product is Product => product !== null);
  }
}
