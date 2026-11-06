import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FakeStoreProductSource, type FakeStoreProductSourceOptions } from "../../src/products/FakeStoreProductSource.js";

const SNAPSHOT_PATH = fileURLToPath(new URL("../../data/fakestore-snapshot.json", import.meta.url));

/** The committed Fake Store snapshot, as raw upstream JSON. Fresh copy each call. */
export function snapshotRaw(): unknown[] {
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as unknown[];
}

/** The real Fake Store adapter, fed the snapshot instead of the network. Tests run the shipping code. */
export function snapshotSource(options: Partial<FakeStoreProductSourceOptions> = {}): FakeStoreProductSource {
  return new FakeStoreProductSource({ load: async () => snapshotRaw(), ttlMs: 60_000, ...options });
}
