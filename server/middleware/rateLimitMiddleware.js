import { rateLimit, ipKeyGenerator } from "express-rate-limit";

export const rateLimitPolicies = Object.freeze({
  googleLogin: { windowMs: 15 * 60 * 1000, limit: 10 },
  googleSignup: { windowMs: 60 * 60 * 1000, limit: 5 },
  passwordLogin: { windowMs: 15 * 60 * 1000, limit: 10 },
  slugAvailability: { windowMs: 60 * 1000, limit: 30 },
  publicVenue: { windowMs: 60 * 1000, limit: 120 },
  publicServices: { windowMs: 60 * 1000, limit: 120 },
  publicAvailability: { windowMs: 60 * 1000, limit: 30 },
  register: { windowMs: 60 * 60 * 1000, limit: 10 },
  verification: { windowMs: 15 * 60 * 1000, limit: 15 },
  recovery: { windowMs: 15 * 60 * 1000, limit: 10 },
  enquiry: { windowMs: 60 * 60 * 1000, limit: 15 },
  upload: { windowMs: 60 * 1000, limit: 20 },
  general: { windowMs: 60 * 1000, limit: 300 },
});

// Until the Render proxy chain is verified, use only the TCP peer identity.
// Never use CF-Connecting-IP or a client-supplied forwarding header here.
export const configureProxyTrust = (app) => {
  const hops = Number(process.env.VENUE_TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3)
    throw new Error("VENUE_TRUST_PROXY_HOPS must be a verified hop count between 0 and 3");
  app.set("trust proxy", hops || false);
};

export const createApiLimiter = (policy) =>
  rateLimit({
    ...policy,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Group IPv6 addresses by /56 to prevent bypass by rotating host addresses.
    keyGenerator: (req) => ipKeyGenerator(req.ip, 56),
    // Forwarded headers are deliberately ignored with the conservative trust model.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      }),
  });

// Each endpoint has its own MemoryStore; all successes and failures count.
export const apiLimiters = Object.fromEntries(
  Object.entries(rateLimitPolicies).map(([name, policy]) => [name, createApiLimiter(policy)]),
);
