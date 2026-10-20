import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import {
  generateOtp,
  hashPasswordResetOtp as hashCode,
  otpHashesEqual as equal,
} from "../../utils/otp.js";
import { sendPasswordResetOtp } from "../emailService.js";
import { must } from "../../utils/errors.js";

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (user) {
    const otp = generateOtp();
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { passwordResetLastSentAt: { $lt: new Date(Date.now() - 60000) } },
          { passwordResetLastSentAt: { $exists: false } },
        ],
      },
      {
        $set: {
          passwordResetOtpHash: hashCode(otp, user._id),
          passwordResetExpiresAt: new Date(Date.now() + 600000),
          passwordResetLastSentAt: new Date(),
          passwordResetAttempts: 0,
        },
      },
    );
    if (updated) await sendPasswordResetOtp(email, otp);
  }
}

export async function applyPasswordReset({ email, otp, newPassword }) {
  const user = await User.findOneAndUpdate(
    { email, passwordResetExpiresAt: { $gt: new Date() }, passwordResetAttempts: { $lt: 5 } },
    { $inc: { passwordResetAttempts: 1 } },
    { returnDocument: "after" },
  );
  must(
    user && equal(hashCode(otp, user._id), user.passwordResetOtpHash),
    "Invalid or expired reset code",
  );
  const password = await bcrypt.hash(newPassword, 12);
  const result = await User.updateOne(
    {
      _id: user._id,
      passwordResetOtpHash: user.passwordResetOtpHash,
      passwordResetExpiresAt: { $gt: new Date() },
    },
    {
      $set: { password },
      $inc: { tokenVersion: 1 },
      $unset: { passwordResetOtpHash: 1, passwordResetExpiresAt: 1, passwordResetLastSentAt: 1 },
    },
  );
  must(result.modifiedCount === 1, "Reset code already used", 409);
}
