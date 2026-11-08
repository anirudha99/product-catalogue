import { buildApp, type AppDeps } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { silentLogger } from "../../src/log.js";
import { FakeMailer } from "../fakes/FakeMailer.js";
import { snapshotSource } from "./snapshot.js";

/** Same fixed ID the contract fixtures use for requestId and enquiry references. */
export const FIXED_ID = "00000000-0000-4000-8000-000000000001";

/** Tests must opt in to network-like behaviour by passing their own fetchImpl. */
const noNetwork: typeof fetch = async () => {
  throw new Error("test tried to use the network; pass a fake fetchImpl");
};

/**
 * The real app, wired with the real Fake Store adapter over the committed snapshot,
 * default config (TOP_RATED_PRODUCT_IDS=3,5,11,12,18) and a fixed ID. Matches the inputs
 * documented in contract/README.md, so responses can be compared to the fixtures exactly.
 */
export function testApp(overrides: Partial<AppDeps> = {}) {
  return buildApp({
    config: loadConfig({}),
    logger: silentLogger,
    productSource: snapshotSource(),
    mailer: new FakeMailer(),
    fetchImpl: noNetwork,
    newId: () => FIXED_ID,
    ...overrides,
  });
}
