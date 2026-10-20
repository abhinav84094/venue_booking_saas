import test from "node:test";
import assert from "node:assert/strict";
import { validateEnvironment } from "../config/env.js";
import { sendTransactionalEmail } from "../services/emailService.js";

const productionEnvironment = {
  NODE_ENV: "production",
  VENUE_MONGO_URI: "mongodb://127.0.0.1:27017/venue_environment_tests",
  VENUE_DB_NAME: "venue_environment_tests",
  VENUE_JWT_SECRET: "environment-tests-only-secret-at-least-32-characters",
  VENUE_GOOGLE_CLIENT_ID: "environment-test-google-client",
  VENUE_CORS_ALLOWED_ORIGINS: "https://venue.example.com",
  VENUE_SUBSCRIPTION_MODE: "required",
};
const environmentKeys = [
  ...Object.keys(productionEnvironment),
  "VENUE_RESEND_API_KEY",
  "VENUE_EMAIL_FROM",
  "VENUE_COOKIE_SAME_SITE",
  "PUBLIC_VENUE_DOMAIN",
  "VENUE_PLAN_3_MONTHS_PRICE",
  "VENUE_PLAN_1_YEAR_PRICE",
];

async function withEnvironment(overrides, run) {
  const original = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of environmentKeys) delete process.env[key];
    for (const [key, value] of Object.entries({ ...productionEnvironment, ...overrides })) {
      if (value !== undefined) process.env[key] = value;
    }
    return await run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("production startup permits absent or incomplete optional transactional email configuration", async () => {
  for (const overrides of [
    {},
    { VENUE_RESEND_API_KEY: "test-resend-api-key" },
    { VENUE_EMAIL_FROM: "Venue <notifications@example.com>" },
  ]) {
    await withEnvironment(overrides, () => assert.doesNotThrow(validateEnvironment));
  }
});

test("production startup still requires a strong application secret and Google client ID", async () => {
  for (const [overrides, expected] of [
    [{ VENUE_JWT_SECRET: undefined }, /VENUE_JWT_SECRET/],
    [{ VENUE_JWT_SECRET: "too-short" }, /VENUE_JWT_SECRET/],
    [{ VENUE_GOOGLE_CLIENT_ID: undefined }, /VENUE_GOOGLE_CLIENT_ID/],
  ]) {
    await withEnvironment(overrides, () => assert.throws(validateEnvironment, expected));
  }
});

test("production startup still requires an explicitly independent venue database", async () => {
  for (const [overrides, expected] of [
    [{ VENUE_MONGO_URI: undefined }, /VENUE_MONGO_URI/],
    [{ VENUE_DB_NAME: undefined }, /independent venue database/],
    [{ VENUE_DB_NAME: "clinic" }, /independent venue database/],
  ]) {
    await withEnvironment(overrides, () => assert.throws(validateEnvironment, expected));
  }
});

test("production startup still enforces exact HTTPS CORS origins", async () => {
  for (const [value, expected] of [
    [undefined, /VENUE_CORS_ALLOWED_ORIGINS/],
    ["*", /exact HTTP\(S\) origins/],
    ["https://venue.example.com/login", /exact HTTP\(S\) origins/],
    ["http://venue.example.com", /Production origins must use HTTPS/],
    ["https://venue.example.com,http://other.example.com", /Production origins must use HTTPS/],
  ]) {
    await withEnvironment({ VENUE_CORS_ALLOWED_ORIGINS: value }, () =>
      assert.throws(validateEnvironment, expected),
    );
  }
});

test("production startup still rejects disabled or unspecified payment-first access", async () => {
  for (const value of [undefined, "", "optional", "disabled"]) {
    await withEnvironment({ VENUE_SUBSCRIPTION_MODE: value }, () =>
      assert.throws(validateEnvironment, /hall payment-first access cannot be disabled/),
    );
  }
});

test("sending transactional email without complete configuration returns 503 without a network call", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected email network request");
  });
  for (const overrides of [
    {},
    { VENUE_RESEND_API_KEY: "test-resend-api-key" },
    { VENUE_EMAIL_FROM: "Venue <notifications@example.com>" },
  ]) {
    await withEnvironment(overrides, () =>
      assert.rejects(
        sendTransactionalEmail({
          to: "owner@example.com",
          subject: "Booking confirmation",
          text: "Your booking is confirmed.",
        }),
        { statusCode: 503, message: /Transactional email is not configured/ },
      ),
    );
  }
  assert.equal(network.mock.callCount(), 0);
});
