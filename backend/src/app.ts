import express, { type Express } from "express";
import { CatalogueService } from "./catalogue/CatalogueService.js";
import type { Config } from "./config.js";
import { errorHandler, notFoundRoute } from "./http/errorHandler.js";
import { v1Routes } from "./http/routes.js";
import type { Logger } from "./log.js";
import type { ProductSource } from "./products/ProductSource.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  productSource: ProductSource;
  /** Used by the image proxy. Injected so tests never touch the network. */
  fetchImpl: typeof fetch;
  /** Makes request IDs (and later enquiry references). Injected so tests get fixed values. */
  newId: () => string;
};

/** Builds the Express app from its dependencies. Does no I/O, so tests can pass fakes. */
export function buildApp(deps: AppDeps): Express {
  const { config, logger, productSource, fetchImpl, newId } = deps;
  const catalogue = new CatalogueService(productSource, config.topRatedProductIds, logger);

  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const requestId = newId();
    const started = performance.now();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    // Access log: path only (no query string, no body), so search terms and customer details stay out of logs.
    // originalUrl, not path: inside a mounted router req.path loses the "/v1" prefix.
    const path = req.originalUrl.split("?")[0] ?? "";
    res.on("finish", () => {
      if (path === "/health") return; // the container healthcheck calls this every 10s
      logger.info("request", {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
      });
    });
    next();
  });

  app.use(express.json({ limit: "10kb" }));

  // Liveness only: never calls the product source, so a slow upstream can't fail the healthcheck.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/v1",
    v1Routes({ catalogue, source: productSource, fetchImpl, upstreamTimeoutMs: config.upstreamTimeoutMs }),
  );

  app.use(notFoundRoute);
  app.use(errorHandler(logger));
  return app;
}
