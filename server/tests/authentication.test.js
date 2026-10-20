import { test, before, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import GoogleAuthorization from "../models/GoogleAuthorization.js";
import { initializeIndexes } from "../models/venueModels.js";
import { createApp, attachErrorHandlers } from "../app.js";
import { apiLimiters, rateLimitPolicies } from "../middleware/rateLimitMiddleware.js";
import generateToken from "../utils/generateToken.js";
import { sendTransactionalEmail } from "../services/emailService.js";
import { Resend } from "resend";

process.env.NODE_ENV = "test";
process.env.VENUE_JWT_SECRET = "authentication-tests-only-secret-32-characters";
process.env.VENUE_GOOGLE_CLIENT_ID = "authentication-test-client";
process.env.VENUE_CORS_ALLOWED_ORIGINS = "http://localhost:5173";
process.env.VENUE_SUBSCRIPTION_MODE = "required";
let repl, server, url;
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const outsiderKey = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const identity = (id) => ({ sub: id, email: id + "@gmail.com", name: "Google Owner" });
const passwords = {
  password: "ApplicationPassword123!",
  confirmPassword: "ApplicationPassword123!",
};
const session = (user) => "venueAccessToken=" + generateToken(user._id, user.tokenVersion);
const cookie = (response, name) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(name + "="))
    ?.split(";")[0];
const tokenHash = (header) =>
  crypto.createHash("sha256").update(header.split("=")[1]).digest("hex");
async function request(method, path, body, auth) {
  const response = await fetch(url + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "venue-dashboard",
      ...(auth ? { Cookie: auth } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function credential(nonce, account, overrides = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      ...account,
      iss: "https://accounts.google.com",
      aud: process.env.VENUE_GOOGLE_CLIENT_ID,
      email_verified: true,
      nonce,
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    key,
    { algorithm: "RS256", keyid: "test-certificate" },
  );
}
async function challenge(purpose) {
  const result = await request("POST", "/auth/google/challenge", { purpose });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return { nonce: result.data.nonce, cookie: cookie(result, "venueGoogleChallenge") };
}
async function google(purpose, account, overrides) {
  const start = await challenge(purpose);
  const result = await request(
    "POST",
    "/auth/google",
    {
      credential: credential(start.nonce, account, overrides),
    },
    start.cookie,
  );
  return { ...result, setupCookie: cookie(result, "venueGoogleSetup") };
}
async function signup(id) {
  const account = identity(id);
  const verified = await google("register", account);
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  const completed = await request(
    "POST",
    "/auth/google/password-setup",
    passwords,
    verified.setupCookie,
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  return { account, completed, user: await User.findById(completed.data.user.id) };
}
before(async () => {
  // Only certificate retrieval is replaced. The real Google SDK verifies RSA
  // signatures, audience, issuer and time claims for every signed test token.
  mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => ({
    certs: { "test-certificate": publicKey.export({ type: "spki", format: "pem" }) },
    format: "PEM",
  }));
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "venue_authentication_tests" });
  await Promise.all([User.init(), GoogleAuthorization.init(), initializeIndexes()]);
  server = attachErrorHandlers(createApp()).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = "http://127.0.0.1:" + server.address().port;
});
beforeEach(() => {
  for (const limiter of Object.values(apiLimiters)) limiter.resetKey("127.0.0.1");
});
after(async () => {
  mock.restoreAll();
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  await mongoose.disconnect();
  await repl?.stop();
});

test("Google registration creates no account/session until password setup, then supports both logins", async () => {
  const account = identity("new-owner");
  const verified = await google("register", account);
  assert.equal(verified.status, 200);
  assert.equal(verified.data.purpose, "register");
  assert.equal(verified.data.user, undefined);
  assert.equal(await User.countDocuments({ email: account.email }), 0);
  assert.equal(cookie(verified, "venueAccessToken"), undefined);
  assert.match(
    verified.headers.getSetCookie().join(" "),
    /venueGoogleSetup=.*Max-Age=300.*HttpOnly.*SameSite=Lax/i,
  );
  assert.equal(verified.data.setupToken, undefined);
  const authorization = await GoogleAuthorization.findOne({
    tokenHash: tokenHash(verified.setupCookie),
  });
  assert.ok(authorization);
  assert.notEqual(authorization.tokenHash, verified.setupCookie.split("=")[1]);
  assert.equal((await request("GET", "/venues", undefined, verified.setupCookie)).status, 401);
  const completed = await request(
    "POST",
    "/auth/google/password-setup",
    passwords,
    verified.setupCookie,
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  const stored = await User.findById(completed.data.user.id).select("+password");
  assert.match(stored.password, /^\$2[aby]\$12\$/);
  assert.ok(await stored.comparePassword(passwords.password));
  assert.equal(stored.googleId, account.sub);
  assert.equal(stored.emailVerified, true);
  assert.equal(stored.role, "owner");
  assert.equal(completed.data.user.password, undefined);
  assert.equal(completed.data.user.googleId, undefined);
  assert.match(completed.headers.getSetCookie().join(" "), /venueAccessToken=.*HttpOnly/i);
  const passwordLogin = await request("POST", "/auth/login", {
    email: account.email,
    password: passwords.password,
  });
  assert.equal(passwordLogin.status, 200);
  assert.equal(
    (await request("POST", "/auth/login", { email: account.email, password: "wrong" })).status,
    401,
  );
  const googleLogin = await google("login", account);
  assert.equal(googleLogin.status, 200);
  assert.equal(googleLogin.data.user.id, String(stored._id));
  assert.equal((await User.findById(stored._id)).password, undefined);
});

test("linked Google recovery resets the password and invalidates all sessions and pending setups", async () => {
  const { account, user, completed } = await signup("recover-owner");
  const oldCookie = cookie(completed, "venueAccessToken");
  const first = await google("recover", account);
  const second = await google("recover", account);
  assert.equal(first.data.purpose, "recover");
  assert.equal((await request("GET", "/auth/me", undefined, oldCookie)).status, 200);
  const changed = { password: "ChangedPassword123!", confirmPassword: "ChangedPassword123!" };
  const reset = await request("POST", "/auth/google/password-setup", changed, first.setupCookie);
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.equal(reset.data.user, undefined);
  assert.equal((await request("GET", "/auth/me", undefined, oldCookie)).status, 401);
  assert.equal(
    (await request("POST", "/auth/google/password-setup", changed, first.setupCookie)).status,
    401,
  );
  assert.equal(
    (await request("POST", "/auth/google/password-setup", changed, second.setupCookie)).status,
    401,
  );
  assert.equal(
    (await request("POST", "/auth/login", { email: account.email, password: passwords.password }))
      .status,
    401,
  );
  assert.equal(
    (await request("POST", "/auth/login", { email: account.email, password: changed.password }))
      .status,
    200,
  );
  assert.equal((await User.findById(user._id)).tokenVersion, 1);
});

test("another Google subject cannot reset or select a victim, even with the same email", async () => {
  const { account, user } = await signup("victim");
  const stranger = await google("recover", { ...account, sub: "different-google-subject" });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.setupCookie, undefined);
  const unknown = await google("recover", identity("no-account"));
  assert.equal(unknown.status, 403);
  assert.equal(await User.countDocuments({ email: "no-account@gmail.com" }), 0);
  const own = await signup("attacker");
  const reset = await google("recover", own.account);
  assert.equal(
    (
      await request(
        "POST",
        "/auth/google/password-setup",
        {
          ...passwords,
          userId: String(user._id),
          email: account.email,
        },
        reset.setupCookie,
      )
    ).status,
    400,
  );
  const changed = { password: "OwnPasswordChanged123!", confirmPassword: "OwnPasswordChanged123!" };
  assert.equal(
    (await request("POST", "/auth/google/password-setup", changed, reset.setupCookie)).status,
    200,
  );
  assert.ok(
    await (await User.findById(user._id).select("+password")).comparePassword(passwords.password),
  );
});

test("expired, missing, tampered and concurrently reused setup authorizations are rejected", async () => {
  const expired = await google("register", identity("expired"));
  await GoogleAuthorization.updateOne(
    { tokenHash: tokenHash(expired.setupCookie) },
    {
      $set: { expiresAt: new Date(Date.now() - 1000) },
    },
  );
  assert.equal(
    (await request("GET", "/auth/google/password-setup", undefined, expired.setupCookie)).status,
    401,
  );
  assert.equal(
    (await request("POST", "/auth/google/password-setup", passwords, expired.setupCookie)).status,
    401,
  );
  assert.equal(await User.countDocuments({ email: "expired@gmail.com" }), 0);
  assert.equal((await request("POST", "/auth/google/password-setup", passwords)).status, 401);
  assert.equal(
    (
      await request(
        "POST",
        "/auth/google/password-setup",
        passwords,
        "venueGoogleSetup=" + "a".repeat(64),
      )
    ).status,
    401,
  );
  const valid = await google("register", identity("concurrent"));
  const results = await Promise.all(
    [1, 2].map(() => request("POST", "/auth/google/password-setup", passwords, valid.setupCookie)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  assert.equal(await User.countDocuments({ email: "concurrent@gmail.com" }), 1);
});

test("Google signature, audience, issuer, strict expiration, verified email, freshness and nonce are enforced", async () => {
  for (const [overrides, signingKey] of [
    [{}, outsiderKey],
    [{ aud: "another-client" }],
    [{ iss: "https://attacker.test" }],
    [{ exp: Math.floor(Date.now() / 1000) - 1 }],
    [{ email_verified: false }],
    [{ email_verified: "true" }],
    [{ nonce: "different-nonce" }],
    [{ iat: Math.floor(Date.now() / 1000) - 600 }],
  ]) {
    const start = await challenge("register");
    const response = await request(
      "POST",
      "/auth/google",
      {
        credential: credential(start.nonce, identity("invalid"), overrides, signingKey),
      },
      start.cookie,
    );
    assert.equal(response.status, 401, JSON.stringify({ overrides, response: response.data }));
  }
  assert.equal(await User.countDocuments({ email: "invalid@gmail.com" }), 0);
});

test("missing Google challenge cookies report a recoverable session error without consuming authorization", async () => {
  const account = identity("missing-challenge-cookie");
  const start = await challenge("register");
  const body = { credential: credential(start.nonce, account) };
  const missing = await request("POST", "/auth/google", body);
  assert.equal(missing.status, 401);
  assert.equal(missing.data.code, "GOOGLE_SESSION_MISSING");
  assert.equal(
    missing.data.message,
    "Your sign-in session could not be saved. Reload this page and try again.",
  );
  assert.equal(cookie(missing, "venueGoogleSetup"), undefined);
  assert.equal(cookie(missing, "venueAccessToken"), undefined);
  assert.equal(await User.countDocuments({ email: account.email }), 0);
  assert.ok(await GoogleAuthorization.exists({ tokenHash: tokenHash(start.cookie) }));

  const malformed = await request(
    "POST",
    "/auth/google",
    body,
    "venueGoogleChallenge=malformed",
  );
  assert.equal(malformed.status, 401);
  assert.notEqual(malformed.data.code, "GOOGLE_SESSION_MISSING");
  assert.match(malformed.data.message, /expired or already used/);

  const verified = await request("POST", "/auth/google", body, start.cookie);
  assert.equal(verified.status, 200);
  assert.equal(verified.data.purpose, "register");
  assert.ok(cookie(verified, "venueGoogleSetup"));
  assert.equal(await User.countDocuments({ email: account.email }), 0);
});

test("Google credentials and expired challenges cannot be replayed", async () => {
  const start = await challenge("register");
  const body = { credential: credential(start.nonce, identity("replay")) };
  assert.equal((await request("POST", "/auth/google", body, start.cookie)).status, 200);
  const replay = await request("POST", "/auth/google", body, start.cookie);
  assert.equal(replay.status, 401);
  assert.notEqual(replay.data.code, "GOOGLE_SESSION_MISSING");
  assert.match(replay.data.message, /expired or already used/);
  const fresh = await challenge("register");
  assert.equal((await request("POST", "/auth/google", body, fresh.cookie)).status, 401);
  const expired = await challenge("register");
  await GoogleAuthorization.updateOne(
    { tokenHash: tokenHash(expired.cookie) },
    { $set: { expiresAt: new Date(0) } },
  );
  const expiredResponse = await request(
    "POST",
    "/auth/google",
    {
      credential: credential(expired.nonce, identity("expired-challenge")),
    },
    expired.cookie,
  );
  assert.equal(expiredResponse.status, 401);
  assert.notEqual(expiredResponse.data.code, "GOOGLE_SESSION_MISSING");
  assert.match(expiredResponse.data.message, /expired or already used/);
});

test("legacy accounts require explicit Google plus password proof; recovery never auto-links", async () => {
  const legacy = await User.create({
    name: "Legacy Owner",
    email: "legacy@gmail.com",
    password: "LegacyPassword123!",
    emailVerified: false,
    googleId: null,
  });
  // Older documents may predate tokenVersion or store an empty Google link.
  await User.collection.updateOne({ _id: legacy._id }, { $unset: { tokenVersion: "" } });
  const account = identity("legacy");
  assert.equal(
    (
      await request("POST", "/auth/login", {
        email: account.email,
        password: "LegacyPassword123!",
      })
    ).status,
    403,
  );
  assert.equal((await google("recover", account)).status, 403);
  const pending = await google("login", account);
  assert.equal(pending.data.requiresLink, true);
  assert.equal(pending.data.user, undefined);
  assert.equal((await User.findById(legacy._id)).googleId, null);
  assert.equal(
    (await request("POST", "/auth/google/password-setup", passwords, pending.setupCookie)).status,
    401,
  );
  assert.equal(
    (await request("POST", "/auth/google/link", { password: "wrong" }, pending.setupCookie)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "POST",
        "/auth/google/link",
        { password: "LegacyPassword123!" },
        pending.setupCookie,
      )
    ).status,
    401,
  );
  const verified = await google("login", account);
  const linked = await request(
    "POST",
    "/auth/google/link",
    { password: "LegacyPassword123!" },
    verified.setupCookie,
  );
  assert.equal(linked.status, 200, JSON.stringify(linked.data));
  assert.equal(linked.data.user.id, String(legacy._id));
  assert.equal((await User.findById(legacy._id)).googleId, account.sub);
  assert.equal((await google("recover", account)).data.purpose, "recover");
  assert.equal(await User.countDocuments({ email: account.email }), 1);
});

test("duplicate registration, purpose confusion, role injection and suspended accounts are blocked", async () => {
  const { account, user } = await signup("duplicate");
  assert.equal((await google("register", account)).status, 409);
  const collision = await google("register", { ...account, sub: "different-sub" });
  assert.equal(collision.status, 403);
  const pending = await google("register", identity("role-injection"));
  assert.equal(
    (
      await request(
        "POST",
        "/auth/google/password-setup",
        {
          ...passwords,
          role: "platform_admin",
        },
        pending.setupCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "POST",
        "/auth/google/link",
        { password: passwords.password },
        pending.setupCookie,
      )
    ).status,
    401,
  );
  await User.updateOne({ _id: user._id }, { $set: { suspended: true } });
  assert.equal((await google("login", account)).status, 403);
  assert.equal((await google("recover", account)).status, 403);
  assert.equal(
    (await request("POST", "/auth/login", { email: account.email, password: passwords.password }))
      .status,
    403,
  );
});

test("all authentication/password endpoints enforce rate limits", async () => {
  for (const [policy, path, body, expected] of [
    ["googleChallenge", "/auth/google/challenge", { purpose: "login" }, 200],
    ["googleLogin", "/auth/google", { credential: "invalid" }, 401],
    ["googleSetup", "/auth/google/password-setup", passwords, 401],
    ["googleLink", "/auth/google/link", { password: "invalid" }, 401],
    ["passwordLogin", "/auth/login", { email: "absent@example.test", password: "invalid" }, 401],
  ]) {
    for (let i = 0; i < rateLimitPolicies[policy].limit; i++)
      assert.equal((await request("POST", path, body)).status, expected, policy);
    assert.equal((await request("POST", path, body)).status, 429, policy);
  }
});

test("OTP endpoints are absent; transactional delivery remains available", async () => {
  for (const path of [
    "/register",
    "/verify-email",
    "/resend-verification-otp",
    "/forgot-password",
    "/reset-password",
    "/google/complete-signup",
  ])
    assert.equal((await request("POST", "/auth" + path, {})).status, 404);
  process.env.VENUE_RESEND_API_KEY = "re_test_disposable";
  process.env.VENUE_EMAIL_FROM = "Venue <venue@example.test>";
  const delivery = mock.method(Resend.prototype, "post", async (_path, entity) => {
    assert.equal(entity.subject, "Booking confirmed");
    return { data: { id: "transactional-test" }, error: null };
  });
  assert.equal(
    (
      await sendTransactionalEmail({
        to: "guest@example.test",
        subject: "Booking confirmed",
        html: "<p>Confirmed</p>",
      })
    ).id,
    "transactional-test",
  );
  delivery.mock.restore();
});

test("Google login and password recovery preserve tenant isolation and unpaid hall access", async () => {
  const { account, user, completed } = await signup("payment-owner");
  const ownerCookie = cookie(completed, "venueAccessToken");
  const venue = await request(
    "POST",
    "/venues",
    {
      name: "Auth Payment Venue",
      slug: "auth-payment-venue",
      address: { line1: "Event Road", city: "Patna", state: "Bihar", postalCode: "800001" },
      contact: { phone: "9876543210", email: "venue@example.test", whatsapp: "919876543210" },
    },
    ownerCookie,
  );
  assert.equal(venue.status, 201, JSON.stringify(venue.data));
  const hall = await request(
    "POST",
    "/venues/" + venue.data.venue._id + "/halls",
    {
      name: "Unpaid Hall",
      capacity: 100,
    },
    ownerCookie,
  );
  assert.equal(hall.status, 201, JSON.stringify(hall.data));
  const base = "/venues/" + venue.data.venue._id + "/halls/" + hall.data.hall._id;
  const login = await google("login", account);
  assert.equal(
    (await request("GET", base + "/overview", undefined, cookie(login, "venueAccessToken"))).status,
    402,
  );
  assert.equal((await request("GET", base + "/overview", undefined, ownerCookie)).status, 402);
  const stranger = await signup("payment-stranger");
  assert.equal(
    (
      await request(
        "GET",
        base + "/overview",
        undefined,
        cookie(stranger.completed, "venueAccessToken"),
      )
    ).status,
    404,
  );
  const reset = await google("recover", account);
  const changed = { password: "PaymentPassword123!", confirmPassword: "PaymentPassword123!" };
  assert.equal(
    (await request("POST", "/auth/google/password-setup", changed, reset.setupCookie)).status,
    200,
  );
  const passwordLogin = await request("POST", "/auth/login", {
    email: account.email,
    password: changed.password,
  });
  assert.equal(
    (await request("GET", base + "/overview", undefined, cookie(passwordLogin, "venueAccessToken")))
      .status,
    402,
  );
  assert.equal((await request("GET", base + "/overview", undefined, session(user))).status, 401);
});

test("linked subject remains the identity when the Google email changes", async () => {
  const { account, user } = await signup("renamed-email");
  await User.updateOne({ _id: user._id }, { $set: { emailVerified: false } });
  const result = await google("login", { ...account, email: "changed-address@gmail.com" });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.id, String(user._id));
  assert.equal(result.data.user.emailVerified, true);
  assert.equal(
    (await request("GET", "/auth/me", undefined, cookie(result, "venueAccessToken"))).status,
    200,
  );
  assert.equal(
    (await google("recover", { ...account, email: "changed-address@gmail.com" })).data.purpose,
    "recover",
  );
});

test("separate simultaneous signup authorizations cannot create duplicate accounts", async () => {
  const account = identity("duplicate-race");
  const first = await google("register", account);
  const second = await google("register", account);
  const results = await Promise.all(
    [first, second].map((verified) =>
      request("POST", "/auth/google/password-setup", passwords, verified.setupCookie),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(await User.countDocuments({ googleId: account.sub }), 1);
  assert.equal(await User.countDocuments({ email: account.email }), 1);
});
