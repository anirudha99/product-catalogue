import { describe, expect, it, vi } from "vitest";
import { CatalogueService } from "../../src/catalogue/CatalogueService.js";
import { NotFoundError } from "../../src/domain/errors.js";
import type { Logger } from "../../src/log.js";
import { snapshotSource } from "../support/snapshot.js";

describe("CatalogueService.category", () => {
  it("puts chosen products first in config order, then the rest by rating, with no repeats", async () => {
    const view = await new CatalogueService(snapshotSource(), ["12", "3", "11"]).category("electronics");

    expect(view.topRated.map((p) => p.id)).toEqual(["12", "11"]);
    expect(view.more.map((p) => p.id)).toEqual(["9", "10", "13", "14"]);
  });

  it("has an empty topRated when nothing in the category was chosen", async () => {
    const view = await new CatalogueService(snapshotSource(), ["3"]).category("electronics");

    expect(view.topRated).toEqual([]);
    expect(view.more).toHaveLength(6);
  });

  it("throws NotFoundError for an unknown slug", async () => {
    await expect(new CatalogueService(snapshotSource(), []).category("garden")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("CatalogueService.search", () => {
  it("returns matches best rated first", async () => {
    const results = await new CatalogueService(snapshotSource(), []).search("jacket");
    expect(results.map((p) => p.id)).toEqual(["3", "17", "16", "15"]);
  });
});

describe("CatalogueService.product", () => {
  it("returns the product", async () => {
    const product = await new CatalogueService(snapshotSource(), []).product("3");
    expect(product.title).toBe("Mens Cotton Jacket");
  });

  it("throws NotFoundError for an unknown ID", async () => {
    await expect(new CatalogueService(snapshotSource(), []).product("999")).rejects.toBeInstanceOf(NotFoundError);
  });
});

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
