import express, { type Express } from "express";
import type { Config } from "./config.js";
import type { Logger } from "./log.js";
import { errorHandler, notFoundRoute } from "./http/errorHandler.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  /** Makes request IDs (and later enquiry references). Injected so tests get fixed values. */
  newId: () => string;
};

/** Builds the Express app from its dependencies. Does no I/O, so tests can pass fakes. */
export function buildApp(deps: AppDeps): Express {
  const { logger, newId } = deps;
  const app = express();
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    const requestId = newId();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });

  app.use(express.json({ limit: "10kb" }));

  // Liveness only: never calls the product source, so a slow upstream can't fail the healthcheck.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(notFoundRoute);
  app.use(errorHandler(logger));
  return app;
}
