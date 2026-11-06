/** Errors the services raise. The HTTP layer maps each one to a status code and an error code. */

export class NotFoundError extends Error {
  override name = "NotFoundError";
}

/** The product source (or an upstream image) failed and there is nothing cached to fall back on. */
export class UpstreamError extends Error {
  override name = "UpstreamError";
}

/** The mailer could not send the enquiry email. */
export class EmailError extends Error {
  override name = "EmailError";
}
