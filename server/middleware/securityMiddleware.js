import cors from "cors";
import { must } from "../utils/errors.js";
const origins = () =>
  String(process.env.VENUE_CORS_ALLOWED_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export function isPublicOrigin(origin) {
  try {
    const url = new URL(origin),
      base = process.env.PUBLIC_VENUE_DOMAIN?.trim().toLowerCase();
    if (!base || url.protocol !== "https:" || url.port) return false;
    const label = url.hostname.slice(0, -base.length - 1);
    return url.hostname.endsWith(`.${base}`) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label);
  } catch {
    return false;
  }
}
export const corsForRequest = (req, res, next) =>
  cors({
    origin: (origin, cb) =>
      cb(
        null,
        !origin ||
          origins().includes(origin) ||
          (req.path.startsWith("/api/public/") && isPublicOrigin(origin)),
      ),
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Requested-With"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  })(req, res, next);
export function csrfGuard(req, _res, next) {
  try {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      req.path.startsWith("/api/public/") ||
      req.path.startsWith("/api/webhooks/")
    )
      return next();
    const origin = req.get("origin");
    must(
      origin ? origins().includes(origin) : req.get("x-requested-with") === "venue-dashboard",
      "Untrusted request origin",
      403,
    );
    next();
  } catch (error) {
    next(error);
  }
}
export function securityHeaders(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
  if (process.env.NODE_ENV === "production")
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
