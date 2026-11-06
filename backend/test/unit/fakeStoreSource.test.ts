import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "../../src/domain/errors.js";
import { snapshotRaw, snapshotSource } from "../support/snapshot.js";

const rawProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 99,
  title: "Thing",
  price: 1.5,
  description: "A thing",
  category: "electronics",
  image: "https://img.example.test/99.png",
  rating: { rate: 4, count: 10 },
  ...overrides,
});

describe("FakeStoreProductSource mapping", () => {
  it("maps upstream products to our model", async () => {
    const product = await snapshotSource().getProduct("3");

    expect(product).toEqual({
      id: "3",
      title: "Mens Cotton Jacket",
      description: expect.stringContaining("great outerwear jackets"),
      category: { slug: "mens-clothing", name: "Men's Clothing", sourceName: "men's clothing" },
      price: { amountMinor: 5599, currency: "USD" },
      imageUrl: "https://fakestoreapi.com/img/71li-ujtlUL._AC_UX679_t.png",
      rating: { average: 4.7, count: 500 },
    });
  });

  it("fixes the upstream 'jewelery' spelling in slug and name", async () => {
    const product = await snapshotSource().getProduct("5");
    expect(product?.category).toEqual({ slug: "jewellery", name: "Jewellery", sourceName: "jewelery" });
  });

  it("derives slug and name for an unknown category", async () => {
    const source = snapshotSource({ load: async () => [rawProduct({ category: "home & garden's best" })] });
    const product = await source.getProduct("99");
    expect(product?.category).toEqual({ slug: "home-gardens-best", name: "Home & Garden's Best", sourceName: "home & garden's best" });
  });

  it("rounds prices to whole cents", async () => {
    const source = snapshotSource({ load: async () => [rawProduct({ price: 0.29 })] }); // 0.29 * 100 = 28.999…
    expect((await source.getProduct("99"))?.price.amountMinor).toBe(29);
  });

  it("returns null for an unknown ID", async () => {
    expect(await snapshotSource().getProduct("999")).toBeNull();
  });

  it("lists categories once each, sorted by name", async () => {
    const categories = await snapshotSource().listCategories();
    expect(categories.map((category) => category.slug)).toEqual(["electronics", "jewellery", "mens-clothing", "womens-clothing"]);
  });

  it("filters by category and text together", async () => {
    const products = await snapshotSource().listProducts({ categorySlug: "womens-clothing", text: "jacket" });
    expect(products.map((product) => product.id).sort()).toEqual(["15", "16", "17"]);
  });
});

describe("FakeStoreProductSource upstream checks", () => {
  it("rejects a response that is not a list", async () => {
    const source = snapshotSource({ load: async () => ({ message: "nope" }) });
    await expect(source.listProducts()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("skips invalid records but keeps the valid ones", async () => {
    const source = snapshotSource({ load: async () => [rawProduct(), rawProduct({ id: "not-a-number" }), { junk: true }] });
    expect((await source.listProducts()).map((product) => product.id)).toEqual(["99"]);
  });

  it("fails when every record is invalid", async () => {
    const source = snapshotSource({ load: async () => [{ junk: true }] });
    await expect(source.listProducts()).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("FakeStoreProductSource cache", () => {
  it("shares one upstream call between concurrent cold requests", async () => {
    const load = vi.fn(async () => snapshotRaw());
    const source = snapshotSource({ load });

    await Promise.all([source.listProducts(), source.getProduct("1"), source.listCategories()]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the TTL", async () => {
    let now = 0;
    const load = vi.fn(async () => snapshotRaw());
    const source = snapshotSource({ load, ttlMs: 1000, now: () => now });

    await source.listProducts();
    now = 999;
    await source.listProducts();
    expect(load).toHaveBeenCalledTimes(1);

    now = 1000;
    await source.listProducts();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("serves the old list when a refresh fails, and waits 30s before retrying", async () => {
    let now = 0;
    let upstreamUp = true;
    const load = vi.fn(async () => {
      if (!upstreamUp) throw new UpstreamError("down");
      return snapshotRaw();
    });
    const source = snapshotSource({ load, ttlMs: 1000, now: () => now });

    await source.listProducts();
    upstreamUp = false;
    now = 5000;
    expect(await source.listProducts()).toHaveLength(20);
    expect(load).toHaveBeenCalledTimes(2);

    now = 5000 + 29_999;
    await source.listProducts();
    expect(load).toHaveBeenCalledTimes(2);

    now = 5000 + 30_000;
    await source.listProducts();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("fails with UpstreamError when there is no cached copy", async () => {
    const source = snapshotSource({ load: async () => Promise.reject(new Error("ECONNRESET")) });
    await expect(source.listProducts()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("tries upstream again on the next request after a cold failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new UpstreamError("down")).mockResolvedValueOnce(snapshotRaw());
    const source = snapshotSource({ load });

    await expect(source.listProducts()).rejects.toBeInstanceOf(UpstreamError);
    expect(await source.listProducts()).toHaveLength(20);
  });
});
