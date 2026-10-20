import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../../models/User.js";
import GoogleAuthorization from "../../models/GoogleAuthorization.js";
import { fail, must } from "../../utils/errors.js";

const googleClient = new OAuth2Client();
export const AUTHORIZATION_LIFETIME_MS = 5 * 60 * 1000;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const invalid = "Google authorization expired or already used. Please sign in with Google again.";
const sessionVersionFilter = (version) =>
  version === 0
    ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
    : { tokenVersion: version };

function tokenHash(token) {
  must(typeof token === "string" && /^[a-f0-9]{64}$/.test(token), invalid, 401);
  return hash(token);
}

async function issueAuthorization(fields) {
  const token = crypto.randomBytes(32).toString("hex");
  await GoogleAuthorization.create({
    ...fields,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + AUTHORIZATION_LIFETIME_MS),
  });
  return token;
}

export async function discardAuthorization(token) {
  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token))
    await GoogleAuthorization.deleteOne({ tokenHash: hash(token) });
}

export async function createGoogleChallenge(purpose) {
  must(process.env.VENUE_GOOGLE_CLIENT_ID, "Google authentication is not configured", 503);
  const nonce = crypto.randomBytes(32).toString("hex");
  return { nonce, token: await issueAuthorization({ kind: "challenge", purpose, nonce }) };
}

export async function verifyGoogleToken(credential, nonce) {
  const audience = process.env.VENUE_GOOGLE_CLIENT_ID;
  must(audience, "Google authentication is not configured", 503);
  must(
    typeof credential === "string" && credential.trim() && credential.length <= 10000,
    "Google credential is required",
    401,
  );
  let payload;
  try {
    // The SDK verifies Google's signing certificate, signature, audience,
    // issuer and lifetime. Also enforce strict expiry, freshness and nonce.
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
    payload = ticket.getPayload();
  } catch {
    throw fail("Google authentication failed", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  must(
    payload &&
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.email === "string" &&
      payload.email_verified === true &&
      ["accounts.google.com", "https://accounts.google.com"].includes(payload.iss) &&
      payload.aud === audience &&
      Number.isInteger(payload.exp) &&
      payload.exp > now &&
      Number.isInteger(payload.iat) &&
      payload.iat >= now - 300 &&
      payload.iat <= now + 60 &&
      typeof nonce === "string" &&
      payload.nonce === nonce,
    "Invalid or expired Google authentication. Please sign in with Google again.",
    401,
  );
  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name:
      typeof payload.name === "string"
        ? payload.name.trim().slice(0, 100) || "Google User"
        : "Google User",
  };
}

export async function authenticateGoogleAccount(credential, challengeToken) {
  const challenge = await GoogleAuthorization.findOne({
    tokenHash: tokenHash(challengeToken),
    kind: "challenge",
    expiresAt: { $gt: new Date() },
  });
  must(challenge, invalid, 401);
  const identity = await verifyGoogleToken(credential, challenge.nonce);
  const consumed = await GoogleAuthorization.findOneAndDelete({
    _id: challenge._id,
    expiresAt: { $gt: new Date() },
  });
  must(consumed, invalid, 401);
  const linked = await User.findOne({ googleId: identity.googleId });
  if (linked) {
    must(!linked.suspended, "Account access is suspended", 403);
    must(challenge.purpose !== "register", "Account already exists. Please sign in.", 409);
    if (challenge.purpose === "login") {
      if (!linked.emailVerified) {
        linked.emailVerified = true;
        await linked.save();
      }
      return { user: linked };
    }
    return setupResult("recover", identity, linked);
  }
  // Recovery never falls back to email and never creates or links accounts.
  must(
    challenge.purpose !== "recover",
    "No eligible linked account. Sign in with your existing password to link Google first. If you cannot, contact support for manual ownership review.",
    403,
  );
  const legacy = await User.findOne({ email: identity.email });
  if (legacy) {
    must(
      !legacy.suspended && !legacy.googleId,
      "This account cannot be linked to this Google identity. Contact support.",
      403,
    );
    return setupResult("link", identity, legacy);
  }
  must(challenge.purpose === "register", "No linked account. Create an account first.", 403);
  return setupResult("register", identity);
}

async function setupResult(purpose, identity, user) {
  const setupToken = await issueAuthorization({
    kind: "setup",
    purpose,
    ...identity,
    ...(user ? { userId: user._id, tokenVersion: user.tokenVersion ?? 0 } : {}),
  });
  return { setupToken, purpose, email: user?.email || identity.email };
}

export async function getGoogleSetup(token) {
  const setup = await GoogleAuthorization.findOne({
    tokenHash: tokenHash(token),
    kind: "setup",
    expiresAt: { $gt: new Date() },
  });
  must(setup, invalid, 401);
  return setup;
}

async function consumeSetup(token, purposes) {
  const setup = await GoogleAuthorization.findOneAndDelete({
    tokenHash: tokenHash(token),
    kind: "setup",
    purpose: { $in: purposes },
    expiresAt: { $gt: new Date() },
  });
  must(setup, invalid, 401);
  return setup;
}

export async function completeGooglePassword(token, password) {
  const pending = await getGoogleSetup(token);
  must(["register", "recover"].includes(pending.purpose), invalid, 401);
  // Hash before consuming, then atomically recheck expiration and single use.
  const passwordHash = await bcrypt.hash(password, 12);
  const setup = await consumeSetup(token, ["register", "recover"]);
  if (setup.purpose === "register") {
    must(
      !(await User.exists({ $or: [{ email: setup.email }, { googleId: setup.googleId }] })),
      "Account already exists. Please sign in.",
      409,
    );
    // insertMany bypasses save hooks: this password is already hashed.
    // Unique indexes arbitrate concurrent registrations for the same email/sub.
    const [user] = await User.insertMany([
      {
        name: setup.name,
        email: setup.email,
        googleId: setup.googleId,
        password: passwordHash,
        emailVerified: true,
        role: "owner",
      },
    ]);
    return { user, purpose: "register" };
  }
  const changed = await User.updateOne(
    {
      _id: setup.userId,
      googleId: setup.googleId,
      suspended: false,
      ...sessionVersionFilter(setup.tokenVersion),
    },
    { $set: { password: passwordHash, emailVerified: true }, $inc: { tokenVersion: 1 } },
  );
  must(changed.modifiedCount === 1, "Account changed. Please sign in with Google again.", 409);
  await GoogleAuthorization.deleteMany({ kind: "setup", userId: setup.userId });
  return { purpose: "recover" };
}

export async function linkGoogleAccount(token, password) {
  // One password attempt per Google verification, including failed attempts.
  const setup = await consumeSetup(token, ["link"]);
  const user = await User.findOne({
    _id: setup.userId,
    email: setup.email,
    googleId: { $in: [null, ""] },
    suspended: false,
    ...sessionVersionFilter(setup.tokenVersion),
  }).select("+password");
  must(
    user && (await user.comparePassword(password)),
    "Unable to link account. Confirm your existing password and sign in with Google again.",
    401,
  );
  // Initial link only: compare-and-set requires proof of password and Google.
  // googleId remains immutable for every subsequent document save/update.
  const result = await User.collection.updateOne(
    {
      _id: user._id,
      googleId: { $in: [null, ""] },
      password: user.password,
      suspended: false,
      ...sessionVersionFilter(setup.tokenVersion),
    },
    { $set: { googleId: setup.googleId, emailVerified: true }, $inc: { tokenVersion: 1 } },
  );
  must(result.modifiedCount === 1, "Account changed. Please sign in again.", 409);
  return User.findById(user._id);
}
