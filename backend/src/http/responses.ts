import type { Category, Product } from "../domain/product.js";

/**
 * Domain → API response shapes. The contract lives in contract/fixtures; these must match it.
 * Note what is NOT sent: the upstream image URL (the app gets our proxy path) and category.sourceName.
 */

export type CategoryResponse = { slug: string; name: string };

export type ProductSummaryResponse = {
  id: string;
  title: string;
  price: { amountMinor: number; currency: string };
  rating: { average: number; count: number };
  imagePath: string;
};

export type ProductDetailResponse = ProductSummaryResponse & {
  description: string;
  category: CategoryResponse;
};

export function toProductDetail(product: Product): ProductDetailResponse {
  return {
    ...toProductSummary(product),
    description: product.description,
    category: toCategoryResponse(product.category),
  };
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return { slug: category.slug, name: category.name };
}

export function toProductSummary(product: Product): ProductSummaryResponse {
  return {
    id: product.id,
    title: product.title,
    price: { amountMinor: product.price.amountMinor, currency: product.price.currency },
    rating: { average: product.rating.average, count: product.rating.count },
    imagePath: `/v1/products/${encodeURIComponent(product.id)}/image`,
  };
}
