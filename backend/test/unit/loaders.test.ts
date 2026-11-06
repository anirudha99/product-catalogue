import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "../../src/domain/errors.js";
import { fetchFromFakeStore, readSnapshot } from "../../src/products/loaders.js";

const fetchReturning = (response: Response) => vi.fn(async () => response);

describe("fetchFromFakeStore", () => {
  it("calls /products once on the configured base URL and returns the JSON", async () => {
    const fetchImpl = fetchReturning(Response.json([{ id: 1 }]));

    const raw = await fetchFromFakeStore("https://store.example.test", 5000, fetchImpl)();

    expect(raw).toEqual([{ id: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://store.example.test/products", expect.anything());
  });

  it("turns a non-2xx status into UpstreamError", async () => {
    const load = fetchFromFakeStore("https://x.test", 5000, fetchReturning(new Response("down", { status: 503 })));
    await expect(load()).rejects.toThrow(new UpstreamError("Fake Store returned HTTP 503"));
  });

  it("turns a body that is not JSON (e.g. an empty 200) into UpstreamError", async () => {
    const load = fetchFromFakeStore("https://x.test", 5000, fetchReturning(new Response("", { status: 200 })));
    await expect(load()).rejects.toBeInstanceOf(UpstreamError);
  });

  it("keeps the network error's code, e.g. a certificate problem behind a proxy", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("self-signed"), { code: "SELF_SIGNED_CERT_IN_CHAIN" }) });
    });
    await expect(fetchFromFakeStore("https://x.test", 5000, fetchImpl)()).rejects.toThrow(
      "Fake Store request failed: fetch failed (SELF_SIGNED_CERT_IN_CHAIN)",
    );
  });

  it("says when the request timed out", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(fetchFromFakeStore("https://x.test", 5000, fetchImpl)()).rejects.toThrow("Fake Store request failed: timed out");
  });
});

describe("readSnapshot", () => {
  it("reads the committed snapshot", async () => {
    const raw = await readSnapshot("data/fakestore-snapshot.json")();
    expect(raw).toHaveLength(20);
  });

  it("turns a missing file into UpstreamError", async () => {
    await expect(readSnapshot("data/missing.json")()).rejects.toBeInstanceOf(UpstreamError);
  });
});
