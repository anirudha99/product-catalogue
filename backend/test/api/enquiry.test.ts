import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { FakeMailer } from "../fakes/FakeMailer.js";
import { fixture } from "../support/fixtures.js";
import { testApp } from "../support/testApp.js";

const valid = {
  productId: "3",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+44 20 7946 0000",
  message: "Do you ship to India?",
};

function appWithMailer(env: Record<string, string> = {}) {
  const mailer = new FakeMailer();
  const app = testApp({ mailer, config: loadConfig(env) });
  return { mailer, app };
}

const post = (app: ReturnType<typeof testApp>, body: unknown) => request(app).post("/v1/enquiries").send(body as object);

describe("POST /v1/enquiries", () => {
  it("accepts a valid enquiry with 202, matches the contract, and emails sales once", async () => {
    const { app, mailer } = appWithMailer();

    const res = await post(app, valid);

    expect(res.status).toBe(202);
    expect(res.body).toEqual(fixture("enquiry-accepted.json"));
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe("sales@example.test");
  });

  it("trims fields and treats empty optional fields as not given", async () => {
    const { app, mailer } = appWithMailer();

    await post(app, { productId: "3", name: "  Ada  ", email: " ada@example.com ", phone: "  ", message: "" });

    expect(mailer.sent[0]!.replyTo).toEqual({ name: "Ada", address: "ada@example.com" });
    expect(mailer.sent[0]!.text).toContain("Phone:     not given");
  });

  it("returns the contract's validation error for a missing name and a bad email", async () => {
    const { app, mailer } = appWithMailer();

    const res = await post(app, { productId: "3", email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(fixture("error-validation.json"));
    expect(mailer.sent).toHaveLength(0);
  });

  it.each([
    ["a blank name", { name: "   " }, "name", "Enter your name."],
    ["a name over 100 characters", { name: "a".repeat(101) }, "name", "Name must be 100 characters or fewer."],
    ["a line break in the name (header injection)", { name: "Ada\r\nBcc: x@evil.test" }, "name", "Name contains characters that aren't allowed."],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@x.io` }, "email", "Enter a valid email address."],
    ["letters in the phone", { phone: "call me" }, "phone", "Enter a valid phone number (digits, spaces, + ( ) -)."],
    ["a message over 1000 characters", { message: "m".repeat(1001) }, "message", "Message must be 1000 characters or fewer."],
    ["a non-string message", { message: 42 }, "message", "Enter a message as text."],
    ["a malformed product ID", { productId: "../3" }, "productId", "Product ID is not valid."],
    ["an unknown field", { price: 0.01 }, "price", "Unknown field."],
  ])("rejects %s with a message on that field", async (_case, change, field, message) => {
    const { app, mailer } = appWithMailer();

    const res = await post(app, { ...valid, ...change });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields[field]).toBe(message);
    expect(mailer.sent).toHaveLength(0);
  });

  it("accepts line breaks in the message", async () => {
    const { app } = appWithMailer();
    const res = await post(app, { ...valid, message: "Line one\nLine two" });
    expect(res.status).toBe(202);
  });

  it("rejects a body that is not a JSON object", async () => {
    const { app } = appWithMailer();
    const res = await request(app).post("/v1/enquiries").set("Content-Type", "application/json").send("[1,2]");
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ body: "Request body must be a JSON object." });
  });

  it("returns 404 for a product that doesn't exist", async () => {
    const { app, mailer } = appWithMailer();

    const res = await post(app, { ...valid, productId: "999" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(fixture("error-not-found.json"));
    expect(mailer.sent).toHaveLength(0);
  });

  it("returns 413 for a body over 10 KB", async () => {
    const { app } = appWithMailer();
    const res = await post(app, { ...valid, message: "m".repeat(11 * 1024) });
    expect(res.status).toBe(413);
  });

  it("returns 502 EMAIL_FAILED when the mail server is down, so the app does not say thank you", async () => {
    const { app, mailer } = appWithMailer();
    mailer.failWith = new Error("ECONNREFUSED");

    const res = await post(app, valid);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: "EMAIL_FAILED", message: "We couldn't send your enquiry. Please try again." });
  });

  it("rate-limits per client: the contract's 429 with Retry-After once the limit is hit", async () => {
    const { app, mailer } = appWithMailer({ ENQUIRY_RATE_LIMIT_MAX: "2", ENQUIRY_RATE_LIMIT_WINDOW_MS: "60000" });

    expect((await post(app, valid)).status).toBe(202);
    expect((await post(app, { ...valid, email: "bad" })).status).toBe(400); // invalid attempts count too
    const limited = await post(app, valid);

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual(fixture("error-rate-limited.json"));
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(mailer.sent).toHaveLength(1);
  });

  it("does not rate-limit browsing", async () => {
    const { app } = appWithMailer({ ENQUIRY_RATE_LIMIT_MAX: "1" });
    await post(app, valid);
    await post(app, valid);
    expect((await request(app).get("/v1/home")).status).toBe(200);
  });
});
