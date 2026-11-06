import { Router } from "express";
import type { CatalogueService } from "../catalogue/CatalogueService.js";
import type { ProductSource } from "../products/ProductSource.js";
import { imageProxy } from "./imageProxy.js";
import { toCategoryResponse, toProductSummary } from "./responses.js";

export type RouteDeps = {
  catalogue: CatalogueService;
  source: ProductSource;
  fetchImpl: typeof fetch;
  upstreamTimeoutMs: number;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** /v1 routes. Thin: validate, call a service, map to the response shape. */
export function v1Routes({ catalogue, source, fetchImpl, upstreamTimeoutMs }: RouteDeps): Router {
  const router = Router();

  router.get("/home", async (_req, res) => {
    const home = await catalogue.home();
    res.json({
      featured: home.featured.map(toProductSummary),
      categories: home.categories.map(toCategoryResponse),
    });
  });

  router.get(
    "/products/:id/image",
    imageProxy({ source, fetchImpl, timeoutMs: upstreamTimeoutMs, maxBytes: MAX_IMAGE_BYTES }),
  );

  return router;
}
