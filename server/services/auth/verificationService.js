import User from "../../models/User.js";
import {
  generateOtp,
  hashPasswordResetOtp as hashCode,
  otpHashesEqual as equal,
} from "../../utils/otp.js";
import { sendVerificationOtp } from "../emailService.js";
import { must } from "../../utils/errors.js";

export async function verifyAccountEmail({ email, otp }) {
  const user = await User.findOne({ email });
  must(
    user && !user.emailVerified && user.emailVerificationExpiresAt > new Date(),
    "Invalid or expired verification code",
  );
  must(user.emailVerificationAttempts < 5, "Too many attempts. Request another code.", 429);
  const attempt = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerified: false,
      emailVerificationAttempts: { $lt: 5 },
      emailVerificationOtpHash: user.emailVerificationOtpHash,
    },
    { $inc: { emailVerificationAttempts: 1 } },
    { returnDocument: "after" },
  );
  must(attempt, "Too many attempts or code changed. Request another code.", 429);
  must(
    equal(hashCode(otp, user._id), attempt.emailVerificationOtpHash),
    "Invalid or expired verification code",
  );
  const saved = await User.updateOne(
    {
      _id: user._id,
      emailVerified: false,
      emailVerificationOtpHash: attempt.emailVerificationOtpHash,
    },
    {
      $set: { emailVerified: true },
      $unset: {
        emailVerificationOtpHash: 1,
        emailVerificationExpiresAt: 1,
        emailVerificationLastSentAt: 1,
      },
    },
  );
  must(saved.modifiedCount === 1, "Verification code changed. Try the latest code.", 409);
}

export async function resendAccountVerification(email) {
  const user = await User.findOne({ email, emailVerified: false });
  if (user) {
    const otp = generateOtp();
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: false,
        $or: [
          { emailVerificationLastSentAt: { $lt: new Date(Date.now() - 60000) } },
          { emailVerificationLastSentAt: { $exists: false } },
        ],
      },
      {
        $set: {
          emailVerificationOtpHash: hashCode(otp, user._id),
          emailVerificationExpiresAt: new Date(Date.now() + 600000),
          emailVerificationLastSentAt: new Date(),
          emailVerificationAttempts: 0,
        },
      },
    );
    if (updated) await sendVerificationOtp(email, otp);
  }
}
