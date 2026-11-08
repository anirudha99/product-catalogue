import request from "supertest";
import { describe, expect, it } from "vitest";
import { fixture } from "../support/fixtures.js";
import { testApp } from "../support/testApp.js";

describe("GET /v1/products/:id", () => {
  it("matches the contract fixture exactly", async () => {
    const res = await request(testApp()).get("/v1/products/3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("product-3.json"));
  });

  it("returns 404 in the standard shape for an unknown product", async () => {
    const res = await request(testApp()).get("/v1/products/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual(fixture("error-not-found.json"));
  });

  it.each(["a.b", "x".repeat(65), "%20"])("returns 400 for a malformed ID %j", async (id) => {
    const res = await request(testApp()).get(`/v1/products/${encodeURIComponent(id)}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: { id: "Product ID is not valid." } });
  });
});
