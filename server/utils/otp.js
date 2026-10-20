import crypto from "crypto";

export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

export const hashPasswordResetOtp = (otp, userId) => {
  const secret = process.env.VENUE_OTP_HASH_SECRET;

  if (!secret) {
    throw new Error("VENUE_OTP_HASH_SECRET is not configured");
  }

  return crypto.createHmac("sha256", secret).update(`${userId.toString()}:${otp}`).digest("hex");
};

export const otpHashesEqual = (first, second) => {
  const received = Buffer.from(first || "", "hex");
  const stored = Buffer.from(second || "", "hex");
  return (
    received.length > 0 &&
    received.length === stored.length &&
    crypto.timingSafeEqual(received, stored)
  );
};
