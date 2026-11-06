import { beforeAll, describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/product.js";
import { matchesTerm } from "../../src/domain/search.js";
import { snapshotSource } from "../support/snapshot.js";

// Expected IDs were worked out independently (Python over the same snapshot), not copied from this code.
describe("matchesTerm", () => {
  let products: Product[];
  beforeAll(async () => {
    products = await snapshotSource().listProducts();
  });
  const ids = (term: string) =>
    products
      .filter((product) => matchesTerm(product, term))
      .map((product) => Number(product.id))
      .sort((a, b) => a - b);

  it("matches at the start of a word, not inside one ('men' is not in 'women' or 'garments')", () => {
    expect(ids("men")).toEqual([1, 2, 3, 4]);
  });

  it("is case-insensitive", () => {
    expect(ids("JACKET")).toEqual([3, 15, 16, 17]);
  });

  it("matches our category name and the upstream spelling", () => {
    expect(ids("jewellery")).toEqual([5, 6, 7, 8]);
    expect(ids("jewelery")).toEqual([5, 6, 7, 8]);
  });

  it("matches terms containing an apostrophe", () => {
    expect(ids("men's")).toEqual([1, 2, 3, 4]);
  });

  it("matches the whole phrase, not each word separately", () => {
    expect(ids("cotton jacket")).toEqual([3]);
  });

  it("trims the term", () => {
    expect(ids("  ssd  ")).toEqual([10, 11]);
  });

  it("treats regex characters literally", () => {
    expect(() => ids("$(")).not.toThrow();
    expect(ids("$(")).toEqual([]);
  });

  it("never matches a blank term", () => {
    expect(ids("   ")).toEqual([]);
  });
});
