import User from "../../models/User.js";
import { generateOtp, hashPasswordResetOtp as hashCode } from "../../utils/otp.js";
import { sendVerificationOtp } from "../emailService.js";
import { must } from "../../utils/errors.js";

export async function registerAccount(input) {
  must(
    process.env.VENUE_RESEND_API_KEY && process.env.VENUE_EMAIL_FROM,
    "Configure transactional email before registration",
    503,
  );
  must(
    !(await User.exists({ email: input.email })),
    "An account already exists. Sign in or request a new verification code.",
    409,
  );
  const otp = generateOtp();
  const user = new User(input);
  user.emailVerificationOtpHash = hashCode(otp, user._id);
  user.emailVerificationExpiresAt = new Date(Date.now() + 600000);
  user.emailVerificationLastSentAt = new Date();
  await user.save();
  await sendVerificationOtp(user.email, otp);
  return user;
}

export async function authenticateAccount({ email, password }) {
  const user = await User.findOne({ email });
  must(user && (await user.comparePassword(password)), "Invalid email or password", 401);
  must(user.emailVerified, "Verify your email before signing in", 403);
  return user;
}
