import { OAuth2Client } from "google-auth-library";
import User from "../../models/User.js";
import { fail, must } from "../../utils/errors.js";

const googleClient = new OAuth2Client(process.env.VENUE_GOOGLE_CLIENT_ID);

// Verify Google's ID token on the backend.
const verifyGoogleToken = async (credential) => {
  if (!process.env.VENUE_GOOGLE_CLIENT_ID)
    throw fail("Google authentication is not configured", 503);
  if (typeof credential !== "string" || !credential.trim() || credential.length > 10000) {
    throw new Error("Google credential is required");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.VENUE_GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    throw new Error("Invalid Google account");
  }

  const email = payload.email.trim().toLowerCase();
  const domain = email.split("@")[1];

  // Google is authoritative for Gmail and matching
  // Google Workspace hosted domains.
  const emailIsAuthoritative =
    domain === "gmail.com" ||
    domain === "googlemail.com" ||
    (typeof payload.hd === "string" && payload.hd.toLowerCase() === domain);

  if (!emailIsAuthoritative)
    throw fail(
      "For this email provider, register and verify your email, then use your password to sign in.",
      403,
    );

  return {
    googleId: payload.sub,
    email,
    name: payload.name?.trim().slice(0, 100) || "Google User",
    emailIsAuthoritative,
  };
};

async function markGoogleEmailVerified(user) {
  if (user.emailVerified) return;
  user.emailVerified = true;
  user.emailVerificationOtpHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  user.emailVerificationLastSentAt = undefined;
  await user.save();
}

export async function authenticateGoogleAccount(credential) {
  const googleUser = await verifyGoogleToken(credential);
  const linkedUser = await User.findOne({ googleId: googleUser.googleId });
  if (linkedUser) {
    must(linkedUser.email === googleUser.email, "Google account email mismatch", 403);
    await markGoogleEmailVerified(linkedUser);
    return { user: linkedUser };
  }
  const existingUser = await User.findOne({ email: googleUser.email });
  if (existingUser) {
    must(!existingUser.googleId, "This email is linked to another Google account", 409);
    // Token validation accepts only authoritative Gmail or matching Workspace email.
    await markGoogleEmailVerified(existingUser);
    return { user: existingUser };
  }
  return {
    success: true,
    requiresPassword: true,
    message: "Set a password to complete registration",
    name: googleUser.name,
    email: googleUser.email,
  };
}

export async function registerGoogleAccount({ credential, password }) {
  const googleUser = await verifyGoogleToken(credential);
  const existing = await User.exists({
    $or: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
  });
  must(!existing, "Account already exists. Please sign in.", 409);
  return User.create({
    name: googleUser.name,
    email: googleUser.email,
    googleId: googleUser.googleId,
    password,
    emailVerified: true,
    role: "owner",
  });
}
