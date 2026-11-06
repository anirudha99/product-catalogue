import { z } from "zod";
import type { Enquiry } from "../enquiries/enquiryEmail.js";
import { ValidationError } from "./errorHandler.js";

/** Request validation. Every path param, query and body goes through here; nothing from the app is trusted. */

const productId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export function parseProductId(value: unknown): string {
  const result = productId.safeParse(value);
  if (!result.success) throw new ValidationError({ id: "Product ID is not valid." });
  return result.data;
}

export function parseCategorySlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,50}$/.test(value)) {
    throw new ValidationError({ slug: "Category is not valid." });
  }
  return value;
}

/** ?q= — one value, trimmed, 1–100 characters. Returned trimmed. */
export function parseSearchTerm(value: unknown): string {
  if (Array.isArray(value)) throw new ValidationError({ q: "Use one search term." });
  const term = typeof value === "string" ? value.trim() : "";
  if (term.length === 0) throw new ValidationError({ q: "Enter a search term." });
  if (term.length > 100) throw new ValidationError({ q: "Search term must be 100 characters or fewer." });
  return term;
}

// --- Enquiry body ---------------------------------------------------------

/** Trims strings; an empty optional field counts as "not given". */
const trimmed = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), schema);
const optionalTrimmed = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? undefined : t;
  }, schema.optional());

// No control characters at all in single-line fields (stops header injection via the reply-to name).
const SINGLE_LINE = /^[^\u0000-\u001F\u007F]*$/;
// Messages may contain line breaks and tabs, but no other control characters.
const MULTI_LINE = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;

const enquirySchema = z.strictObject({
  productId: z.string({ error: "Product ID is not valid." }).regex(/^[A-Za-z0-9_-]{1,64}$/, "Product ID is not valid."),
  name: trimmed(
    z
      .string({ error: "Enter your name." })
      .min(1, "Enter your name.")
      .max(100, "Name must be 100 characters or fewer.")
      .regex(SINGLE_LINE, "Name contains characters that aren't allowed."),
  ),
  email: trimmed(
    z
      .string({ error: "Enter a valid email address." })
      .max(254, "Enter a valid email address.")
      .pipe(z.email("Enter a valid email address.")),
  ),
  phone: optionalTrimmed(
    z.string({ error: "Enter a valid phone number." }).regex(/^[0-9 +()-]{1,30}$/, "Enter a valid phone number (digits, spaces, + ( ) -)."),
  ),
  message: optionalTrimmed(
    z
      .string({ error: "Enter a message as text." })
      .max(1000, "Message must be 1000 characters or fewer.")
      .regex(MULTI_LINE, "Message contains characters that aren't allowed."),
  ),
});

export function parseEnquiry(body: unknown): Enquiry {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError({ body: "Request body must be a JSON object." });
  }
  const result = enquirySchema.safeParse(body);
  if (!result.success) throw new ValidationError(fieldMessages(result.error));

  const { productId, name, email, phone, message } = result.data;
  return { productId, name, email, ...(phone ? { phone } : {}), ...(message ? { message } : {}) };
}

/** One message per field (the first problem found), keyed by JSON field name. */
function fieldMessages(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) fields[key] ??= "Unknown field.";
      continue;
    }
    const key = String(issue.path[0] ?? "body");
    fields[key] ??= issue.message;
  }
  return fields;
}
