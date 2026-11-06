import request from "supertest";
import { describe, expect, it } from "vitest";
import { FIXED_ID, testApp } from "../support/testApp.js";

describe("GET /health", () => {
  it("returns ok with a request ID header", async () => {
    const res = await request(testApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["x-request-id"]).toBe(FIXED_ID);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("unknown routes", () => {
  it("return the standard error shape", async () => {
    const res = await request(testApp()).get("/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found.", requestId: FIXED_ID } });
  });
});

describe("request bodies", () => {
  it("rejects bodies over 10 KB with 413", async () => {
    const res = await request(testApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ blob: "x".repeat(11 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers other unreadable bodies (e.g. an unsupported encoding) with 400, not 500", async () => {
    const res = await request(testApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "made-up")
      .send("{}");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", message: "Request body could not be read." });
  });

  it("rejects malformed JSON with 400 and no stack trace", async () => {
    const res = await request(testApp()).post("/health").set("Content-Type", "application/json").send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });
});
