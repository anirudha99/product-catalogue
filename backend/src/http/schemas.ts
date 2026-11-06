import { z } from "zod";
import { ValidationError } from "./errorHandler.js";

/** Request validation. Every path param, query and body goes through here; nothing from the app is trusted. */

const productId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export function parseProductId(value: unknown): string {
  const result = productId.safeParse(value);
  if (!result.success) throw new ValidationError({ id: "Product ID is not valid." });
  return result.data;
}
