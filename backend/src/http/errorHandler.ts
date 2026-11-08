import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { EmailError, NotFoundError, UpstreamError } from "../domain/errors.js";
import type { Logger } from "../log.js";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "EMAIL_FAILED"
  | "INTERNAL";

/** Thrown by request validation; carries one message per bad field, keyed by JSON name. */
export class ValidationError extends Error {
  override name = "ValidationError";
  constructor(readonly fields: Record<string, string>) {
    super("Some fields need attention.");
  }
}

/** Writes the one error shape every non-2xx response uses. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
): void {
  // Errors are never cacheable: a failed image or a 502 must not stick in the app's URL cache.
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({
    error: {
      code,
      message,
      ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
      requestId: res.locals.requestId as string,
    },
  });
}

export const notFoundRoute: RequestHandler = (_req, res) => {
  sendError(res, 404, "NOT_FOUND", "Not found.");
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    const requestId = res.locals.requestId as string;

    if (err instanceof ValidationError) {
      return sendError(res, 400, "VALIDATION_FAILED", err.message, err.fields);
    }
    if (err instanceof NotFoundError) {
      return sendError(res, 404, "NOT_FOUND", err.message);
    }
    if (err instanceof UpstreamError) {
      logger.warn("upstream unavailable", { requestId, reason: err.message });
      return sendError(res, 502, "UPSTREAM_UNAVAILABLE", "Products are unavailable right now. Please try again.");
    }
    if (err instanceof EmailError) {
      logger.error("email failed", { requestId, reason: err.message });
      return sendError(res, 502, "EMAIL_FAILED", "We couldn't send your enquiry. Please try again.");
    }
    // Errors raised by express.json(): body too large, or not valid JSON.
    if (isHttpError(err) && err.type === "entity.too.large") {
      return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    }
    if (isHttpError(err) && err.type === "entity.parse.failed") {
      return sendError(res, 400, "VALIDATION_FAILED", "Request body must be valid JSON.");
    }
    // Any other client-side body problem (unsupported encoding or charset, aborted upload, …) is the client's error, not a 500.
    if (isHttpError(err) && err.status >= 400 && err.status < 500) {
      return sendError(res, 400, "VALIDATION_FAILED", "Request body could not be read.");
    }

    logger.error("unhandled error", { requestId, error: err instanceof Error ? err.stack : String(err) });
    return sendError(res, 500, "INTERNAL", "Something went wrong. Please try again.");
  };
}

function isHttpError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { type?: unknown }).type === "string" &&
    typeof (err as { status?: unknown }).status === "number"
  );
}
