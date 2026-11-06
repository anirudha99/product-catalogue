import { describe, expect, it, vi } from "vitest";
import { CatalogueService } from "../../src/catalogue/CatalogueService.js";
import type { Logger } from "../../src/log.js";
import { snapshotSource } from "../support/snapshot.js";

describe("CatalogueService.home", () => {
  it("returns the chosen products in config order, not rating order", async () => {
    const service = new CatalogueService(snapshotSource(), ["18", "3", "11"]);
    const home = await service.home();
    expect(home.featured.map((product) => product.id)).toEqual(["18", "3", "11"]);
  });

  it("skips chosen IDs that no longer exist and logs which ones", async () => {
    const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const service = new CatalogueService(snapshotSource(), ["3", "999", "5"], logger);

    const home = await service.home();

    expect(home.featured.map((product) => product.id)).toEqual(["3", "5"]);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { missing: ["999"] });
  });

  it("includes every category", async () => {
    const home = await new CatalogueService(snapshotSource(), ["3"]).home();
    expect(home.categories.map((category) => category.slug)).toEqual([
      "electronics",
      "jewellery",
      "mens-clothing",
      "womens-clothing",
    ]);
  });
});
