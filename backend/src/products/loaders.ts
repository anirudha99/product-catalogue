import { readFile } from "node:fs/promises";
import { UpstreamError } from "../domain/errors.js";

/** Returns the raw (unvalidated) Fake Store product list. */
export type RawLoader = () => Promise<unknown>;

/**
 * Loads every product from the live Fake Store API in one call.
 * We never call /products/{id}: for an unknown ID it answers 200 with an empty body, not 404.
 */
export function fetchFromFakeStore(baseUrl: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): RawLoader {
  return async () => {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/products`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new UpstreamError(`Fake Store request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      throw new UpstreamError(`Fake Store returned HTTP ${res.status}`);
    }
    try {
      return await res.json();
    } catch {
      throw new UpstreamError("Fake Store returned a body that is not JSON");
    }
  };
}

/** Loads the committed snapshot instead (PRODUCT_SOURCE=snapshot): works offline. */
export function readSnapshot(path: string): RawLoader {
  return async () => {
    try {
      return JSON.parse(await readFile(path, "utf8")) as unknown;
    } catch (err) {
      throw new UpstreamError(`Could not read snapshot ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}
