import request from "supertest";
import { describe, expect, it } from "vitest";
import { fixture } from "../support/fixtures.js";
import { testApp } from "../support/testApp.js";

describe("GET /v1/search", () => {
  it("matches the contract fixture", async () => {
    const res = await request(testApp()).get("/v1/search").query({ q: "jacket" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("search-jacket.json"));
  });

  it("returns 200 with an empty list when nothing matches", async () => {
    const res = await request(testApp()).get("/v1/search").query({ q: "submarine" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("search-no-results.json"));
  });

  it("only returns products whose text matches (not 'women' for 'men')", async () => {
    const res = await request(testApp()).get("/v1/search").query({ q: "men" });
    expect(res.body.results.map((p: { id: string }) => p.id).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("trims the term and echoes it back trimmed", async () => {
    const res = await request(testApp()).get("/v1/search").query({ q: "  Jacket  " });
    expect(res.body.term).toBe("Jacket");
    expect(res.body.results).toHaveLength(4);
  });

  it.each([
    ["missing", {}, "Enter a search term."],
    ["blank", { q: "   " }, "Enter a search term."],
    ["over 100 characters", { q: "x".repeat(101) }, "Search term must be 100 characters or fewer."],
  ])("returns 400 when the term is %s", async (_case, query, message) => {
    const res = await request(testApp()).get("/v1/search").query(query);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: { q: message } });
  });

  it("returns 400 when q is given twice", async () => {
    const res = await request(testApp()).get("/v1/search?q=a&q=b");
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ q: "Use one search term." });
  });

  it("treats regex characters literally", async () => {
    const res = await request(testApp()).get("/v1/search").query({ q: ".*" });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
