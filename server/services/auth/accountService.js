import User from "../../models/User.js";
import { must } from "../../utils/errors.js";

export async function authenticateAccount({ email, password }) {
  const user = await User.findOne({ email }).select("+password");
  must(user && (await user.comparePassword(password)), "Invalid email or password", 401);
  must(
    user.emailVerified,
    "Sign in with Google and confirm your existing password to link this account. Contact support if you cannot prove ownership.",
    403,
  );
  return user;
}
