import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("applies safe local defaults when nothing is set", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.productSource).toBe("fakestore");
    expect(config.topRatedProductIds).toEqual(["3", "5", "11", "12", "18"]);
    expect(config.cacheTtlMs).toBe(300_000);
    expect(config.smtp).toEqual({ host: "localhost", port: 1025, secure: false });
    expect(config.salesInbox).toBe("sales@example.test");
  });

  it("parses the top-rated list, trimming spaces and dropping empty entries", () => {
    const config = loadConfig({ TOP_RATED_PRODUCT_IDS: " 7, 2 ,,9 " });
    expect(config.topRatedProductIds).toEqual(["7", "2", "9"]);
  });

  it("rejects a product chosen twice, so no product appears twice on Home", () => {
    expect(() => loadConfig({ TOP_RATED_PRODUCT_IDS: "3,5,3" })).toThrow(/each ID may appear only once/);
  });

  it("treats empty strings as unset", () => {
    const config = loadConfig({ SMTP_USER: "", PORT: "" });
    expect(config.smtp.user).toBeUndefined();
    expect(config.port).toBe(3000);
  });

  it("fails fast and names every bad variable", () => {
    const bad = () =>
      loadConfig({ PORT: "not-a-port", SALES_INBOX: "nobody", PRODUCT_SOURCE: "database", TOP_RATED_PRODUCT_IDS: "," });

    expect(bad).toThrow(ConfigError);
    expect(bad).toThrow(/PORT/);
    expect(bad).toThrow(/SALES_INBOX/);
    expect(bad).toThrow(/PRODUCT_SOURCE/);
    expect(bad).toThrow(/TOP_RATED_PRODUCT_IDS/);
  });
});
