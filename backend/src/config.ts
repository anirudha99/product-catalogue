import { z } from "zod";

const productIdList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(
    z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "each ID must be 1-64 letters, digits, - or _"))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "each ID may appear only once"),
  );

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PRODUCT_SOURCE: z.enum(["fakestore", "snapshot"]).default("fakestore"),
  FAKESTORE_BASE_URL: z.url().default("https://fakestoreapi.com"),
  SNAPSHOT_PATH: z.string().min(1).default("data/fakestore-snapshot.json"),
  TOP_RATED_PRODUCT_IDS: productIdList.default(["3", "5", "11", "12", "18"]),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(3).default("Catalogue <no-reply@example.test>"),
  SALES_INBOX: z.email().default("sales@example.test"),
  ENQUIRY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  ENQUIRY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
});

export type Config = {
  port: number;
  productSource: "fakestore" | "snapshot";
  fakeStoreBaseUrl: string;
  snapshotPath: string;
  topRatedProductIds: string[];
  cacheTtlMs: number;
  upstreamTimeoutMs: number;
  smtp: { host: string; port: number; secure: boolean; user?: string; pass?: string };
  mailFrom: string;
  salesInbox: string;
  enquiryRateLimit: { max: number; windowMs: number };
  logLevel: "debug" | "info" | "warn" | "error" | "silent";
};

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Reads and checks configuration once at startup. Throws ConfigError listing every bad variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Empty strings (e.g. `SMTP_USER=` in a .env file) mean "not set".
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new ConfigError(`Invalid configuration:\n${problems}`);
  }
  const e = result.data;
  return {
    port: e.PORT,
    productSource: e.PRODUCT_SOURCE,
    fakeStoreBaseUrl: e.FAKESTORE_BASE_URL.replace(/\/+$/, ""),
    snapshotPath: e.SNAPSHOT_PATH,
    topRatedProductIds: e.TOP_RATED_PRODUCT_IDS,
    cacheTtlMs: e.CACHE_TTL_SECONDS * 1000,
    upstreamTimeoutMs: e.UPSTREAM_TIMEOUT_MS,
    smtp: {
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      ...(e.SMTP_USER !== undefined ? { user: e.SMTP_USER } : {}),
      ...(e.SMTP_PASS !== undefined ? { pass: e.SMTP_PASS } : {}),
    },
    mailFrom: e.MAIL_FROM,
    salesInbox: e.SALES_INBOX,
    enquiryRateLimit: { max: e.ENQUIRY_RATE_LIMIT_MAX, windowMs: e.ENQUIRY_RATE_LIMIT_WINDOW_MS },
    logLevel: e.LOG_LEVEL,
  };
}
