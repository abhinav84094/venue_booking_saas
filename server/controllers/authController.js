import {
  registrationSchema,
  codeSchema,
  emailRequestSchema,
  loginSchema,
  passwordResetSchema,
  accountSchema,
} from "../validators/authValidator.js";
import { registerAccount, authenticateAccount } from "../services/auth/accountService.js";
import {
  verifyAccountEmail,
  resendAccountVerification,
} from "../services/auth/verificationService.js";
import { requestPasswordReset, applyPasswordReset } from "../services/auth/passwordResetService.js";
import generateToken from "../utils/generateToken.js";
import { AUTH_COOKIE, cookieOptions, publicUser } from "../utils/authCookie.js";
import { must } from "../utils/errors.js";

export function issueLogin(res, user) {
  must(!user.suspended, "Account access is suspended", 403);
  res.cookie(AUTH_COOKIE, generateToken(user._id, user.tokenVersion), {
    ...cookieOptions(),
    maxAge: 7 * 86400000,
  });
  return res.json({ success: true, requiresPassword: false, user: publicUser(user) });
}

export async function registerUser(req, res) {
  const user = await registerAccount(registrationSchema.parse(req.body));
  res
    .status(201)
    .json({
      success: true,
      message: "Account created. Verify the code sent to your email.",
      user: publicUser(user),
    });
}
export async function verifyEmail(req, res) {
  await verifyAccountEmail(codeSchema.parse(req.body));
  res.json({ success: true, message: "Email verified. You can now sign in." });
}
export async function resendVerificationOtp(req, res) {
  const { email } = emailRequestSchema.parse(req.body);
  await resendAccountVerification(email);
  res.json({
    success: true,
    message:
      "If an unverified account exists, a code has been sent. Allow 60 seconds between requests.",
  });
}
export async function loginUser(req, res) {
  const user = await authenticateAccount(loginSchema.parse(req.body));
  return issueLogin(res, user);
}
export async function logoutUser(_req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ success: true, message: "Signed out" });
}

export async function forgotPassword(req, res) {
  const { email } = emailRequestSchema.parse(req.body);
  await requestPasswordReset(email);
  res.json({
    success: true,
    message: "If an account exists, a password reset code has been sent.",
  });
}
export async function resetPassword(req, res) {
  await applyPasswordReset(passwordResetSchema.parse(req.body));
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ success: true, message: "Password changed. Sign in again." });
}
export async function updateAccount(req, res) {
  const input = accountSchema.parse(req.body);
  req.user.name = input.name;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
}
