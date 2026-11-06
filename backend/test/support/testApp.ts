import { buildApp, type AppDeps } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { silentLogger } from "../../src/log.js";

/** Same fixed ID the contract fixtures use for requestId and enquiry references. */
export const FIXED_ID = "00000000-0000-4000-8000-000000000001";

export function testApp(overrides: Partial<AppDeps> = {}) {
  return buildApp({
    config: loadConfig({}),
    logger: silentLogger,
    newId: () => FIXED_ID,
    ...overrides,
  });
}
