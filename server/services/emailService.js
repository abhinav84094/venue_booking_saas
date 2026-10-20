import { Resend } from "resend";
import { fail } from "../utils/errors.js";
async function sendCode(email, otp, purpose) {
  if (!process.env.VENUE_RESEND_API_KEY || !process.env.VENUE_EMAIL_FROM)
    throw fail(
      "Transactional email is not configured. Configure Resend and a verified sender.",
      503,
    );
  const { data, error } = await new Resend(process.env.VENUE_RESEND_API_KEY).emails.send({
    from: process.env.VENUE_EMAIL_FROM,
    to: email,
    subject: `${purpose} - Prakash SaaS`,
    html: `<h2>Prakash SaaS</h2><p>${purpose}</p><p>Your code is <strong>${otp}</strong>. It expires in 10 minutes.</p><p>If you did not request this code, ignore this email.</p>`,
  });
  if (error) throw fail("Unable to deliver email. Please try requesting a new code later.", 503);
  return data;
}
export const sendVerificationOtp = (email, otp) => sendCode(email, otp, "Verify your email");
export const sendPasswordResetOtp = (email, otp) => sendCode(email, otp, "Reset your password");
