import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { fixture } from "../support/fixtures.js";
import { testApp } from "../support/testApp.js";

describe("GET /v1/categories/:slug", () => {
  it("matches the contract fixture: chosen top-rated first, the rest by rating", async () => {
    const res = await request(testApp()).get("/v1/categories/electronics");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("category-electronics.json"));
  });

  it("returns an empty topRated list when none of the chosen products are in the category", async () => {
    const app = testApp({ config: loadConfig({ TOP_RATED_PRODUCT_IDS: "3,5,18" }) });

    const res = await request(app).get("/v1/categories/electronics");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("category-no-picks.json"));
  });

  it("works for the slug that fixes the upstream spelling", async () => {
    const res = await request(testApp()).get("/v1/categories/jewellery");
    expect(res.body.category).toEqual({ slug: "jewellery", name: "Jewellery" });
    expect(res.body.topRated.map((p: { id: string }) => p.id)).toEqual(["5"]);
  });

  it("returns 404 for an unknown category", async () => {
    const res = await request(testApp()).get("/v1/categories/garden");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Category not found." });
  });

  it("returns 400 for a malformed slug", async () => {
    const res = await request(testApp()).get("/v1/categories/Men's%20Clothing");

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ slug: "Category is not valid." });
  });
});
