import { loginSchema, accountSchema } from "../validators/authValidator.js";
import { authenticateAccount } from "../services/auth/accountService.js";
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
export async function loginUser(req, res) {
  return issueLogin(res, await authenticateAccount(loginSchema.parse(req.body)));
}
export async function logoutUser(_req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ success: true, message: "Signed out" });
}
export async function updateAccount(req, res) {
  req.user.name = accountSchema.parse(req.body).name;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
}
