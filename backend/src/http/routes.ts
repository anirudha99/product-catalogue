import { Router } from "express";
import type { CatalogueService } from "../catalogue/CatalogueService.js";
import type { EnquiryService } from "../enquiries/EnquiryService.js";
import type { ProductSource } from "../products/ProductSource.js";
import { imageProxy } from "./imageProxy.js";
import { enquiryRateLimit } from "./rateLimit.js";
import { toCategoryResponse, toProductDetail, toProductSummary } from "./responses.js";
import { parseEnquiry, parseProductId } from "./schemas.js";

export type RouteDeps = {
  catalogue: CatalogueService;
  enquiries: EnquiryService;
  source: ProductSource;
  fetchImpl: typeof fetch;
  upstreamTimeoutMs: number;
  enquiryRateLimit: { max: number; windowMs: number };
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** /v1 routes. Thin: validate, call a service, map to the response shape. */
export function v1Routes(deps: RouteDeps): Router {
  const { catalogue, enquiries, source, fetchImpl, upstreamTimeoutMs } = deps;
  const router = Router();

  router.get("/home", async (_req, res) => {
    const home = await catalogue.home();
    res.json({
      featured: home.featured.map(toProductSummary),
      categories: home.categories.map(toCategoryResponse),
    });
  });

  router.get("/products/:id", async (req, res) => {
    const product = await catalogue.product(parseProductId(req.params.id));
    res.json(toProductDetail(product));
  });

  router.get(
    "/products/:id/image",
    imageProxy({ source, fetchImpl, timeoutMs: upstreamTimeoutMs, maxBytes: MAX_IMAGE_BYTES }),
  );

  // 202: today the email is sent before we answer; if it moves to a queue, 202 stays correct.
  router.post("/enquiries", enquiryRateLimit(deps.enquiryRateLimit), async (req, res) => {
    const receipt = await enquiries.submit(parseEnquiry(req.body));
    res.status(202).json(receipt);
  });

  return router;
}
