import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { sendError } from "./errorHandler.js";

/**
 * Limits enquiries per client IP (in memory). Counts every attempt, valid or not.
 * Known limits: behind a load balancer set Express "trust proxy" so req.ip is the client;
 * with more than one API instance, use a shared store (e.g. Redis) so the limit is global.
 */
export function enquiryRateLimit(options: { max: number; windowMs: number }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      // express-rate-limit attaches its state to the request; its type augmentation isn't picked up here.
      const resetTime = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const seconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(seconds));
      sendError(res, 429, "RATE_LIMITED", "Too many enquiries. Please try again later.");
    },
  });
}
