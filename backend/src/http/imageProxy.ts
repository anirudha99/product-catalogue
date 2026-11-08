import type { RequestHandler } from "express";
import { NotFoundError, UpstreamError } from "../domain/errors.js";
import type { ProductSource } from "../products/ProductSource.js";
import { parseProductId } from "./schemas.js";

export type ImageProxyOptions = {
  source: ProductSource;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxBytes: number;
};

/**
 * GET /v1/products/:id/image — so the app never talks to the product source's image host.
 * Only ever fetches the URL stored on the product (never a URL from the request), so it is not an open proxy.
 * Buffered, size-capped, and only image/* content is passed through.
 */
export function imageProxy({ source, fetchImpl, timeoutMs, maxBytes }: ImageProxyOptions): RequestHandler {
  return async (req, res) => {
    const id = parseProductId(req.params.id);
    const product = await source.getProduct(id);
    if (!product) throw new NotFoundError("Product not found.");

    let upstream: Response;
    try {
      upstream = await fetchImpl(product.imageUrl, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw imageError(`image request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    const declared = Number(upstream.headers.get("content-length"));
    const problem = !upstream.ok
      ? `image host returned HTTP ${upstream.status}`
      : !ALLOWED_IMAGE_TYPE.test(contentType)
        ? `image host returned ${contentType || "no content type"}`
        : Number.isFinite(declared) && declared > maxBytes
          ? `image is ${declared} bytes`
          : undefined;
    if (problem) {
      await upstream.body?.cancel(); // don't leave the rejected download open
      throw imageError(problem);
    }
    const body = await readCapped(upstream, maxBytes);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(body);
  };
}

/** Raster images only. SVG is refused: it can carry script, which matters once a web client exists. */
const ALLOWED_IMAGE_TYPE = /^image\/(png|jpeg|webp|gif)(;|$)/i;

function imageError(reason: string): UpstreamError {
  return new UpstreamError(reason);
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw imageError(`image is over ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
