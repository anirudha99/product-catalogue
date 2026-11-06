import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { fixture } from "../support/fixtures.js";
import { testApp } from "../support/testApp.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PRODUCT_3_IMAGE = "https://fakestoreapi.com/img/71li-ujtlUL._AC_UX679_t.png";

function fakeFetch(response: () => Response) {
  return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => response());
}

const binary = (res: request.Response, callback: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

describe("GET /v1/products/:id/image", () => {
  it("passes the image through with its content type and a cache header", async () => {
    const fetchImpl = fakeFetch(() => new Response(PNG, { headers: { "content-type": "image/png" } }));

    const res = await request(testApp({ fetchImpl })).get("/v1/products/3/image").buffer(true).parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
  });

  it("only ever fetches the URL stored on the product", async () => {
    const fetchImpl = fakeFetch(() => new Response(PNG, { headers: { "content-type": "image/png" } }));

    await request(testApp({ fetchImpl })).get("/v1/products/3/image?url=https://evil.example/");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(PRODUCT_3_IMAGE);
  });

  it("returns 404 for an unknown product without fetching anything", async () => {
    const fetchImpl = fakeFetch(() => new Response(PNG));

    const res = await request(testApp({ fetchImpl })).get("/v1/products/999/image");

    expect(res.status).toBe(404);
    expect(res.body).toEqual(fixture("error-not-found.json"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed product ID", async () => {
    const res = await request(testApp()).get("/v1/products/..%2F..%2Fetc/image");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it.each([
    ["the image host returns 404 HTML", () => new Response("<h1>Not found</h1>", { status: 404, headers: { "content-type": "text/html" } })],
    ["the image host returns 200 but not an image", () => new Response("<html>", { headers: { "content-type": "text/html" } })],
    ["the image is an SVG (it can carry script)", () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })],
    ["the declared size is over 5 MB", () => new Response(PNG, { headers: { "content-type": "image/png", "content-length": String(6 * 1024 * 1024) } })],
    ["the streamed size is over 5 MB", () => new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } })],
  ])("returns 502 with no-store when %s", async (_case, response) => {
    const res = await request(testApp({ fetchImpl: fakeFetch(response) })).get("/v1/products/3/image");

    expect(res.status).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("returns 502 when the image request fails outright", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const res = await request(testApp({ fetchImpl })).get("/v1/products/3/image");
    expect(res.status).toBe(502);
  });
});
