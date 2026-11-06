import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./log.js";

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
  const app = buildApp({ config, logger, newId: randomUUID });

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
