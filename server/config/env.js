import "dotenv/config";
import { readEnvironmentPlans } from "./subscriptionPlans.js";
import { must } from "../utils/errors.js";
export function validateEnvironment() {
  readEnvironmentPlans();
  must(
    process.env.VENUE_MONGO_URI,
    "Configure VENUE_MONGO_URI for the independent venue database",
    500,
  );
  must(
    process.env.VENUE_DB_NAME && /venue/i.test(process.env.VENUE_DB_NAME),
    "VENUE_DB_NAME must explicitly name an independent venue database",
    500,
  );
  must(
    process.env.VENUE_JWT_SECRET?.length >= 32,
    "VENUE_JWT_SECRET must contain at least 32 characters",
    500,
  );
  must(
    process.env.VENUE_OTP_HASH_SECRET?.length >= 32,
    "VENUE_OTP_HASH_SECRET must contain at least 32 characters",
    500,
  );
  must(process.env.VENUE_CORS_ALLOWED_ORIGINS, "Configure VENUE_CORS_ALLOWED_ORIGINS", 500);
  const origins = process.env.VENUE_CORS_ALLOWED_ORIGINS.split(",").map((v) => v.trim());
  must(
    origins.every((origin) => {
      try {
        const u = new URL(origin);
        return (
          ["http:", "https:"].includes(u.protocol) &&
          u.origin === origin &&
          !u.username &&
          !u.password
        );
      } catch {
        return false;
      }
    }),
    "Use exact HTTP(S) origins without paths or wildcards",
    500,
  );
  must(
    !process.env.PUBLIC_VENUE_DOMAIN ||
      /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(process.env.PUBLIC_VENUE_DOMAIN),
    "PUBLIC_VENUE_DOMAIN must be a bare base hostname",
    500,
  );
  must(
    !process.env.VENUE_COOKIE_SAME_SITE ||
      ["lax", "none"].includes(process.env.VENUE_COOKIE_SAME_SITE),
    "VENUE_COOKIE_SAME_SITE must be lax or none",
    500,
  );
  must(
    process.env.VENUE_COOKIE_SAME_SITE !== "none" || process.env.NODE_ENV === "production",
    "SameSite=None requires production Secure cookies and HTTPS",
    500,
  );
  must(
    process.env.VENUE_SUBSCRIPTION_MODE === "required",
    "VENUE_SUBSCRIPTION_MODE must be required; hall payment-first access cannot be disabled",
    500,
  );
  if (process.env.NODE_ENV === "production") {
    must(
      process.env.VENUE_SUBSCRIPTION_MODE === "required",
      "Production requires explicit subscription enforcement",
      500,
    );
    must(
      process.env.VENUE_RESEND_API_KEY && process.env.VENUE_EMAIL_FROM,
      "Configure verified transactional email in production",
      500,
    );
    must(
      process.env.VENUE_JWT_SECRET !== process.env.VENUE_OTP_HASH_SECRET,
      "Use independent JWT and OTP secrets",
      500,
    );
    must(
      process.env.VENUE_CORS_ALLOWED_ORIGINS.split(",").every((v) =>
        v.trim().startsWith("https://"),
      ),
      "Production origins must use HTTPS",
      500,
    );
  }
}
