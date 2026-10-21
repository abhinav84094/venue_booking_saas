import express from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import { venueRoutes, adminRoutes } from "./routes/venueRoutes.js";
import publicRoutes from "./routes/publicVenueRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";
import { handleSubscriptionWebhook } from "./controllers/subscriptionWebhookController.js";
import { configureProxyTrust, apiLimiters } from "./middleware/rateLimitMiddleware.js";
import { corsForRequest, csrfGuard, securityHeaders } from "./middleware/securityMiddleware.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  configureProxyTrust(app);
  app.use(securityHeaders, corsForRequest);
  app.post(
    "/api/webhooks/subscriptions/razorpay",
    express.raw({ type: "application/json", limit: "256kb" }),
    handleSubscriptionWebhook,
  );
  app.use(express.json({ limit: "256kb" }), cookieParser(), csrfGuard);
  app.use("/api", apiLimiters.general);
  app.get("/api/health", (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      success: mongoose.connection.readyState === 1,
      product: "Prakash SaaS",
      service: "Venue Booking API",
      database: mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    }),
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/venues", venueRoutes);
  app.use("/api/public/venues", publicRoutes);
  app.use("/api/public/seo", seoRoutes);
  app.use("/api/admin", adminRoutes);
  return app;
}
export function attachErrorHandlers(app) {
  app.use("/api", (_req, res) =>
    res.status(404).json({ success: false, message: "API endpoint not found" }),
  );
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError)
      return res.status(400).json({
        success: false,
        message: "Check the highlighted fields",
        errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    let status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
    if (err.code === 11000)
      return res.status(409).json({
        success: false,
        message: "This identifier is already in use. Refresh and try again.",
      });
    if (["CastError", "ValidationError", "StrictModeError"].includes(err.name)) status = 400;
    if (err.type === "entity.parse.failed") status = 400;
    if (err.type === "entity.too.large") status = 413;
    if (status < 400 || status > 599) status = 500;
    const imageError = [
      "IMAGE_STORAGE_CONFIGURATION",
      "IMAGE_STORAGE_PERMISSIONS",
      "IMAGE_STORAGE_TIMEOUT",
      "IMAGE_STORAGE_UNAVAILABLE",
    ].includes(err.code);
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: "api_error",
          type: err.name || "Error",
          status,
          ...(imageError ? { code: err.code, providerStatus: err.providerStatus } : {}),
        }),
      );
    res.status(status).json({
      success: false,
      ...(imageError ? { code: err.code } : {}),
      message:
        status >= 500
          ? status === 503
            ? err.message
            : status === 501
              ? err.message
              : "Service unavailable. Please try again or contact support."
          : status === 401 &&
              ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err.name)
            ? "Invalid or expired session"
            : err.message || "Invalid request",
    });
  });
  return app;
}
