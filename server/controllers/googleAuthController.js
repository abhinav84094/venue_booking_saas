import {
  authenticateGoogleAccount,
  createGoogleChallenge,
  discardAuthorization,
  getGoogleSetup,
  completeGooglePassword,
  linkGoogleAccount,
  AUTHORIZATION_LIFETIME_MS,
} from "../services/auth/googleAccountService.js";
import {
  googleChallengeSchema,
  googleCredentialSchema,
  googlePasswordSchema,
  googleLinkSchema,
} from "../validators/authValidator.js";
import { issueLogin } from "./authController.js";
import { AUTH_COOKIE, cookieOptions } from "../utils/authCookie.js";

const CHALLENGE_COOKIE = "venueGoogleChallenge";
const SETUP_COOKIE = "venueGoogleSetup";
const options = () => ({ ...cookieOptions(), path: "/api/auth/google" });
const setCookie = (res, name, token) =>
  res.cookie(name, token, {
    ...options(),
    maxAge: AUTHORIZATION_LIFETIME_MS,
  });

export async function googleChallenge(req, res) {
  const { purpose } = googleChallengeSchema.parse(req.body);
  await discardAuthorization(req.cookies?.[CHALLENGE_COOKIE]);
  await discardAuthorization(req.cookies?.[SETUP_COOKIE]);
  res.clearCookie(SETUP_COOKIE, options());
  const challenge = await createGoogleChallenge(purpose);
  setCookie(res, CHALLENGE_COOKIE, challenge.token);
  res.json({ success: true, nonce: challenge.nonce });
}

export async function googleLogin(req, res) {
  const { credential } = googleCredentialSchema.parse(req.body);
  if (!req.cookies?.[CHALLENGE_COOKIE])
    return res.status(401).json({
      success: false,
      code: "GOOGLE_SESSION_MISSING",
      message: "Your sign-in session could not be saved. Reload this page and try again.",
    });
  const result = await authenticateGoogleAccount(credential, req.cookies?.[CHALLENGE_COOKIE]);
  res.clearCookie(CHALLENGE_COOKIE, options());
  if (result.user) return issueLogin(res, result.user);
  setCookie(res, SETUP_COOKIE, result.setupToken);
  return res.json({
    success: true,
    requiresPassword: result.purpose !== "link",
    requiresLink: result.purpose === "link",
    purpose: result.purpose,
    email: result.email,
  });
}

export async function googleSetupStatus(req, res) {
  const setup = await getGoogleSetup(req.cookies?.[SETUP_COOKIE]);
  res.json({
    success: true,
    purpose: setup.purpose,
    email: setup.email,
    expiresAt: setup.expiresAt,
  });
}

export async function completeGoogleSetup(req, res) {
  const { password } = googlePasswordSchema.parse(req.body);
  const result = await completeGooglePassword(req.cookies?.[SETUP_COOKIE], password);
  res.clearCookie(SETUP_COOKIE, options());
  if (result.purpose === "register") return issueLogin(res, result.user);
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  return res.json({ success: true, message: "Password changed. Sign in again." });
}

export async function completeGoogleLink(req, res) {
  const { password } = googleLinkSchema.parse(req.body);
  const user = await linkGoogleAccount(req.cookies?.[SETUP_COOKIE], password);
  res.clearCookie(SETUP_COOKIE, options());
  return issueLogin(res, user);
}
