import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./log.js";
import { FakeStoreProductSource } from "./products/FakeStoreProductSource.js";
import { fetchFromFakeStore, readSnapshot } from "./products/loaders.js";

/** Composition root: the only place that reads the environment and builds real adapters. */
function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(err.message + "\n");
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger(config.logLevel);

  // The one place the product source is chosen. A new source = a new ProductSource class + one line here.
  const load =
    config.productSource === "snapshot"
      ? readSnapshot(config.snapshotPath)
      : fetchFromFakeStore(config.fakeStoreBaseUrl, config.upstreamTimeoutMs);
  const productSource = new FakeStoreProductSource({ load, ttlMs: config.cacheTtlMs, logger });

  const app = buildApp({ config, logger, productSource, fetchImpl: fetch, newId: randomUUID });

  const server = app.listen(config.port, () => {
    logger.info("api listening", { port: config.port, productSource: config.productSource });
  });

  const shutdown = (signal: string) => {
    logger.info("shutting down", { signal });
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
