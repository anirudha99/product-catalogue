import request from "supertest";
import { describe, expect, it } from "vitest";
import { UpstreamError } from "../../src/domain/errors.js";
import { fixture } from "../support/fixtures.js";
import { snapshotSource } from "../support/snapshot.js";
import { testApp } from "../support/testApp.js";

describe("GET /v1/home", () => {
  it("matches the contract fixture exactly", async () => {
    const res = await request(testApp()).get("/v1/home");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fixture("home.json"));
  });

  it("never exposes the upstream image URL", async () => {
    const res = await request(testApp()).get("/v1/home");
    expect(JSON.stringify(res.body)).not.toContain("fakestoreapi.com");
  });

  it("returns 502 in the standard error shape when the source is down and nothing is cached", async () => {
    const productSource = snapshotSource({ load: async () => Promise.reject(new UpstreamError("down")) });

    const res = await request(testApp({ productSource })).get("/v1/home");

    expect(res.status).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual(fixture("error-upstream.json"));
  });
});
