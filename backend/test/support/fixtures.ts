import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads a contract fixture (the API spec) from <repo>/contract/fixtures.
 * Same relative path locally and in the Docker test stage (contract is copied to /contract).
 */
export function fixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../../../contract/fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}
